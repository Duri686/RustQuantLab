//! # 风控与强平引擎 (Risk & Liquidation Engine)
//!
//! 实现 P0 架构任务：将风控逻辑完全迁移至 Rust Core。
//!
//! ## 核心功能
//! - 阶梯保证金率 (Tiered Margin Rate)
//! - 强平价格计算 (Liquidation Price Calculation)
//! - 保证金追缴逻辑 (Margin Call Logic)
//!
//! ## 设计原则
//! - 使用 `f64` 进行所有金融计算，保证精度
//! - 纯 Rust 实现，无 web-sys 依赖
//! - 类型安全，防止无效状态

use serde::{Deserialize, Serialize};

// ============================================================================
// 阶梯保证金配置 (Tiered Margin)
// ============================================================================

/// 单个保证金档位
///
/// 定义某一名义价值区间对应的保证金率。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarginTier {
    /// 该档位的最大名义价值 (USDT)
    /// 使用 `f64::INFINITY` 表示无上限
    pub max_notional: f64,

    /// 维持保证金率 (Maintenance Margin Rate)
    /// 例如: 0.005 表示 0.5%
    pub maintenance_margin_rate: f64,

    /// 初始保证金率 (Initial Margin Rate)
    /// 例如: 0.01 表示 1%
    pub initial_margin_rate: f64,
}

impl MarginTier {
    /// 创建新的保证金档位
    pub fn new(max_notional: f64, mmr: f64, imr: f64) -> Self {
        Self {
            max_notional,
            maintenance_margin_rate: mmr,
            initial_margin_rate: imr,
        }
    }
}

/// 风控配置
///
/// 包含阶梯保证金率和其他风控参数。
/// 默认配置模拟主流交易所的 BTCUSDT 永续合约。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskConfig {
    /// 阶梯保证金档位列表
    /// 必须按 `max_notional` 升序排列
    pub tiers: Vec<MarginTier>,

    /// 强平手续费率
    /// 例如: 0.0005 表示 0.05%
    pub liquidation_fee_rate: f64,

    /// 预警保证金率阈值
    /// 当保证金率低于此值时触发预警 (相对于 MMR 的倍数)
    /// 例如: 1.5 表示 MMR * 1.5 时预警
    pub margin_warning_threshold: f64,
}

impl Default for RiskConfig {
    /// 创建默认风控配置 (模拟 Binance BTCUSDT 永续)
    ///
    /// 阶梯保证金率参考:
    /// - Tier 1: 0 - 50,000 USDT, MMR 0.5%, IMR 1%
    /// - Tier 2: 50,001 - 250,000 USDT, MMR 1.0%, IMR 2%
    /// - Tier 3: 250,001 - 1,000,000 USDT, MMR 2.5%, IMR 5%
    /// - Tier 4: 1,000,001+ USDT, MMR 5.0%, IMR 10%
    fn default() -> Self {
        Self {
            tiers: vec![
                MarginTier::new(50_000.0, 0.005, 0.01),
                MarginTier::new(250_000.0, 0.01, 0.02),
                MarginTier::new(1_000_000.0, 0.025, 0.05),
                MarginTier::new(f64::INFINITY, 0.05, 0.10),
            ],
            liquidation_fee_rate: 0.0005,
            margin_warning_threshold: 1.5,
        }
    }
}

impl RiskConfig {
    /// 创建新的风控配置
    pub fn new(tiers: Vec<MarginTier>, liquidation_fee_rate: f64) -> Self {
        Self {
            tiers,
            liquidation_fee_rate,
            margin_warning_threshold: 1.5,
        }
    }

    /// 创建简单的固定费率配置 (非阶梯)
    ///
    /// # Arguments
    /// - `mmr`: 维持保证金率
    /// - `imr`: 初始保证金率
    pub fn flat(mmr: f64, imr: f64) -> Self {
        Self {
            tiers: vec![MarginTier::new(f64::INFINITY, mmr, imr)],
            liquidation_fee_rate: 0.0005,
            margin_warning_threshold: 1.5,
        }
    }

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
    /// let config = RiskConfig::default();
    /// let mmr = config.get_maintenance_margin_rate(30_000.0);
    /// assert_eq!(mmr, 0.005); // Tier 1: 0.5%
    /// ```
    pub fn get_maintenance_margin_rate(&self, notional_value: f64) -> f64 {
        for tier in &self.tiers {
            if notional_value <= tier.max_notional {
                return tier.maintenance_margin_rate;
            }
        }
        // 如果配置不完整，返回最后一个档位的费率
        self.tiers
            .last()
            .map(|t| t.maintenance_margin_rate)
            .unwrap_or(0.05)
    }

