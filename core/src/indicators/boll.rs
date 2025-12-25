use crate::models::BollResult;

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
#[must_use]
pub fn calculate_boll(data: &[f64], period: usize, std_dev_multiplier: f64) -> Option<BollResult> {
    if data.len() < period || period == 0 {
        return None;
    }

    let start = data.len() - period;
    let slice = &data[start..];

    let mean: f64 = slice.iter().sum::<f64>() / period as f64;

    let variance: f64 = slice
        .iter()
        .map(|&x| (x - mean).powi(2))
        .sum::<f64>() / period as f64;
    let std_dev = variance.sqrt();

    Some(BollResult {
        upper: mean + std_dev_multiplier * std_dev,
        mid: mean,
        lower: mean - std_dev_multiplier * std_dev,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
