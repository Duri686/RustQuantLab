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

#[cfg(test)]
mod tests {
    use super::*;

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
