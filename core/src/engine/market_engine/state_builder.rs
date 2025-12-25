//! # 状态构建
//!
//! 负责构建交易状态快照供前端使用

use crate::trading::Position;
use crate::engine::types::TradingState;
use super::MarketEngine;

/// MarketEngine 的状态构建方法
impl MarketEngine {
    /// 构建交易状态快照
    pub(crate) fn build_trading_state(&mut self) -> TradingState {
        let events = std::mem::take(&mut self.pending_events);
        let positions: Vec<Position> = self.position_manager.to_vec();
        let primary = self.position_manager.get("BTCUSDT").cloned()
            .or_else(|| positions.first().cloned());

        TradingState {
            balance: self.account.balance(),
            available_balance: self.account.calculate_available_balance(&self.position_manager),
            account_equity: self.account.calculate_account_equity(&self.position_manager),
            leverage: self.account.leverage(),
            current_price: self.current_price,
            positions,
            closed_positions: self.position_manager.closed_positions().to_vec(),
            position: primary,
            risk_assessment: self.risk_assessment.clone(),
            pending_events: events,
            pending_orders: self.pending_order_manager.to_vec(),
        }
    }
}
