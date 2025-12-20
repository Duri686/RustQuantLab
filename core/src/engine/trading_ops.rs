//! # 交易操作模块
//!
//! 封装开仓、平仓、加仓、减仓、强平等交易执行逻辑。
//!
//! ## 职责
//! - 交易参数验证
//! - 保证金检查
//! - 执行 One-Way Mode 交易逻辑
//! - 发送交易事件

use std::collections::HashMap;
use crate::risk::{LiquidationResult, PositionSide, RiskCalculator, RiskConfig, RiskLevel};
use crate::trading::{
    MarginMode, PositionManager, TradeAction, OpenPositionParams,
    TradingAccount,
};
use super::types::{
    ClosePositionResult, EngineEvent, OpenPositionRequest, OpenPositionResult,
};

// ============================================================================
// 交易执行器
// ============================================================================

/// 交易执行器
///
/// 提供交易操作的静态方法，操作 MarketEngine 的内部状态
pub(crate) struct TradingExecutor;

impl TradingExecutor {
    /// 更新当前价格并执行风险检查 (多仓位版本)
    ///
    /// 每次价格更新时:
    /// 1. 更新 current_price 和 symbol_prices
    /// 2. 遍历所有仓位，重新计算未实现盈亏
    /// 3. 执行风险评估 (Cross: 账户级别, Isolated: 仓位级别)
    /// 4. 如果触发强平条件，执行强制平仓
    pub fn update_price(
        price: f64,
        current_price: &mut f64,
        symbol_prices: &mut HashMap<String, f64>,
        position_manager: &mut PositionManager,
        account: &TradingAccount,
        risk_config: &RiskConfig,
        risk_assessment: &mut Option<LiquidationResult>,
        pending_events: &mut Vec<EngineEvent>,
    ) -> Vec<String> {
        *current_price = price;
        symbol_prices.insert("BTCUSDT".to_string(), price);

        // 如果没有持仓，无需风险检查
        if position_manager.is_empty() {
            *risk_assessment = None;
            return Vec::new();
        }

        // ========== 1. 更新所有仓位的未实现盈亏 ==========
        position_manager.update_pnl(symbol_prices);

        // 计算维持保证金需求
        let (total_cross_maintenance_margin, positions_to_liquidate) = 
            position_manager.calculate_maintenance_requirements(symbol_prices, risk_config);
        
        let total_cross_unrealized_pnl = position_manager.total_cross_unrealized_pnl();

        // ========== 2. Cross 模式账户级别风险评估 ==========
        let account_equity = account.balance() + total_cross_unrealized_pnl;
        let cross_margin_ratio = if total_cross_maintenance_margin > 0.0 {
            account_equity / total_cross_maintenance_margin
        } else {
            f64::MAX
        };

        let risk_level = RiskCalculator::evaluate_risk_level(
            cross_margin_ratio,
            risk_config.margin_warning_threshold,
        );

        // 主仓位风险评估 (BTCUSDT 或第一个仓位)
        let primary_pos_opt = position_manager.get("BTCUSDT")
            .or_else(|| position_manager.iter().next().map(|(_, p)| p))
            .cloned();

        let mut cross_liquidation_triggered = false;

        if let Some(primary_pos) = primary_pos_opt {
            let distance_pct = if primary_pos.liquidation_price > 0.0 {
                ((price - primary_pos.liquidation_price) / price * 100.0).abs()
            } else {
                100.0
            };

            let is_liquidated = cross_margin_ratio <= 1.0;
            
            *risk_assessment = Some(LiquidationResult {
                risk_level,
                margin_ratio: cross_margin_ratio,
                liquidation_price: primary_pos.liquidation_price,
                distance_to_liquidation_pct: distance_pct,
                maintenance_margin: total_cross_maintenance_margin,
                available_balance: account.calculate_available_balance(position_manager),
                is_liquidated,
                warning_message: match risk_level {
                    RiskLevel::Critical => Some("⚠️ 极高风险：即将触发强制平仓！".to_string()),
                    RiskLevel::High => Some("⚠️ 高风险：请注意保证金水平".to_string()),
                    RiskLevel::Medium => Some("注意：保证金率较低".to_string()),
                    _ => None,
                },
            });

            // 发送风险预警
            if matches!(risk_level, RiskLevel::High | RiskLevel::Critical) {
                pending_events.push(EngineEvent::MarginWarning {
                    symbol: "BTCUSDT".to_string(),
                    risk_level: format!("{:?}", risk_level),
                    margin_ratio: cross_margin_ratio,
                    liquidation_price: primary_pos.liquidation_price,
                    distance_pct,
                });
            }

            // Cross 模式全账户强平
            if is_liquidated {
                pending_events.push(EngineEvent::AccountRiskWarning {
                    account_equity,
                    total_maintenance_margin: total_cross_maintenance_margin,
                    risk_level: format!("{:?}", risk_level),
                });
                cross_liquidation_triggered = true;
            }
        }

        // 返回需要强平的仓位 (Cross 和 Isolated)
        let mut to_liquidate = positions_to_liquidate;
        if cross_liquidation_triggered {
            // Cross 模式强平所有 Cross 仓位
            to_liquidate.extend(position_manager.cross_position_symbols());
        }
        to_liquidate
    }

