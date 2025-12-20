//! # 市场数据处理
//!
//! 负责 Tick 数据处理、K 线构建、指标计算

use crate::indicators;
use crate::models::{AnalysisResult, CandleHistory, OrderBook, Timeframe};
use crate::engine::data::{CandleAggregator, CandleIndicatorCalculator};
use super::MarketEngine;

/// MarketEngine 的市场数据处理方法
impl MarketEngine {
    /// 处理 Tick 数据更新
    pub(crate) fn process_tick(&mut self, order_book: &OrderBook) {
        // 1. 更新 Tick 数据
        self.tick_data.push_price(order_book.price);
        let volume = self.tick_data.estimate_volume(order_book);
        self.tick_data.push_volume(volume);

        // 2. 更新 K 线
        CandleAggregator::update_all(
            &mut self.candle_cache,
            order_book.timestamp,
            order_book.price,
            volume,
        );

        // 3. 更新价格并检查风险
        self.update_price(order_book.price);
    }

    /// 构建 K 线历史数据
    pub(crate) fn build_candle_history(&self, tf: Timeframe, timeframe_str: &str) -> CandleHistory {
        let cache = self.candle_cache.get(&tf);
        let candles = cache.map(|c| c.history.clone()).unwrap_or_default();
        let current_candle = cache.and_then(|c| c.current.clone());
        let indicators = CandleIndicatorCalculator::compute(&candles, current_candle.as_ref());

        CandleHistory {
            timeframe: timeframe_str.to_string(),
            candles,
            current_candle,
            indicators,
        }
    }

    /// 计算所有技术指标
    pub(crate) fn compute_all_indicators(&self, order_book: &OrderBook) -> AnalysisResult {
        let prices = self.tick_data.prices();
        let volumes = self.tick_data.volumes();

        AnalysisResult {
            spread: indicators::calculate_spread(&order_book.bids, &order_book.asks),
            history_length: prices.len(),
            sma_5: indicators::calculate_sma(prices, 5),
            ma_7: indicators::calculate_sma(prices, 7),
            ma_25: indicators::calculate_sma(prices, 25),
            ma_99: indicators::calculate_sma(prices, 99),
            ema_7: indicators::calculate_ema(prices, 7),
            ema_25: indicators::calculate_ema(prices, 25),
            boll: indicators::calculate_boll(prices, 20, 2.0),
            macd: indicators::calculate_macd(prices, 12, 26, 9),
            rsi_14: indicators::calculate_rsi(prices, 14),
            vol_ma_5: indicators::calculate_sma(volumes, 5),
        }
    }
}
