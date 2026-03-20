//! # 风控处理
//!
//! 负责价格更新、挂单触发、风险检查、强平执行

use crate::risk::PositionSide;
use crate::trading::OrderType;
use crate::engine::types::{EngineEvent, OpenPositionRequest};
use crate::engine::trading::TradingExecutor;
use super::MarketEngine;

/// MarketEngine 的风控处理方法
impl MarketEngine {
    /// 更新价格并执行风险检查
    pub(crate) fn update_price(&mut self, price: f64) {
        self.process_pending_orders(price);
        self.process_risk_check(price);
    }

    /// 检查并执行触发的挂单
    fn process_pending_orders(&mut self, price: f64) {
        let timestamp = self.get_timestamp();
        for order in self.pending_order_manager.check_triggers(price, timestamp) {
            self.emit_order_filled(&order, price);
            self.execute_market_order_from_pending(order, price);
        }
    }

    /// 执行风险检查和强平
    fn process_risk_check(&mut self, price: f64) {
        let to_liquidate = TradingExecutor::update_price(
            price,
            &mut self.current_price,
            &mut self.symbol_prices,
            &mut self.position_manager,
            &self.account,
            &self.risk_config,
            &mut self.risk_assessment,
            &mut self.pending_events,
        );

        for key in to_liquidate {
            let symbol = Self::extract_symbol(&key);
            let pos_price = *self.symbol_prices.get(&symbol).unwrap_or(&price);
            self.close_position_internal(&key, pos_price, None, true);
        }
    }

    /// 发送挂单成交事件
    fn emit_order_filled(&mut self, order: &crate::trading::PendingOrder, fill_price: f64) {
        self.pending_events.push(EngineEvent::LimitOrderFilled {
            order_id: order.id.clone(),
            symbol: order.symbol.clone(),
            side: order.side.to_string(),
            size: order.size,
            fill_price,
        });
    }

    /// 从挂单执行市价单
    fn execute_market_order_from_pending(&mut self, order: crate::trading::PendingOrder, price: f64) {
        let req = OpenPositionRequest {
            symbol: order.symbol,
            side: if order.side == PositionSide::Long { "long" } else { "short" }.to_string(),
            size: order.size,
            price: Some(price),
            current_price: None,
            leverage: Some(order.leverage),
            margin_mode: order.margin_mode,
            order_type: OrderType::Market,
        };
        let ts = self.get_timestamp();
        let _ = TradingExecutor::open_position(
            req, price, &mut self.position_manager, &mut self.account,
            &self.risk_config, &mut self.pending_events, &mut self.risk_assessment, || ts,
        );
    }

    /// 从 position_key 提取 symbol
    pub(crate) fn extract_symbol(key: &str) -> String {
        key.rsplit_once('_').map(|(s, _)| s.to_string()).unwrap_or_else(|| key.to_string())
    }
}