    /// 开仓内部实现 (支持 Hedge Mode - 多空可同时存在)
    ///
    /// ## 两种场景:
    /// - **Scenario A**: 无同方向仓位 → 创建新仓位
    /// - **Scenario B**: 已有同方向仓位 → 合并 (加权平均价)
    /// 
    /// 注: Hedge Mode 下多空仓位独立，使用 `symbol_side` 作为 key
    pub fn open_position(
        req: OpenPositionRequest,
        current_price: f64,
        position_manager: &mut PositionManager,
        account: &mut TradingAccount,
        risk_config: &RiskConfig,
        pending_events: &mut Vec<EngineEvent>,
        risk_assessment: &mut Option<LiquidationResult>,
        get_timestamp: impl Fn() -> u64,
    ) -> OpenPositionResult {
        // 1. 解析仓位方向
        let order_side = match req.side.to_lowercase().as_str() {
            "long" | "buy" => PositionSide::Long,
            "short" | "sell" => PositionSide::Short,
            _ => {
                return OpenPositionResult {
                    success: false,
                    message: format!("无效的仓位方向: {}", req.side),
                    position: None,
                    error_code: Some("INVALID_SIDE".to_string()),
                };
            }
        };

        // 2. 确定交易价格和杠杆
        let trade_price = req.price.unwrap_or(current_price);
        if trade_price <= 0.0 {
            return OpenPositionResult {
                success: false,
                message: "无效的开仓价格".to_string(),
                position: None,
                error_code: Some("INVALID_PRICE".to_string()),
            };
        }
        let leverage = req.leverage.unwrap_or(account.leverage());

        // 3. 检查保证金模式冲突 (禁止混合全仓/逐仓)
        if !position_manager.is_empty() {
            let existing_mode = position_manager.iter().next().map(|(_, p)| p.margin_mode);
            if let Some(existing) = existing_mode {
                if existing != req.margin_mode {
                    let existing_mode_str = match existing {
                        MarginMode::Cross => "全仓",
                        MarginMode::Isolated => "逐仓",
                    };
                    let new_mode_str = match req.margin_mode {
                        MarginMode::Cross => "全仓",
                        MarginMode::Isolated => "逐仓",
                    };
                    return OpenPositionResult {
                        success: false,
                        message: format!(
                            "保证金模式冲突: 已有{}仓位，不能开{}仓位。请先平仓或切换模式。",
                            existing_mode_str, new_mode_str
                        ),
                        position: None,
                        error_code: Some("MARGIN_MODE_CONFLICT".to_string()),
                    };
                }
            }
        }

        // 4. Hedge Mode: 使用 symbol_side 作为 key，多空独立
        let position_key = format!("{}_{:?}", req.symbol, order_side);
        
        // 检查是否已有同方向仓位
        let has_same_side = position_manager.get(&position_key).is_some();

        if has_same_side {
            // ========== Scenario B: 同方向 → 合并 (加仓) ==========
            Self::merge_position(
                &position_key, req.size, trade_price,
                position_manager, account, risk_config, pending_events,
            )
        } else {
            // ========== Scenario A: 无同方向仓位 → 新开仓 ==========
            Self::open_new_position(
                position_key, req.symbol, order_side, req.size, trade_price, leverage, req.margin_mode,
                position_manager, account, risk_config, pending_events, get_timestamp,
            )
        }
    }

