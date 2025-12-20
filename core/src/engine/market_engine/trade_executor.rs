//! # 交易执行
//!
//! 负责开仓、平仓、取消挂单等交易操作

use crate::trading::OrderType;
use crate::engine::types::{CancelOrderResult, ClosePositionResult, OpenPositionRequest, OpenPositionResult};
use crate::engine::trading::{LimitOrderHandler, TradingExecutor};
use super::MarketEngine;

/// MarketEngine 的交易执行方法
impl MarketEngine {
    /// 开仓 (市价单/限价单)
    pub(crate) fn open_position_internal(&mut self, req: OpenPositionRequest) -> OpenPositionResult {
        if req.order_type == OrderType::Market {
            let timestamp = self.get_timestamp();
            return TradingExecutor::open_position(
                req,
                self.current_price,
                &mut self.position_manager,
                &mut self.account,
                &self.risk_config,
                &mut self.pending_events,
                &mut self.risk_assessment,
                || timestamp,
            );
        }

        // 限价单: 优先使用请求中的 currentPrice (前端实时价格)
        // 只有在未提供时才回退到引擎的 current_price
        let market_price = req.current_price
            .filter(|&p| p > 0.0)
            .unwrap_or(self.current_price);

        let timestamp = self.get_timestamp();
        LimitOrderHandler::create_limit_order(
            &req,
            market_price,
            &self.account,
            &self.position_manager,
            &mut self.pending_order_manager,
            &self.risk_config,
            &mut self.pending_events,
            || timestamp,
        )
    }

    /// 取消挂单
    pub(crate) fn cancel_order_internal(&mut self, order_id: &str) -> CancelOrderResult {
        LimitOrderHandler::cancel_order(
            order_id,
            &mut self.pending_order_manager,
            &mut self.pending_events,
        )
    }

    /// 平仓
    pub(crate) fn close_position_internal(
        &mut self,
        symbol: &str,
        exit_price: f64,
        close_size: Option<f64>,
        is_liquidation: bool,
    ) -> ClosePositionResult {
        TradingExecutor::close_position(
            symbol,
            exit_price,
            close_size,
            is_liquidation,
            &mut self.position_manager,
            &mut self.account,
            &mut self.pending_events,
            &mut self.risk_assessment,
        )
    }

    /// 获取时间戳 (ms)
    pub(crate) fn get_timestamp(&self) -> u64 {
        #[cfg(target_arch = "wasm32")]
        { js_sys::Date::now() as u64 }
        #[cfg(not(target_arch = "wasm32"))]
        {
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0)
        }
    }
}
