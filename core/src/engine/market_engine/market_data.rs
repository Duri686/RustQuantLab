//! # 市场数据处理
//!
//! 负责 Tick 数据处理、K 线构建、指标计算

use crate::indicators;
use crate::models::{AnalysisResult, CandleHistory, IndicatorHistory, OrderBook, Timeframe};
use crate::engine::data::{CandleAggregator, CandleIndicatorCalculator};
use super::MarketEngine;

/// MarketEngine 的市场数据处理方法
impl MarketEngine {
    /// 处理 Tick 数据更新
    pub(crate) fn process_tick(&mut self, order_book: &OrderBook) {
        // 1. 更新 Tick 数据
        self.tick_data.push_price(order_book.price);
        
        let volume = if let Some(provided_volume) = order_book.volume {
            provided_volume
        } else {
            self.tick_data.estimate_volume(order_book)
        };
        
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
    ///
    /// 使用缓存的指标历史（与已完成 K 线对齐），仅对当前正在形成的 K 线
    /// 增量计算一次指标值。相比之前的 O(n²) 全量重算，降为 O(n)。
    ///
    /// 前端 allCandles = candles + currentCandle，指标数组长度与之对齐。
    pub(crate) fn build_candle_history(&self, tf: Timeframe, timeframe_str: &str) -> CandleHistory {
        let cache = self.candle_cache.get(&tf);
        let candles = cache.map(|c| c.history.clone()).unwrap_or_default();
        let current_candle = cache.and_then(|c| c.current.clone());

        // 使用缓存的指标（已完成 K 线部分）+ 增量计算当前 K 线的指标
        let indicators = match cache {
            Some(c) => {
                let mut ind = c.cached_indicators.clone();
                if let Some(curr) = &current_candle {
                    // 只为当前 K 线计算一次指标（O(n) 而非 O(n²)）
                    let mut closes: Vec<f64> = candles.iter().map(|c| c.close).collect();
                    closes.push(curr.close);
                    CandleIndicatorCalculator::append_last(&mut ind, &closes);
                }
                ind
            }
            None => IndicatorHistory::default(),
        };

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