    /// Scenario A: 创建新仓位
    /// - `position_key`: 存储 key (如 "BTCUSDT_Long")
    /// - `display_symbol`: 显示用交易对 (如 "BTCUSDT")
    fn open_new_position(
        position_key: String,
        display_symbol: String,
        side: PositionSide,
        size: f64,
        entry_price: f64,
        leverage: u8,
        margin_mode: MarginMode,
        position_manager: &mut PositionManager,
        account: &TradingAccount,
        risk_config: &RiskConfig,
        pending_events: &mut Vec<EngineEvent>,
        get_timestamp: impl Fn() -> u64,
    ) -> OpenPositionResult {
        // 计算所需保证金
        let notional_value = size * entry_price;
        let imr = risk_config.get_initial_margin_rate(notional_value);
        let required_margin = notional_value * imr;

        // 检查保证金
        if let Err(msg) = account.check_margin(required_margin, position_manager) {
            return OpenPositionResult {
                success: false,
                message: msg,
                position: None,
                error_code: Some("INSUFFICIENT_MARGIN".to_string()),
            };
        }

        // 使用 PositionManager 创建仓位 (Hedge Mode: id = position_key, symbol = display_symbol)
        let timestamp = get_timestamp();
        let params = OpenPositionParams {
            symbol: position_key,
            display_symbol: Some(display_symbol.clone()),
            side,
            size,
            price: entry_price,
            leverage,
            margin_mode,
            timestamp,
        };
        let position = position_manager.open_position(params, risk_config).clone();

        // 发送事件
        pending_events.push(EngineEvent::PositionOpened {
            symbol: display_symbol.clone(),
            side: format!("{:?}", side),
            size,
            entry_price,
            leverage,
            liquidation_price: position.liquidation_price,
            margin_mode: format!("{:?}", margin_mode),
        });

        OpenPositionResult {
            success: true,
            message: format!("开仓成功: {:?} {:.4} @ {:.2}, {}x {:?}", side, size, entry_price, leverage, margin_mode),
            position: Some(position),
            error_code: None,
        }
    }

    /// Scenario B: 合并仓位 (同方向加仓)
    fn merge_position(
        symbol: &str,
        add_size: f64,
        market_price: f64,
        position_manager: &mut PositionManager,
        account: &TradingAccount,
        risk_config: &RiskConfig,
        pending_events: &mut Vec<EngineEvent>,
    ) -> OpenPositionResult {
        // 获取仓位信息
        let (old_entry, side) = match position_manager.get(symbol) {
            Some(p) => (p.entry_price, p.side),
            None => return OpenPositionResult {
                success: false,
                message: "仓位不存在".to_string(),
                position: None,
                error_code: Some("POSITION_NOT_FOUND".to_string()),
            },
        };

        // 计算加仓所需保证金
        let add_notional = add_size * market_price;
        let imr = risk_config.get_initial_margin_rate(add_notional);
        let add_margin = add_notional * imr;

        // 检查保证金
        if let Err(msg) = account.check_margin(add_margin, position_manager) {
            return OpenPositionResult {
                success: false,
                message: msg,
                position: None,
                error_code: Some("INSUFFICIENT_MARGIN".to_string()),
            };
        }

        // 使用 PositionManager 执行合并
        let result = position_manager.apply_trade(symbol, side, add_size, market_price, imr);
        
        let result = match result {
            Some(r) => r,
            None => return OpenPositionResult {
                success: false,
                message: "仓位不存在".to_string(),
                position: None,
                error_code: Some("POSITION_NOT_FOUND".to_string()),
            },
        };

        // 提取合并结果
        let (new_entry, new_size) = match &result.action {
            TradeAction::Merged { new_entry_price, .. } => {
                let pos = position_manager.get(symbol).unwrap();
                (*new_entry_price, pos.size)
            }
            _ => return OpenPositionResult {
                success: false,
                message: "意外的交易结果类型".to_string(),
                position: None,
                error_code: Some("UNEXPECTED_RESULT".to_string()),
            },
        };

        // 重新计算强平价格
        let pos = position_manager.get_mut(symbol).unwrap();
        let new_notional = pos.size * pos.entry_price;
        let mmr = risk_config.get_maintenance_margin_rate(new_notional);
        pos.liquidation_price = RiskCalculator::calculate_liquidation_price(
            pos.entry_price, pos.leverage, pos.side, mmr
        );
        let updated_pos = pos.clone();

        // 发送事件
        pending_events.push(EngineEvent::PositionMerged {
            symbol: symbol.to_string(),
            side: format!("{:?}", side),
            added_size: add_size,
            new_size,
            old_entry_price: old_entry,
            new_entry_price: new_entry,
        });

        OpenPositionResult {
            success: true,
            message: format!("加仓成功: +{:.4} @ {:.2}, 新均价 {:.2}, 总持仓 {:.4}", add_size, market_price, new_entry, new_size),
            position: Some(updated_pos),
            error_code: None,
        }
    }

