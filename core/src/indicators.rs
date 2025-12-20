//! # 技术指标计算库
//!
//! 纯数学函数模块，无状态，易于测试。
//! 所有函数接收数据切片和参数，返回计算结果。
//!
//! ## 设计原则
//! - **无状态**: 函数不依赖任何外部状态
//! - **纯函数**: 相同输入始终产生相同输出
//! - **优雅降级**: 数据不足时返回 `None`

use crate::models::{BollResult, MacdResult};

// ============================================================================
// 移动平均线 (Moving Averages)
// ============================================================================

/// 简单移动平均线 (Simple Moving Average)
///
/// SMA = Σ(Price) / N
///
/// # 参数
/// - `data`: 价格数据切片
/// - `period`: 计算周期
///
/// # 返回
/// - `Some(f64)`: 计算结果
/// - `None`: 数据不足
///
/// # 示例
/// ```
/// use quant_core::indicators::calculate_sma;
///
/// let prices = vec![10.0, 20.0, 30.0, 40.0, 50.0];
/// let sma = calculate_sma(&prices, 3);
/// assert_eq!(sma, Some(40.0)); // (30 + 40 + 50) / 3
/// ```
pub fn calculate_sma(data: &[f64], period: usize) -> Option<f64> {
    if data.len() < period || period == 0 {
        return None;
    }

    let start = data.len() - period;
    let sum: f64 = data[start..].iter().sum();
    Some(sum / period as f64)
}

/// 指数移动平均线 (Exponential Moving Average)
///
/// EMA = Price(t) × k + EMA(t-1) × (1 - k)
/// k = 2 / (N + 1)
///
/// # 参数
/// - `data`: 价格数据切片
/// - `period`: 计算周期
///
/// # 返回
/// - `Some(f64)`: 计算结果
/// - `None`: 数据不足
pub fn calculate_ema(data: &[f64], period: usize) -> Option<f64> {
    if data.len() < period || period == 0 {
        return None;
    }

    let k = 2.0 / (period as f64 + 1.0);

    // 使用前 period 个数据的 SMA 作为初始 EMA
    let initial_sma: f64 = data[..period].iter().sum::<f64>() / period as f64;

    // 从 period 位置开始迭代计算 EMA
    let mut ema = initial_sma;
    for &price in &data[period..] {
        ema = price * k + ema * (1.0 - k);
    }

    Some(ema)
}

// ============================================================================
// 布林带 (Bollinger Bands)
// ============================================================================

/// 布林带 (Bollinger Bands)
///
/// - Upper = MA + (k × σ)
/// - Mid = MA(period)
/// - Lower = MA - (k × σ)
///
/// # 参数
/// - `data`: 价格数据切片
/// - `period`: MA 周期 (通常 20)
/// - `std_dev_multiplier`: 标准差倍数 (通常 2.0)
///
/// # 返回
/// - `Some(BollResult)`: 包含上、中、下轨值
/// - `None`: 数据不足
pub fn calculate_boll(data: &[f64], period: usize, std_dev_multiplier: f64) -> Option<BollResult> {
    if data.len() < period || period == 0 {
        return None;
    }

    let start = data.len() - period;
    let slice = &data[start..];

    // 计算均值 (中轨)
    let mean: f64 = slice.iter().sum::<f64>() / period as f64;

    // 计算标准差
    let variance: f64 = slice.iter().map(|&x| (x - mean).powi(2)).sum::<f64>() / period as f64;
    let std_dev = variance.sqrt();

    Some(BollResult {
        upper: mean + std_dev_multiplier * std_dev,
        mid: mean,
        lower: mean - std_dev_multiplier * std_dev,
    })
}

// ============================================================================
// MACD (Moving Average Convergence Divergence)
// ============================================================================

