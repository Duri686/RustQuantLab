use super::types::RiskConfig;

impl RiskConfig {
    /// 根据名义价值获取维持保证金率 (MMR)
    ///
    /// 遍历阶梯档位，找到第一个 `max_notional >= notional_value` 的档位。
    ///
    /// # Arguments
    /// - `notional_value`: 仓位名义价值 (通常 = 仓位大小 * 当前价格)
    ///
    /// # Returns
    /// 对应档位的维持保证金率
    ///
    /// # Example
    /// ```
    /// use quant_core::RiskConfig;
    /// let config = RiskConfig::default();
    /// let mmr = config.get_maintenance_margin_rate(30_000.0);
    /// assert_eq!(mmr, 0.005); // Tier 1: 0.5%
    /// ```
    pub fn get_maintenance_margin_rate(&self, notional_value: f64) -> f64 {
        self.tiers
            .iter()
            .find(|tier| notional_value <= tier.max_notional)
            .map(|tier| tier.maintenance_margin_rate)
            .unwrap_or_else(|| {
                self.tiers
                    .last()
                    .map(|t| t.maintenance_margin_rate)
                    .unwrap_or(0.05)
            })
    }

    /// 根据名义价值获取初始保证金率 (IMR)
    ///
    /// # Arguments
    /// - `notional_value`: 仓位名义价值
    ///
    /// # Returns
    /// 对应档位的初始保证金率
    pub fn get_initial_margin_rate(&self, notional_value: f64) -> f64 {
        self.tiers
            .iter()
            .find(|tier| notional_value <= tier.max_notional)
            .map(|tier| tier.initial_margin_rate)
            .unwrap_or_else(|| {
                self.tiers
                    .last()
                    .map(|t| t.initial_margin_rate)
                    .unwrap_or(0.10)
            })
    }

    /// 计算维持保证金 (Maintenance Margin)
    ///
    /// # Arguments
    /// - `notional_value`: 仓位名义价值
    ///
    /// # Returns
    /// 维持保证金金额 = 名义价值 * MMR
    pub fn calculate_maintenance_margin(&self, notional_value: f64) -> f64 {
        let mmr = self.get_maintenance_margin_rate(notional_value);
        notional_value * mmr
    }

    /// 计算初始保证金 (Initial Margin)
    ///
    /// # Arguments
    /// - `notional_value`: 仓位名义价值
    ///
    /// # Returns
    /// 初始保证金金额 = 名义价值 * IMR
    pub fn calculate_initial_margin(&self, notional_value: f64) -> f64 {
        let imr = self.get_initial_margin_rate(notional_value);
        notional_value * imr
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_risk_config() {
        let config = RiskConfig::default();

        assert_eq!(config.get_maintenance_margin_rate(30_000.0), 0.005);
        assert_eq!(config.get_initial_margin_rate(30_000.0), 0.01);

        assert_eq!(config.get_maintenance_margin_rate(100_000.0), 0.01);

        assert_eq!(config.get_maintenance_margin_rate(500_000.0), 0.025);

        assert_eq!(config.get_maintenance_margin_rate(2_000_000.0), 0.05);
    }

    #[test]
    fn test_flat_config() {
        let config = RiskConfig::flat(0.01, 0.02);

        assert_eq!(config.get_maintenance_margin_rate(10_000.0), 0.01);
        assert_eq!(config.get_maintenance_margin_rate(10_000_000.0), 0.01);
    }
}