    /// Scenario C: 减仓/反向开仓 (Netting)
    #[allow(clippy::too_many_arguments)]
    fn reduce_position(
        symbol: &str,
        close_size: f64,
        exit_price: f64,
        new_side: PositionSide,
        new_leverage: u8,
        new_margin_mode: MarginMode,
        position_manager: &mut PositionManager,
        account: &mut TradingAccount,
        risk_config: &RiskConfig,
        pending_events: &mut Vec<EngineEvent>,
        risk_assessment: &mut Option<LiquidationResult>,
        get_timestamp: impl Fn() -> u64,
    ) -> OpenPositionResult {
        // 获取仓位信息
        let pos_info = match position_manager.get(symbol) {
            Some(p) => (p.side, p.size),
            None => return OpenPositionResult {
                success: false,
                message: "仓位不存在".to_string(),
                position: None,
                error_code: Some("POSITION_NOT_FOUND".to_string()),
            },
        };
        let (pos_side, _current_size) = pos_info;

        // 使用 PositionManager 执行 Netting
        let result = position_manager.apply_trade(symbol, new_side, close_size, exit_price, 0.0);
        
        let result = match result {
            Some(r) => r,
            None => return OpenPositionResult {
                success: false,
                message: "仓位不存在".to_string(),
                position: None,
                error_code: Some("POSITION_NOT_FOUND".to_string()),
            },
        };

        // 根据 TradeAction 类型处理结果
        match result.action {
            TradeAction::Reduced { closed_size, remaining_size, realized_pnl } => {
                account.update_balance(realized_pnl);
                
                pending_events.push(EngineEvent::PositionReduced {
                    symbol: symbol.to_string(),
                    side: format!("{:?}", pos_side),
                    closed_size,
                    remaining_size,
                    realized_pnl,
                });

                let updated_pos = position_manager.get(symbol).cloned();
                OpenPositionResult {
                    success: true,
                    message: format!("减仓成功: -{:.4} @ {:.2}, 盈亏 {:.2}, 剩余 {:.4}", 
                        closed_size, exit_price, realized_pnl, remaining_size),
                    position: updated_pos,
                    error_code: None,
                }
            }
            TradeAction::Closed { closed_size, realized_pnl } => {
                account.update_balance(realized_pnl);
                
                pending_events.push(EngineEvent::PositionClosed {
                    symbol: symbol.to_string(),
                    side: format!("{:?}", pos_side),
                    size: closed_size,
                    entry_price: exit_price,
                    exit_price,
                    realized_pnl,
                });

                if symbol == "BTCUSDT" {
                    *risk_assessment = None;
                }

                OpenPositionResult {
                    success: true,
                    message: format!("平仓成功: {:.4} @ {:.2}, 盈亏 {:.2}", closed_size, exit_price, realized_pnl),
                    position: None,
                    error_code: None,
                }
            }
            TradeAction::Reversed { closed_pnl, excess_size, new_side: reversed_side } => {
                account.update_balance(closed_pnl);
                
                // Hedge Mode: 从 position_key 提取 display_symbol
                // position_key 格式: "BTCUSDT_Long" -> display_symbol: "BTCUSDT"
                let display_symbol = symbol.rsplit_once('_')
                    .map(|(s, _)| s.to_string())
                    .unwrap_or_else(|| symbol.to_string());
                let new_position_key = format!("{}_{:?}", display_symbol, reversed_side);
                
                // 开反向仓位
                Self::open_new_position(
                    new_position_key,
                    display_symbol,
                    reversed_side,
                    excess_size,
                    exit_price,
                    new_leverage,
                    new_margin_mode,
                    position_manager, account, risk_config, pending_events, get_timestamp,
                )
            }
            _ => OpenPositionResult {
                success: false,
                message: "意外的交易结果类型".to_string(),
                position: None,
                error_code: Some("UNEXPECTED_RESULT".to_string()),
            },
        }
    }

