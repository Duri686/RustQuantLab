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
#[inline]
#[must_use]
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
#[inline]
#[must_use]
pub fn calculate_ema(data: &[f64], period: usize) -> Option<f64> {
    if data.len() < period || period == 0 {
        return None;
    }

    let k = 2.0 / (period as f64 + 1.0);
    let initial_sma: f64 = data[..period].iter().sum::<f64>() / period as f64;

    let ema = data[period..]
        .iter()
        .fold(initial_sma, |acc, &price| price * k + acc * (1.0 - k));

    Some(ema)
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