    /// 根据名义价值获取初始保证金率 (IMR)
    ///
    /// # Arguments
    /// - `notional_value`: 仓位名义价值
    ///
    /// # Returns
    /// 对应档位的初始保证金率
    pub fn get_initial_margin_rate(&self, notional_value: f64) -> f64 {
        for tier in &self.tiers {
            if notional_value <= tier.max_notional {
                return tier.initial_margin_rate;
            }
        }
        self.tiers
            .last()
            .map(|t| t.initial_margin_rate)
            .unwrap_or(0.10)
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

// ============================================================================
// 强平结果枚举
// ============================================================================

/// 仓位方向
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PositionSide {
    /// 多头 (做多)
    Long,
    /// 空头 (做空)
    Short,
}

/// 风险评估等级
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RiskLevel {
    /// 安全: 保证金率充足
    Safe,
    /// 低风险: 保证金率较高
    Low,
    /// 中风险: 接近预警线
    Medium,
    /// 高风险: 已触发预警
    High,
    /// 极高风险: 接近强平
    Critical,
}

/// 强平计算结果
///
/// 用于返回仓位风险状态和相关数值。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiquidationResult {
    /// 风险等级
    pub risk_level: RiskLevel,

    /// 当前保证金率 (Margin Ratio)
    /// = (钱包余额 + 未实现盈亏) / 维持保证金
    pub margin_ratio: f64,

    /// 强平价格
    /// 当市价达到此价格时将被强制平仓
    pub liquidation_price: f64,

    /// 距离强平的价格百分比
    /// = (当前价格 - 强平价格) / 当前价格 * 100
    pub distance_to_liquidation_pct: f64,

    /// 维持保证金
    pub maintenance_margin: f64,

    /// 可用余额 (可用于开新仓)
    pub available_balance: f64,

    /// 是否触发强平
    pub is_liquidated: bool,

    /// 预警消息 (如有)
    pub warning_message: Option<String>,
}

impl LiquidationResult {
    /// 创建安全状态的结果
    pub fn safe(
        margin_ratio: f64,
        liquidation_price: f64,
        maintenance_margin: f64,
        available_balance: f64,
        current_price: f64,
    ) -> Self {
        let distance = if liquidation_price > 0.0 {
            ((current_price - liquidation_price) / current_price * 100.0).abs()
        } else {
            100.0
        };

        Self {
            risk_level: RiskLevel::Safe,
            margin_ratio,
            liquidation_price,
            distance_to_liquidation_pct: distance,
            maintenance_margin,
            available_balance,
            is_liquidated: false,
            warning_message: None,
        }
    }

    /// 创建预警状态的结果
    pub fn warning(
        margin_ratio: f64,
        liquidation_price: f64,
        maintenance_margin: f64,
        available_balance: f64,
        current_price: f64,
        message: String,
    ) -> Self {
        let distance = ((current_price - liquidation_price) / current_price * 100.0).abs();
        let risk_level = if distance < 5.0 {
            RiskLevel::Critical
        } else if distance < 10.0 {
            RiskLevel::High
        } else {
            RiskLevel::Medium
        };

        Self {
            risk_level,
            margin_ratio,
            liquidation_price,
            distance_to_liquidation_pct: distance,
            maintenance_margin,
            available_balance,
            is_liquidated: false,
            warning_message: Some(message),
        }
    }