    /// 平仓内部实现
    pub fn close_position(
        symbol: &str,
        exit_price: f64,
        close_size: Option<f64>,
        is_liquidation: bool,
        position_manager: &mut PositionManager,
        account: &mut TradingAccount,
        pending_events: &mut Vec<EngineEvent>,
        risk_assessment: &mut Option<LiquidationResult>,
    ) -> ClosePositionResult {
        // 获取仓位信息
        let position = match position_manager.get(symbol).cloned() {
            Some(p) => p,
            None => {
                return ClosePositionResult {
                    success: false,
                    message: format!("无持仓可平: {}", symbol),
                    realized_pnl: 0.0,
                    exit_price: 0.0,
                    new_balance: account.balance(),
                };
            }
        };

        // 确定平仓数量
        let actual_close_size = close_size.unwrap_or(position.size).min(position.size);

        // 使用反方向执行平仓
        let opposite_side = match position.side {
            PositionSide::Long => PositionSide::Short,
            PositionSide::Short => PositionSide::Long,
        };

        let result = position_manager.apply_trade(symbol, opposite_side, actual_close_size, exit_price, 0.0);
        
        let trade_result = match result {
            Some(r) => r,
            None => {
                return ClosePositionResult {
                    success: false,
                    message: format!("平仓失败: {}", symbol),
                    realized_pnl: 0.0,
                    exit_price: 0.0,
                    new_balance: account.balance(),
                };
            }
        };

        // 根据 TradeAction 判断是部分平仓还是完全平仓
        let (realized_pnl, is_fully_closed) = match &trade_result.action {
            TradeAction::Reduced { realized_pnl, remaining_size, closed_size } => {
                // 部分平仓
                pending_events.push(EngineEvent::PositionReduced {
                    symbol: symbol.to_string(),
                    side: format!("{:?}", position.side),
                    closed_size: *closed_size,
                    remaining_size: *remaining_size,
                    realized_pnl: *realized_pnl,
                });
                (*realized_pnl, false)
            }
            TradeAction::Closed { realized_pnl, .. } => (*realized_pnl, true),
            _ => (0.0, false),
        };

        account.update_balance(realized_pnl);

        // 完全平仓时处理
        if is_fully_closed {
            // 完全平仓: 移动到历史记录
            position_manager.move_to_history(symbol, exit_price, realized_pnl, is_liquidation);
            
            if symbol.contains("BTCUSDT") {
                *risk_assessment = None;
            }

            if is_liquidation {
                pending_events.push(EngineEvent::Liquidated {
                    symbol: position.symbol.clone(),
                    side: format!("{:?}", position.side),
                    size: position.size,
                    entry_price: position.entry_price,
                    liquidation_price: position.liquidation_price,
                    lost_margin: position.margin,
                });
            } else {
                pending_events.push(EngineEvent::PositionClosed {
                    symbol: position.symbol.clone(),
                    side: format!("{:?}", position.side),
                    size: position.size,
                    entry_price: position.entry_price,
                    exit_price,
                    realized_pnl,
                });
            }
        }

        ClosePositionResult {
            success: true,
            message: if is_liquidation {
                format!("⚠️ 强制平仓: {} {:?} {:.4} @ {:.2}, 亏损 {:.2} USDT",
                    position.symbol, position.side, actual_close_size, exit_price, realized_pnl.abs())
            } else if is_fully_closed {
                format!("平仓成功: {} {:?} {:.4} @ {:.2}, 盈亏 {:.2} USDT",
                    position.symbol, position.side, actual_close_size, exit_price, realized_pnl)
            } else {
                format!("部分平仓: {} {:?} {:.4} @ {:.2}, 盈亏 {:.2} USDT",
                    position.symbol, position.side, actual_close_size, exit_price, realized_pnl)
            },
            realized_pnl,
            exit_price,
            new_balance: account.balance(),
        }
    }
}
