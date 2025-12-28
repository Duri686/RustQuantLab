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

    let mut gains_sum = 0.0;
    let mut losses_sum = 0.0;
    for i in 1..=period {
        let change = data[i] - data[i - 1];
        if change > 0.0 {
            gains_sum += change;
        } else {
            losses_sum += -change;
        }
    }

    let mut avg_gain = gains_sum / period as f64;
    let mut avg_loss = losses_sum / period as f64;
    for i in (period + 1)..data.len() {
        let change = data[i] - data[i - 1];
        let gain = if change > 0.0 { change } else { 0.0 };
        let loss = if change < 0.0 { -change } else { 0.0 };
        avg_gain = (avg_gain * (period as f64 - 1.0) + gain) / period as f64;
        avg_loss = (avg_loss * (period as f64 - 1.0) + loss) / period as f64;
    }

    if avg_loss == 0.0 {
        if avg_gain == 0.0 {
            return Some(50.0);
        }
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
        assert_eq!(rsi, Some(50.0));
    }

    #[test]
    fn test_rsi_insufficient_data() {
        let data = vec![100.0; 10];
        assert!(calculate_rsi(&data, 14).is_none());
    }
}
