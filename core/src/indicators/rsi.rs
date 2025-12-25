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
#[must_use]
pub fn calculate_rsi(data: &[f64], period: usize) -> Option<f64> {
    if data.len() < period + 1 || period == 0 {
        return None;
    }

    let (gains, losses): (Vec<f64>, Vec<f64>) = data
        .windows(2)
        .map(|window| {
            let change = window[1] - window[0];
            if change > 0.0 {
                (change, 0.0)
            } else {
                (0.0, change.abs())
            }
        })
        .unzip();

    let start = gains.len().saturating_sub(period);
    let recent_gains = &gains[start..];
    let recent_losses = &losses[start..];

    let avg_gain: f64 = recent_gains.iter().sum::<f64>() / period as f64;
    let avg_loss: f64 = recent_losses.iter().sum::<f64>() / period as f64;

    if avg_loss == 0.0 {
        return Some(100.0);
    }

    let rs = avg_gain / avg_loss;
    Some(100.0 - (100.0 / (1.0 + rs)))
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
