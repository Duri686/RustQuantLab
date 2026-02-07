//! # 限价单处理模块
//!
//! 负责限价单的创建、验证和触发执行。
//!
//! ## 职责
//! - 限价单参数验证
//! - 保证金冻结检查
//! - 挂单创建和取消

use crate::risk::{PositionSide, RiskConfig};
use crate::trading::{PendingOrderManager, PositionManager, TradingAccount};
use crate::engine::types::{CancelOrderResult, EngineEvent, OpenPositionRequest, OpenPositionResult};

// ============================================================================
// 限价单处理器
// ============================================================================

/// 限价单处理器
///
/// 封装限价单的创建和验证逻辑
pub(crate) struct LimitOrderHandler;

impl LimitOrderHandler {
    /// 创建限价单
    ///
    /// 验证参数、检查保证金、创建挂单
    #[allow(clippy::too_many_arguments)]
    pub fn create_limit_order(
        req: &OpenPositionRequest,
        current_market_price: f64,
        account: &TradingAccount,
        position_manager: &PositionManager,
        pending_order_manager: &mut PendingOrderManager,
        risk_config: &RiskConfig,
        pending_events: &mut Vec<EngineEvent>,
        get_timestamp: impl Fn() -> u64,
    ) -> OpenPositionResult {
        // 1. 验证限价
        let limit_price = match Self::validate_limit_price(req, current_market_price) {
            Ok(p) => p,
            Err(result) => return result,
        };

        // 2. 解析方向
        let order_side = match Self::parse_side(&req.side) {
            Ok(s) => s,
            Err(result) => return result,
        };

        // 3. 计算并检查保证金
        let leverage = req.leverage.unwrap_or(account.leverage());
        let frozen_margin = match Self::check_margin(
            req.size, limit_price, account, position_manager, pending_order_manager, risk_config,
        ) {
            Ok(m) => m,
            Err(result) => return result,
        };

        // 4. 创建挂单
        let timestamp = get_timestamp();
        let order_id = pending_order_manager.create_order(
            req.symbol.clone(),
            order_side,
            req.size,
            limit_price,
            current_market_price,
            leverage,
            req.margin_mode,
            frozen_margin,
            timestamp,
        );

        // 5. 发送事件
        let trigger_dir = if limit_price > current_market_price { "等涨" } else { "等跌" };
        pending_events.push(EngineEvent::LimitOrderCreated {
            order_id: order_id.clone(),
            symbol: req.symbol.clone(),
            side: order_side.to_string(),
            size: req.size,
            limit_price,
            leverage,
        });

        OpenPositionResult {
            success: true,
            message: format!(
                "限价单已创建: {:?} {:.4} {} @ {:.2} [{}，当前价{:.2}]",
                order_side, req.size, req.symbol, limit_price, trigger_dir, current_market_price
            ),
            position: None,
            error_code: None,
        }
    }

    /// 取消挂单
    pub fn cancel_order(
        order_id: &str,
        pending_order_manager: &mut PendingOrderManager,
        pending_events: &mut Vec<EngineEvent>,
    ) -> CancelOrderResult {
        // 获取订单信息用于事件
        let symbol = pending_order_manager.get(order_id)
            .map(|o| o.symbol.clone())
            .unwrap_or_default();

        match pending_order_manager.cancel_order(order_id) {
            Some(released) => {
                pending_events.push(EngineEvent::LimitOrderCancelled {
                    order_id: order_id.to_string(),
                    symbol,
                    released_margin: released,
                });
                CancelOrderResult {
                    success: true,
                    message: format!("挂单已取消，解冻保证金 {:.2} USDT", released),
                    released_margin: released,
                }
            }
            None => CancelOrderResult {
                success: false,
                message: format!("挂单不存在: {}", order_id),
                released_margin: 0.0,
            },
        }
    }

    // ========== 私有辅助方法 ==========

    /// 验证限价单价格
    fn validate_limit_price(
        req: &OpenPositionRequest,
        market_price: f64,
    ) -> Result<f64, OpenPositionResult> {
        // 必须指定价格
        let limit_price = match req.price {
            Some(p) if p > 0.0 => p,
            _ => {
                return Err(OpenPositionResult {
                    success: false,
                    message: "限价单必须指定价格".to_string(),
                    position: None,
                    error_code: Some("LIMIT_PRICE_REQUIRED".to_string()),
                });
            }
        };

        // 市价必须有效
        if market_price <= 0.0 {
            return Err(OpenPositionResult {
                success: false,
                message: "限价单需要有效的当前市场价格，请确保已有 tick 数据".to_string(),
                position: None,
                error_code: Some("INVALID_MARKET_PRICE".to_string()),
            });
        }

        // 限价不能等于市价
        if (limit_price - market_price).abs() < 0.01 {
            return Err(OpenPositionResult {
                success: false,
                message: "限价不能等于当前市价，请使用市价单".to_string(),
                position: None,
                error_code: Some("LIMIT_EQUALS_MARKET".to_string()),
            });
        }

        Ok(limit_price)
    }

    /// 解析仓位方向
    fn parse_side(side: &str) -> Result<PositionSide, OpenPositionResult> {
        match side.to_lowercase().as_str() {
            "long" | "buy" => Ok(PositionSide::Long),
            "short" | "sell" => Ok(PositionSide::Short),
            _ => Err(OpenPositionResult {
                success: false,
                message: format!("无效的仓位方向: {}", side),
                position: None,
                error_code: Some("INVALID_SIDE".to_string()),
            }),
        }
    }

    /// 检查保证金是否充足
    fn check_margin(
        size: f64,
        price: f64,
        account: &TradingAccount,
        position_manager: &PositionManager,
        pending_order_manager: &PendingOrderManager,
        risk_config: &RiskConfig,
    ) -> Result<f64, OpenPositionResult> {
        let notional_value = size * price;
        let imr = risk_config.get_initial_margin_rate(notional_value);
        let frozen_margin = notional_value * imr;

        let available = account.calculate_available_balance(position_manager)
            - pending_order_manager.total_frozen_margin();

        if frozen_margin > available {
            return Err(OpenPositionResult {
                success: false,
                message: format!(
                    "可用余额不足: 需要 {:.2} USDT, 可用 {:.2} USDT",
                    frozen_margin, available
                ),
                position: None,
                error_code: Some("INSUFFICIENT_MARGIN".to_string()),
            });
        }

        Ok(frozen_margin)
    }
}