    /// 创建已强平状态的结果
    pub fn liquidated(liquidation_price: f64, maintenance_margin: f64) -> Self {
        Self {
            risk_level: RiskLevel::Critical,
            margin_ratio: 0.0,
            liquidation_price,
            distance_to_liquidation_pct: 0.0,
            maintenance_margin,
            available_balance: 0.0,
            is_liquidated: true,
            warning_message: Some("仓位已被强制平仓".to_string()),
        }
    }
}

// ============================================================================
// 风险计算器
// ============================================================================

/// 风险计算器
///
/// 提供强平价格计算和风险评估的静态方法。
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
            PositionSide::Long => {
                // 多头强平价 = 入场价 * (1 - 1/杠杆 + MMR)
                // 简化: 多头亏损到保证金不足时强平
                entry_price * (1.0 - 1.0 / leverage_f + mmr)
            }
            PositionSide::Short => {
                // 空头强平价 = 入场价 * (1 + 1/杠杆 - MMR)
                // 简化: 空头亏损到保证金不足时强平
                entry_price * (1.0 + 1.0 / leverage_f - mmr)
            }
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

// ============================================================================
// 单元测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_risk_config() {
        let config = RiskConfig::default();

        // Tier 1: 0 - 50,000
        assert_eq!(config.get_maintenance_margin_rate(30_000.0), 0.005);
        assert_eq!(config.get_initial_margin_rate(30_000.0), 0.01);

        // Tier 2: 50,001 - 250,000
        assert_eq!(config.get_maintenance_margin_rate(100_000.0), 0.01);

        // Tier 3: 250,001 - 1,000,000
        assert_eq!(config.get_maintenance_margin_rate(500_000.0), 0.025);

        // Tier 4: 1,000,001+
        assert_eq!(config.get_maintenance_margin_rate(2_000_000.0), 0.05);
    }

    #[test]
    fn test_flat_config() {
        let config = RiskConfig::flat(0.01, 0.02);

        assert_eq!(config.get_maintenance_margin_rate(10_000.0), 0.01);
        assert_eq!(config.get_maintenance_margin_rate(10_000_000.0), 0.01);
    }

    #[test]
    fn test_liquidation_price_long() {
        // Long 10x, entry 50000, MMR 0.5%
        let liq_price = RiskCalculator::calculate_liquidation_price(
            50_000.0,
            10,
            PositionSide::Long,
            0.005,
        );
        // 强平价 = 50000 * (1 - 0.1 + 0.005) = 50000 * 0.905 = 45250
        assert!((liq_price - 45_250.0).abs() < 0.01);
    }

    #[test]
    fn test_liquidation_price_short() {
        // Short 10x, entry 50000, MMR 0.5%
        let liq_price = RiskCalculator::calculate_liquidation_price(
            50_000.0,
            10,
            PositionSide::Short,
            0.005,
        );
        // 强平价 = 50000 * (1 + 0.1 - 0.005) = 50000 * 1.095 = 54750
        assert!((liq_price - 54_750.0).abs() < 0.01);
    }

    #[test]
    fn test_unrealized_pnl() {
        // Long: 买入 50000，涨到 51000，持仓 0.1 BTC
        let pnl = RiskCalculator::calculate_unrealized_pnl(
            50_000.0,
            51_000.0,
            0.1,
            PositionSide::Long,
        );
        assert_eq!(pnl, 100.0); // 盈利 100 USDT

        // Short: 卖出 50000，涨到 51000，持仓 0.1 BTC
        let pnl = RiskCalculator::calculate_unrealized_pnl(
            50_000.0,
            51_000.0,
            0.1,
            PositionSide::Short,
        );
        assert_eq!(pnl, -100.0); // 亏损 100 USDT
    }

    #[test]
    fn test_margin_ratio() {
        let ratio = RiskCalculator::calculate_margin_ratio(
            1000.0,  // wallet balance
            -200.0,  // unrealized pnl (亏损)
            250.0,   // maintenance margin
        );
        // (1000 - 200) / 250 = 3.2
        assert!((ratio - 3.2).abs() < 0.001);
    }

    #[test]
    fn test_risk_level() {
        assert_eq!(RiskCalculator::evaluate_risk_level(0.5, 1.5), RiskLevel::Critical);
        assert_eq!(RiskCalculator::evaluate_risk_level(1.2, 1.5), RiskLevel::High);
        assert_eq!(RiskCalculator::evaluate_risk_level(2.0, 1.5), RiskLevel::Medium);
        assert_eq!(RiskCalculator::evaluate_risk_level(2.5, 1.5), RiskLevel::Low);
        assert_eq!(RiskCalculator::evaluate_risk_level(5.0, 1.5), RiskLevel::Safe);
    }
}