/// MACD 指标
///
/// - DIF = EMA(fast) - EMA(slow)
/// - DEA = EMA(DIF, signal)
/// - Histogram = (DIF - DEA) × 2
///
/// # 参数
/// - `data`: 价格数据切片
/// - `fast`: 快线周期 (通常 12)
/// - `slow`: 慢线周期 (通常 26)
/// - `signal`: 信号线周期 (通常 9)
///
/// # 返回
/// - `Some(MacdResult)`: 包含 DIF、DEA、Histogram
/// - `None`: 数据不足 (需要 slow + signal 个数据点)
pub fn calculate_macd(data: &[f64], fast: usize, slow: usize, signal: usize) -> Option<MacdResult> {
    if data.len() < slow + signal || fast == 0 || slow == 0 || signal == 0 {
        return None;
    }

    let k_fast = 2.0 / (fast as f64 + 1.0);
    let k_slow = 2.0 / (slow as f64 + 1.0);
    let k_signal = 2.0 / (signal as f64 + 1.0);

    // 计算 EMA fast (当前值)
    let mut ema_fast: f64 = data[..fast].iter().sum::<f64>() / fast as f64;
    for &price in &data[fast..] {
        ema_fast = price * k_fast + ema_fast * (1.0 - k_fast);
    }

    // 计算 EMA slow (当前值)
    let mut ema_slow: f64 = data[..slow].iter().sum::<f64>() / slow as f64;
    for &price in &data[slow..] {
        ema_slow = price * k_slow + ema_slow * (1.0 - k_slow);
    }

    // 当前 DIF
    let dif = ema_fast - ema_slow;

    // 重新计算 DIF 历史以获取 DEA
    let mut dif_history: Vec<f64> = Vec::with_capacity(data.len() - slow);

    let mut ema_fast_hist = data[..fast].iter().sum::<f64>() / fast as f64;
    let mut ema_slow_hist = data[..slow].iter().sum::<f64>() / slow as f64;

    for i in slow..data.len() {
        if i >= fast {
            ema_fast_hist = data[i] * k_fast + ema_fast_hist * (1.0 - k_fast);
        }
        ema_slow_hist = data[i] * k_slow + ema_slow_hist * (1.0 - k_slow);
        dif_history.push(ema_fast_hist - ema_slow_hist);
    }

    // 计算 DEA (DIF 的 EMA)
    if dif_history.len() < signal {
        return Some(MacdResult {
            dif,
            dea: dif,
            hist: 0.0,
        });
    }

    let mut dea: f64 = dif_history[..signal].iter().sum::<f64>() / signal as f64;
    for &d in &dif_history[signal..] {
        dea = d * k_signal + dea * (1.0 - k_signal);
    }

    Some(MacdResult {
        dif,
        dea,
        hist: (dif - dea) * 2.0,
    })
}

// ============================================================================
// RSI (Relative Strength Index)
// ============================================================================

/// 相对强弱指数 (RSI)
///
/// RSI = 100 - (100 / (1 + RS))
/// RS = Average Gain / Average Loss
///
/// # 参数
/// - `data`: 价格数据切片
/// - `period`: 计算周期 (通常 14)
///
/// # 返回
/// - `Some(f64)`: RSI 值 (0-100)
/// - `None`: 数据不足 (需要 period + 1 个数据点)
pub fn calculate_rsi(data: &[f64], period: usize) -> Option<f64> {
    if data.len() < period + 1 || period == 0 {
        return None;
    }

    let mut gains: Vec<f64> = Vec::with_capacity(data.len() - 1);
    let mut losses: Vec<f64> = Vec::with_capacity(data.len() - 1);

    // 计算价格变动
    for i in 1..data.len() {
        let change = data[i] - data[i - 1];
        if change > 0.0 {
            gains.push(change);
            losses.push(0.0);
        } else {
            gains.push(0.0);
            losses.push(change.abs());
        }
    }

    // 取最近 period 个数据
    let start = gains.len().saturating_sub(period);
    let recent_gains = &gains[start..];
    let recent_losses = &losses[start..];

    let avg_gain: f64 = recent_gains.iter().sum::<f64>() / period as f64;
    let avg_loss: f64 = recent_losses.iter().sum::<f64>() / period as f64;

    // 避免除以零
    if avg_loss == 0.0 {
        return Some(100.0);
    }

    let rs = avg_gain / avg_loss;
    Some(100.0 - (100.0 / (1.0 + rs)))
}

// ============================================================================
// 辅助函数
// ============================================================================

/// 计算买卖价差
///
/// Spread = Best Ask - Best Bid
///
/// # 参数
/// - `bids`: 买单列表 [(价格, 数量), ...]
/// - `asks`: 卖单列表 [(价格, 数量), ...]
///
/// # 返回
/// 价差值 (如果订单簿为空则返回 0.0)
pub fn calculate_spread(bids: &[(f64, f64)], asks: &[(f64, f64)]) -> f64 {
    let best_bid = bids.first().map(|(p, _)| *p).unwrap_or(0.0);
    let best_ask = asks.first().map(|(p, _)| *p).unwrap_or(0.0);
    best_ask - best_bid
}

