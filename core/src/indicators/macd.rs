use crate::models::MacdResult;

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
#[must_use]
pub fn calculate_macd(
    data: &[f64],
    fast: usize,
    slow: usize,
    signal: usize,
) -> Option<MacdResult> {
    if data.len() < slow + signal || fast == 0 || slow == 0 || signal == 0 {
        return None;
    }

    let k_fast = 2.0 / (fast as f64 + 1.0);
    let k_slow = 2.0 / (slow as f64 + 1.0);
    let k_signal = 2.0 / (signal as f64 + 1.0);

    let mut ema_fast: f64 = data[..fast].iter().sum::<f64>() / fast as f64;
    for &price in &data[fast..] {
        ema_fast = price * k_fast + ema_fast * (1.0 - k_fast);
    }

    let mut ema_slow: f64 = data[..slow].iter().sum::<f64>() / slow as f64;
    for &price in &data[slow..] {
        ema_slow = price * k_slow + ema_slow * (1.0 - k_slow);
    }

    let dif = ema_fast - ema_slow;

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
        hist: (dif - dea),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

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
        let expected_hist = macd.dif - macd.dea;
        assert!((macd.hist - expected_hist).abs() < 0.0001);
    }

    #[test]
    fn test_macd_insufficient_data() {
        let data = vec![100.0; 30];
        assert!(calculate_macd(&data, 12, 26, 9).is_none());
    }
}
