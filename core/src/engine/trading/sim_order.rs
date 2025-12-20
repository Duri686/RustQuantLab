//! # 模拟订单模块
//!
//! 处理模拟订单的价格冲击计算和执行。

use crate::models::{SimOrder, SimOrderResult, SimOrderSide};

/// 模拟订单执行器
pub(crate) struct SimOrderExecutor;

impl SimOrderExecutor {
    /// 执行模拟订单
    ///
    /// 计算价格冲击并返回执行结果
    pub fn execute(order: &SimOrder, current_price: f64) -> SimOrderResult {
        let order_value = order.price * order.size;

        // 价格冲击模型
        let impact = Self::calculate_price_impact(current_price, order.size, order_value, &order.side);
        let executed_price = current_price + impact;
        
        // 成交量放大
        let volume_multiplier = 1.5 + (order.size * 0.5).min(1.5);
        let executed_volume = order.size * volume_multiplier;

        let side_str = match order.side {
            SimOrderSide::Buy => "buy",
            SimOrderSide::Sell => "sell",
        };

        SimOrderResult {
            success: true,
            executed_price,
            price_impact: impact,
            executed_volume,
            side: side_str.to_string(),
            message: format!(
                "订单已执行: {} {} BTC @ {:.2} USDT, 价格影响 {:.2}",
                side_str, order.size, executed_price, impact
            ),
        }
    }

    /// 计算价格冲击
    fn calculate_price_impact(price: f64, size: f64, value: f64, side: &SimOrderSide) -> f64 {
        let base_rate = 0.0001;
        let size_mult = (1.0 + size.ln().abs()).min(5.0);
        let impact_pct = base_rate * size_mult * (value / 10000.0).min(1.0);

        match side {
            SimOrderSide::Buy => price * impact_pct,
            SimOrderSide::Sell => -price * impact_pct,
        }
    }
}
