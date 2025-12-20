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
