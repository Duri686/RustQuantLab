//! # K 线聚合模块
//!
//! 负责多时间周期 K 线的生成和技术指标计算。
//!
//! ## 职责
//! - K 线缓存管理 (CandleCache)
//! - 多周期 K 线聚合
//! - 基于 K 线的指标历史计算

use std::collections::HashMap;
use crate::indicators;
use crate::models::{Candle, IndicatorHistory, Timeframe};

// ============================================================================
// 常量
// ============================================================================

/// K 线历史最大容量
pub(crate) const MAX_CANDLE_HISTORY: usize = 2000;

// ============================================================================
// K 线缓存
// ============================================================================

/// K 线缓存结构
#[derive(Debug, Clone)]
pub(crate) struct CandleCache {
    /// 已完成的 K 线历史
    pub history: Vec<Candle>,
    /// 当前正在形成的 K 线
    pub current: Option<Candle>,
}

impl CandleCache {
    pub fn new() -> Self {
        CandleCache {
            history: Vec::with_capacity(MAX_CANDLE_HISTORY),
            current: None,
        }
    }

    /// 加载历史 K 线数据
    ///
    /// 将外部生成的历史 K 线加载到缓存中，后续实时 tick 会继续在此基础上聚合
    /// 最后一根 K 线设为 current，确保实时数据无缝衔接
    pub fn load_history(&mut self, candles: Vec<Candle>) {
        // 清空现有数据
        self.history.clear();
        self.current = None;

        if candles.is_empty() {
            return;
        }

        // 限制最大容量
        let start_idx = if candles.len() > MAX_CANDLE_HISTORY {
            candles.len() - MAX_CANDLE_HISTORY
        } else {
            0
        };

        let mut candles: Vec<Candle> = candles.into_iter().skip(start_idx).collect();

        // 最后一根 K 线设为 current，实时 tick 会继续在此基础上更新
        // 这确保了 24/7 市场的 K 线连续性，没有断裂
        self.current = candles.pop();

        // 其余放入历史
        self.history.extend(candles);
    }
}

// ============================================================================
// K 线聚合器
// ============================================================================

/// K 线聚合器
///
/// 管理多时间周期的 K 线缓存和更新逻辑
pub(crate) struct CandleAggregator;

impl CandleAggregator {
    /// 更新所有时间周期的 K 线
    ///
    /// 对每个支持的时间周期进行 K 线聚合
    pub fn update_all(
        candle_cache: &mut HashMap<Timeframe, CandleCache>,
        timestamp: u64,
        price: f64,
        volume: f64,
    ) {
        // 更新所有支持的时间周期
        let timeframes = [
            Timeframe::S1,
            Timeframe::M1,
            Timeframe::M5,
            Timeframe::M15,
            Timeframe::H1,
            Timeframe::H4,
            Timeframe::D1,
        ];

        for tf in timeframes {
            Self::update_single(candle_cache, tf, timestamp, price, volume);
        }
    }

    /// 从 1s K 线历史聚合到所有高周期
    ///
    /// 接收 1s K 线数据，自动聚合到 1m/5m/15m/1H/4H/1D
    /// 返回各周期加载的 K 线数量
    pub fn aggregate_history_from_1m(
        candle_cache: &mut HashMap<Timeframe, CandleCache>,
        candles_s1: Vec<Candle>,
    ) -> Vec<(String, usize)> {
        let mut results = Vec::new();

        // 1. 直接加载 1s 到缓存
        let s1_count = candles_s1.len();
        let cache_s1 = candle_cache.entry(Timeframe::S1).or_insert_with(CandleCache::new);
        cache_s1.load_history(candles_s1.clone());
        results.push(("1s".to_string(), s1_count));

        // 2. 聚合到高周期
        let higher_timeframes = [
            Timeframe::M1,
            Timeframe::M5,
            Timeframe::M15,
            Timeframe::H1,
            Timeframe::H4,
            Timeframe::D1,
        ];

        for tf in higher_timeframes {
            let aggregated = Self::aggregate_candles(&candles_s1, tf);
            let count = aggregated.len();
            let cache = candle_cache.entry(tf).or_insert_with(CandleCache::new);
            cache.load_history(aggregated);
            results.push((tf.as_str().to_string(), count));
        }

        results
    }

    /// 将低周期 K 线聚合为高周期
    fn aggregate_candles(source: &[Candle], target_tf: Timeframe) -> Vec<Candle> {
        if source.is_empty() {
            return Vec::new();
        }

        let mut result: Vec<Candle> = Vec::new();
        let mut current: Option<Candle> = None;

        for candle in source {
            // 将时间对齐到目标周期
            let aligned_time = target_tf.align_timestamp(candle.time);

            match &mut current {
                Some(curr) if curr.time == aligned_time => {
                    // 同一周期，合并 OHLCV
                    curr.high = curr.high.max(candle.high);
                    curr.low = curr.low.min(candle.low);
                    curr.close = candle.close;
                    curr.volume += candle.volume;
                    curr.tick_count += candle.tick_count;
                }
                Some(curr) => {
                    // 新周期，保存当前 K 线，开始新的
                    result.push(curr.clone());
                    *curr = Candle {
                        time: aligned_time,
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: candle.volume,
                        tick_count: candle.tick_count,
                    };
                }
                None => {
                    // 首根 K 线
                    current = Some(Candle {
                        time: aligned_time,
                        open: candle.open,
                        high: candle.high,
                        low: candle.low,
                        close: candle.close,
                        volume: candle.volume,
                        tick_count: candle.tick_count,
                    });
                }
            }
        }

        // 最后一根 K 线
        if let Some(curr) = current {
            result.push(curr);
        }

        result
    }

