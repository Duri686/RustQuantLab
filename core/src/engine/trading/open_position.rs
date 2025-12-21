//! # 开仓模块
//!
//! 负责开仓和加仓逻辑。

use crate::risk::{PositionSide, RiskCalculator, RiskConfig};
use crate::trading::{MarginMode, OpenPositionParams, PositionManager, TradeAction, TradingAccount};
use crate::engine::types::{EngineEvent, OpenPositionRequest, OpenPositionResult};

use super::TradingExecutor;

impl TradingExecutor {
    /// 开仓 (支持 Hedge Mode)
    pub fn open_position(
        req: OpenPositionRequest,
        current_price: f64,
        position_manager: &mut PositionManager,
        account: &mut TradingAccount,
        risk_config: &RiskConfig,
        pending_events: &mut Vec<EngineEvent>,
        _risk_assessment: &mut Option<crate::risk::LiquidationResult>,
        get_timestamp: impl Fn() -> u64,
    ) -> OpenPositionResult {
        // 1. 解析方向
        let order_side = match req.side.to_lowercase().as_str() {
            "long" | "buy" => PositionSide::Long,
            "short" | "sell" => PositionSide::Short,
            _ => return Self::error("无效的仓位方向", "INVALID_SIDE"),
        };

        // 2. 验证价格
        let trade_price = req.price.unwrap_or(current_price);
        if trade_price <= 0.0 {
            return Self::error("无效的开仓价格", "INVALID_PRICE");
        }
        let leverage = req.leverage.unwrap_or(account.leverage());

        // 3. 检查保证金模式冲突
        if let Some(conflict_msg) = Self::check_margin_mode_conflict(position_manager, req.margin_mode) {
            return OpenPositionResult {
                success: false,
                message: conflict_msg,
                position: None,
                error_code: Some("MARGIN_MODE_CONFLICT".to_string()),
            };
        }

        // 4. 执行开仓或加仓
        let position_key = format!("{}_{:?}", req.symbol, order_side);
        
        if position_manager.get(&position_key).is_some() {
            Self::merge_position(&position_key, req.size, trade_price, leverage, position_manager, account, risk_config, pending_events)
        } else {
            Self::open_new_position(position_key, req.symbol, order_side, req.size, trade_price, leverage, req.margin_mode, position_manager, account, risk_config, pending_events, get_timestamp)
        }
    }

    /// 创建新仓位
    pub(super) fn open_new_position(
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
        let notional_value = size * entry_price;
        let imr = risk_config.get_initial_margin_rate(notional_value);
        let required_margin = notional_value * imr;

        if let Err(msg) = account.check_margin(required_margin, position_manager) {
            return Self::error(&msg, "INSUFFICIENT_MARGIN");
        }

        let params = OpenPositionParams {
            symbol: position_key,
            display_symbol: Some(display_symbol.clone()),
            side,
            size,
            price: entry_price,
            leverage,
            margin_mode,
            timestamp: get_timestamp(),
        };
        let position = position_manager.open_position(params, risk_config).clone();

        pending_events.push(EngineEvent::PositionOpened {
            symbol: display_symbol,
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

    /// 合并仓位 (加仓)
    pub(super) fn merge_position(
        symbol: &str,
        add_size: f64,
        market_price: f64,
        new_leverage: u8,
        position_manager: &mut PositionManager,
        account: &TradingAccount,
        risk_config: &RiskConfig,
        pending_events: &mut Vec<EngineEvent>,
    ) -> OpenPositionResult {
        let (old_entry, side) = match position_manager.get(symbol) {
            Some(p) => (p.entry_price, p.side),
            None => return Self::error("仓位不存在", "POSITION_NOT_FOUND"),
        };

        let add_notional = add_size * market_price;
        let imr = risk_config.get_initial_margin_rate(add_notional);
        
        if let Err(msg) = account.check_margin(add_notional * imr, position_manager) {
            return Self::error(&msg, "INSUFFICIENT_MARGIN");
        }

        let result = match position_manager.apply_trade(symbol, side, add_size, market_price, imr) {
            Some(r) => r,
            None => return Self::error("仓位不存在", "POSITION_NOT_FOUND"),
        };

        let (new_entry, new_size) = match &result.action {
            TradeAction::Merged { new_entry_price, .. } => {
                let pos = position_manager.get(symbol).unwrap();
                (*new_entry_price, pos.size)
            }
            _ => return Self::error("意外的交易结果", "UNEXPECTED_RESULT"),
        };

        // 更新杠杆和强平价
        let pos = position_manager.get_mut(symbol).unwrap();
        pos.leverage = new_leverage; // 使用新杠杆
        let mmr = risk_config.get_maintenance_margin_rate(pos.size * pos.entry_price);
        pos.liquidation_price = RiskCalculator::calculate_liquidation_price(pos.entry_price, pos.leverage, pos.side, mmr);
        let updated_pos = pos.clone();

        pending_events.push(EngineEvent::PositionMerged {
            symbol: symbol.to_string(),
            side: format!("{:?}", side),
            added_size: add_size,
            new_size,
            old_entry_price: old_entry,
            new_entry_price: new_entry,
            new_leverage,
        });

        OpenPositionResult {
            success: true,
            message: format!("加仓成功: +{:.4} @ {:.2}, 新均价 {:.2}, 总持仓 {:.4}", add_size, market_price, new_entry, new_size),
            position: Some(updated_pos),
            error_code: None,
        }
    }

    /// 检查保证金模式冲突
    fn check_margin_mode_conflict(position_manager: &PositionManager, new_mode: MarginMode) -> Option<String> {
        if position_manager.is_empty() {
            return None;
        }
        
        let existing = position_manager.iter().next().map(|(_, p)| p.margin_mode)?;
        if existing == new_mode {
            return None;
        }

        let (existing_str, new_str) = match (existing, new_mode) {
            (MarginMode::Cross, MarginMode::Isolated) => ("全仓", "逐仓"),
            (MarginMode::Isolated, MarginMode::Cross) => ("逐仓", "全仓"),
            _ => return None,
        };
        
        Some(format!("保证金模式冲突: 已有{}仓位，不能开{}仓位", existing_str, new_str))
    }

    /// 创建错误结果
    fn error(msg: &str, code: &str) -> OpenPositionResult {
        OpenPositionResult {
            success: false,
            message: msg.to_string(),
            position: None,
            error_code: Some(code.to_string()),
        }
    }
}
