use super::types::{PositionSide, RiskLevel};

pub struct RiskCalculator;

impl RiskCalculator {
    /// 计算强平价格
    ///
    /// 永续合约强平价格公式 (简化版):
    /// - Long: 强平价 = 开仓均价 * (1 - 1/杠杆 + MMR)
    /// - Short: 强平价 = 开仓均价 * (1 + 1/杠杆 - MMR)
    ///
    /// # Arguments
    /// - `entry_price`: 开仓均价
    /// - `leverage`: 杠杆倍数
    /// - `side`: 仓位方向
    /// - `mmr`: 维持保证金率
    ///
    /// # Returns
    /// 强平价格 (f64)
    ///
    /// # Example
    /// ```
    /// use quant_core::{RiskCalculator, PositionSide};
    /// let liq_price = RiskCalculator::calculate_liquidation_price(
    ///     50000.0,  // entry_price
    ///     10,       // leverage
    ///     PositionSide::Long,
    ///     0.005,    // mmr 0.5%
    /// );
    /// // Long 10x, 强平价约 45250 (亏损 9.5%)
    /// ```
    pub fn calculate_liquidation_price(
        entry_price: f64,
        leverage: u8,
        side: PositionSide,
        mmr: f64,
    ) -> f64 {
        let leverage_f = leverage as f64;

        match side {
            PositionSide::Long => entry_price * (1.0 - 1.0 / leverage_f + mmr),
            PositionSide::Short => entry_price * (1.0 + 1.0 / leverage_f - mmr),
        }
    }

    /// 计算全仓模式强平价格
    ///
    /// 全仓模式下，强平价基于账户总权益：
    /// - Long: 强平价 = 入场价 - (账户权益 - 维持保证金) / 仓位大小
    /// - Short: 强平价 = 入场价 + (账户权益 - 维持保证金) / 仓位大小
    ///
    /// # Arguments
    /// - `entry_price`: 开仓均价
    /// - `account_equity`: 账户权益 (余额 + 未实现盈亏)
    /// - `maintenance_margin`: 维持保证金
    /// - `size`: 仓位大小
    /// - `side`: 仓位方向
    pub fn calculate_cross_liquidation_price(
        entry_price: f64,
        account_equity: f64,
        maintenance_margin: f64,
        size: f64,
        side: PositionSide,
    ) -> f64 {
        if size <= 0.0 {
            return 0.0;
        }

        let max_loss = account_equity - maintenance_margin;
        let price_buffer = max_loss / size;

        match side {
            PositionSide::Long => (entry_price - price_buffer).max(0.0),
            PositionSide::Short => entry_price + price_buffer,
        }
    }

    /// 计算未实现盈亏 (Unrealized PnL)
    ///
    /// # Arguments
    /// - `entry_price`: 开仓均价
    /// - `current_price`: 当前市价
    /// - `size`: 仓位大小
    /// - `side`: 仓位方向
    ///
    /// # Returns
    /// 未实现盈亏 (正为盈利，负为亏损)
    pub fn calculate_unrealized_pnl(
        entry_price: f64,
        current_price: f64,
        size: f64,
        side: PositionSide,
    ) -> f64 {
        let price_diff = current_price - entry_price;
        match side {
            PositionSide::Long => price_diff * size,
            PositionSide::Short => -price_diff * size,
        }
    }

    /// 计算保证金率 (Margin Ratio)
    ///
    /// 保证金率 = (钱包余额 + 未实现盈亏) / 维持保证金
    ///
    /// # Arguments
    /// - `wallet_balance`: 钱包余额
    /// - `unrealized_pnl`: 未实现盈亏
    /// - `maintenance_margin`: 维持保证金
    ///
    /// # Returns
    /// 保证金率 (> 1.0 表示安全)
    pub fn calculate_margin_ratio(
        wallet_balance: f64,
        unrealized_pnl: f64,
        maintenance_margin: f64,
    ) -> f64 {
        if maintenance_margin <= 0.0 {
            return f64::INFINITY;
        }
        (wallet_balance + unrealized_pnl) / maintenance_margin
    }

    /// 评估仓位风险等级
    ///
    /// # Arguments
    /// - `margin_ratio`: 当前保证金率
    /// - `warning_threshold`: 预警阈值 (MMR 的倍数)
    ///
    /// # Returns
    /// 风险等级
    pub fn evaluate_risk_level(margin_ratio: f64, warning_threshold: f64) -> RiskLevel {
        if margin_ratio <= 1.0 {
            RiskLevel::Critical
        } else if margin_ratio <= warning_threshold {
            RiskLevel::High
        } else if margin_ratio <= warning_threshold * 1.5 {
            RiskLevel::Medium
        } else if margin_ratio <= warning_threshold * 2.0 {
            RiskLevel::Low
        } else {
            RiskLevel::Safe
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_liquidation_price_long() {
        let liq_price = RiskCalculator::calculate_liquidation_price(
            50_000.0,
            10,
            PositionSide::Long,
            0.005,
        );
        assert!((liq_price - 45_250.0).abs() < 0.01);
    }

    #[test]
    fn test_liquidation_price_short() {
        let liq_price = RiskCalculator::calculate_liquidation_price(
            50_000.0,
            10,
            PositionSide::Short,
            0.005,
        );
        assert!((liq_price - 54_750.0).abs() < 0.01);
    }

    #[test]
    fn test_unrealized_pnl() {
        let pnl = RiskCalculator::calculate_unrealized_pnl(
            50_000.0,
            51_000.0,
            0.1,
            PositionSide::Long,
        );
        assert_eq!(pnl, 100.0);

        let pnl = RiskCalculator::calculate_unrealized_pnl(
            50_000.0,
            51_000.0,
            0.1,
            PositionSide::Short,
        );
        assert_eq!(pnl, -100.0);
    }

    #[test]
    fn test_margin_ratio() {
        let ratio = RiskCalculator::calculate_margin_ratio(1000.0, -200.0, 250.0);
        assert!((ratio - 3.2).abs() < 0.001);
    }

    #[test]
    fn test_risk_level() {
        assert_eq!(
            RiskCalculator::evaluate_risk_level(0.5, 1.5),
            RiskLevel::Critical
        );
        assert_eq!(
            RiskCalculator::evaluate_risk_level(1.2, 1.5),
            RiskLevel::High
        );
        assert_eq!(
            RiskCalculator::evaluate_risk_level(2.0, 1.5),
            RiskLevel::Medium
        );
        assert_eq!(
            RiskCalculator::evaluate_risk_level(2.5, 1.5),
            RiskLevel::Low
        );
        assert_eq!(
            RiskCalculator::evaluate_risk_level(5.0, 1.5),
            RiskLevel::Safe
        );
    }
}
