//! # 交易执行器模块
//!
//! 封装开仓、平仓等交易执行逻辑。
//!
//! ## 子模块
//! - `open_position`: 开仓/加仓逻辑
//! - `close_position`: 平仓逻辑

use std::collections::HashMap;
use crate::risk::{LiquidationResult, RiskConfig};
use crate::trading::{PositionManager, TradingAccount};
use crate::engine::types::EngineEvent;

use super::RiskMonitor;

/// 交易执行器
///
/// 提供交易操作的静态方法
pub(crate) struct TradingExecutor;

impl TradingExecutor {
    /// 更新价格并执行风险检查 (委托给 RiskMonitor)
    #[inline]
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
        RiskMonitor::check_and_update(
            price, current_price, symbol_prices, position_manager,
            account, risk_config, risk_assessment, pending_events,
        )
    }
}