    /// 更新指定时间周期的 K 线
    ///
    /// K 线聚合逻辑:
    /// 1. 如果无当前 K 线，创建新 K 线
    /// 2. 如果时间戳属于当前 K 线周期，更新 OHLCV
    /// 3. 如果时间戳属于新周期，将当前 K 线移入历史，创建新 K 线
    pub fn update_single(
        candle_cache: &mut HashMap<Timeframe, CandleCache>,
        tf: Timeframe,
        timestamp: u64,
        price: f64,
        volume: f64,
    ) {
        // 获取或创建缓存
        let cache = candle_cache.entry(tf).or_insert_with(CandleCache::new);

        // 将时间戳对齐到当前周期起始点
        let aligned_time = tf.align_timestamp(timestamp);

        match &mut cache.current {
            Some(current_candle) => {
                if current_candle.time == aligned_time {
                    // 同一周期，更新 K 线
                    current_candle.update(price, volume);
                } else {
                    // 新周期，将当前 K 线移入历史
                    let completed = current_candle.clone();
                    cache.history.push(completed);

                    // 维护历史容量
                    if cache.history.len() > MAX_CANDLE_HISTORY {
                        let overflow = cache.history.len() - MAX_CANDLE_HISTORY;
                        cache.history.drain(0..overflow);
                    }

                    // 创建新 K 线
                    *current_candle = Candle::new(aligned_time, price, volume);
                }
            }
            None => {
                // 首次创建 K 线
                cache.current = Some(Candle::new(aligned_time, price, volume));
            }
        }
    }
}

// ============================================================================
// K 线指标计算
// ============================================================================

/// K 线指标计算器
pub(crate) struct CandleIndicatorCalculator;

impl CandleIndicatorCalculator {
    /// 基于 K 线收盘价计算完整的指标历史
    ///
    /// 此方法为每根 K 线计算对应位置的指标值，确保指标数据与 K 线数据长度对齐
    pub fn compute(candles: &[Candle], current: Option<&Candle>) -> IndicatorHistory {
        // 收集所有收盘价（包括当前正在形成的 K 线）
        let mut closes: Vec<f64> = candles.iter().map(|c| c.close).collect();
        if let Some(curr) = current {
            closes.push(curr.close);
        }

        let total_len = closes.len();
        if total_len == 0 {
            return IndicatorHistory::default();
        }

        // 预分配指标数组
        let mut ma7 = Vec::with_capacity(total_len);
        let mut ma25 = Vec::with_capacity(total_len);
        let mut ma99 = Vec::with_capacity(total_len);
        let mut ema7 = Vec::with_capacity(total_len);
        let mut ema25 = Vec::with_capacity(total_len);
        let mut boll_upper = Vec::with_capacity(total_len);
        let mut boll_mid = Vec::with_capacity(total_len);
        let mut boll_lower = Vec::with_capacity(total_len);
        let mut macd_dif = Vec::with_capacity(total_len);
        let mut macd_dea = Vec::with_capacity(total_len);
        let mut macd_hist = Vec::with_capacity(total_len);
        let mut rsi14 = Vec::with_capacity(total_len);

        // 为每个位置计算指标（使用该位置及之前的数据）
        for i in 0..total_len {
            let slice = &closes[..=i];
            
            // MA
            ma7.push(indicators::calculate_sma(slice, 7));
            ma25.push(indicators::calculate_sma(slice, 25));
            ma99.push(indicators::calculate_sma(slice, 99));

            // EMA
            ema7.push(indicators::calculate_ema(slice, 7));
            ema25.push(indicators::calculate_ema(slice, 25));

            // BOLL
            if let Some(boll) = indicators::calculate_boll(slice, 20, 2.0) {
                boll_upper.push(Some(boll.upper));
                boll_mid.push(Some(boll.mid));
                boll_lower.push(Some(boll.lower));
            } else {
                boll_upper.push(None);
                boll_mid.push(None);
                boll_lower.push(None);
            }

            // MACD
            if let Some(macd) = indicators::calculate_macd(slice, 12, 26, 9) {
                macd_dif.push(Some(macd.dif));
                macd_dea.push(Some(macd.dea));
                macd_hist.push(Some(macd.hist));
            } else {
                macd_dif.push(None);
                macd_dea.push(None);
                macd_hist.push(None);
            }

            // RSI
            rsi14.push(indicators::calculate_rsi(slice, 14));
        }

        IndicatorHistory {
            ma7,
            ma25,
            ma99,
            ema7,
            ema25,
            boll_upper,
            boll_mid,
            boll_lower,
            macd_dif,
            macd_dea,
            macd_hist,
            rsi14,
        }
    }
}