// ============================================================================
// 单元测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ========== SMA 测试 ==========

    #[test]
    fn test_sma_basic() {
        let data = vec![10.0, 20.0, 30.0, 40.0, 50.0];
        assert_eq!(calculate_sma(&data, 5), Some(30.0));
        assert_eq!(calculate_sma(&data, 3), Some(40.0));
    }

    #[test]
    fn test_sma_insufficient_data() {
        let data = vec![10.0, 20.0, 30.0];
        assert_eq!(calculate_sma(&data, 5), None);
        assert_eq!(calculate_sma(&data, 4), None);
        assert_eq!(calculate_sma(&data, 3), Some(20.0));
    }

    #[test]
    fn test_sma_edge_cases() {
        assert_eq!(calculate_sma(&[], 1), None);
        assert_eq!(calculate_sma(&[100.0], 0), None);
        assert_eq!(calculate_sma(&[100.0], 1), Some(100.0));
    }

    // ========== EMA 测试 ==========

    #[test]
    fn test_ema_basic() {
        let data = vec![10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0];
        let ema = calculate_ema(&data, 3);
        assert!(ema.is_some());
        let ema_val = ema.unwrap();
        assert!(ema_val > 50.0 && ema_val < 70.0);
    }

    #[test]
    fn test_ema_exact_period() {
        let data = vec![10.0, 20.0, 30.0];
        let ema = calculate_ema(&data, 3);
        let sma = calculate_sma(&data, 3);
        assert_eq!(ema, sma);
    }

    #[test]
    fn test_ema_insufficient_data() {
        let data = vec![10.0, 20.0];
        assert_eq!(calculate_ema(&data, 3), None);
    }

    // ========== Bollinger Bands 测试 ==========

    #[test]
    fn test_boll_basic() {
        let data: Vec<f64> = (1..=20).map(|x| x as f64 * 100.0).collect();
        let boll = calculate_boll(&data, 20, 2.0);
        assert!(boll.is_some());
        let boll = boll.unwrap();
        assert!(boll.upper > boll.mid);
        assert!(boll.mid > boll.lower);
    }

    #[test]
    fn test_boll_flat_prices() {
        let data = vec![100.0; 20];
        let boll = calculate_boll(&data, 20, 2.0);
        assert!(boll.is_some());
        let boll = boll.unwrap();
        assert_eq!(boll.upper, 100.0);
        assert_eq!(boll.mid, 100.0);
        assert_eq!(boll.lower, 100.0);
    }

    #[test]
    fn test_boll_symmetry() {
        let data: Vec<f64> = (1..=20).map(|x| x as f64 * 10.0).collect();
        let boll = calculate_boll(&data, 20, 2.0).unwrap();
        let upper_diff = boll.upper - boll.mid;
        let lower_diff = boll.mid - boll.lower;
        assert!((upper_diff - lower_diff).abs() < 0.0001);
    }

    // ========== RSI 测试 ==========

    #[test]
    fn test_rsi_uptrend() {
        let data: Vec<f64> = (1..=20).map(|x| x as f64 * 100.0).collect();
        let rsi = calculate_rsi(&data, 14);
        assert!(rsi.is_some());
        assert!(rsi.unwrap() > 90.0);
    }

    #[test]
    fn test_rsi_downtrend() {
        let data: Vec<f64> = (1..=20).rev().map(|x| x as f64 * 100.0).collect();
        let rsi = calculate_rsi(&data, 14);
        assert!(rsi.is_some());
        assert!(rsi.unwrap() < 10.0);
    }

    #[test]
    fn test_rsi_flat() {
        let data = vec![100.0; 20];
        let rsi = calculate_rsi(&data, 14);
        assert_eq!(rsi, Some(100.0));
    }

    #[test]
    fn test_rsi_insufficient_data() {
        let data = vec![100.0; 10];
        assert!(calculate_rsi(&data, 14).is_none());
    }

    // ========== MACD 测试 ==========

    #[test]
    fn test_macd_basic() {
        let data: Vec<f64> = (1..=50).map(|x| 40000.0 + (x as f64) * 10.0).collect();
        let macd = calculate_macd(&data, 12, 26, 9);
        assert!(macd.is_some());
        let macd = macd.unwrap();
        assert!(macd.dif > 0.0);
    }

    #[test]
    fn test_macd_histogram_formula() {
        let data: Vec<f64> = (1..=60).map(|x| 100.0 + x as f64).collect();
        let macd = calculate_macd(&data, 12, 26, 9).unwrap();
        let expected_hist = (macd.dif - macd.dea) * 2.0;
        assert!((macd.hist - expected_hist).abs() < 0.0001);
    }

    #[test]
    fn test_macd_insufficient_data() {
        let data = vec![100.0; 30];
        assert!(calculate_macd(&data, 12, 26, 9).is_none());
    }

    // ========== Spread 测试 ==========

    #[test]
    fn test_spread_basic() {
        let bids = vec![(39990.0, 1.0), (39980.0, 2.0)];
        let asks = vec![(40010.0, 1.0), (40020.0, 2.0)];
        assert_eq!(calculate_spread(&bids, &asks), 20.0);
    }

    #[test]
    fn test_spread_empty() {
        assert_eq!(calculate_spread(&[], &[]), 0.0);
    }
}
