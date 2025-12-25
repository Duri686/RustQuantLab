use std::fmt;
use serde::{Deserialize, Serialize};

/// 仓位方向
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PositionSide {
    Long,
    Short,
}

impl fmt::Display for PositionSide {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PositionSide::Long => write!(f, "Long"),
            PositionSide::Short => write!(f, "Short"),
        }
    }
}

/// 风险评估等级
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RiskLevel {
    Safe,
    Low,
    Medium,
    High,
    Critical,
}

/// 单个保证金档位
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarginTier {
    pub max_notional: f64,
    pub maintenance_margin_rate: f64,
    pub initial_margin_rate: f64,
}

impl MarginTier {
    pub fn new(max_notional: f64, mmr: f64, imr: f64) -> Self {
        Self {
            max_notional,
            maintenance_margin_rate: mmr,
            initial_margin_rate: imr,
        }
    }
}

/// 风控配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskConfig {
    pub tiers: Vec<MarginTier>,
    pub liquidation_fee_rate: f64,
    pub margin_warning_threshold: f64,
}

impl Default for RiskConfig {
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
    pub fn new(tiers: Vec<MarginTier>, liquidation_fee_rate: f64) -> Self {
        Self {
            tiers,
            liquidation_fee_rate,
            margin_warning_threshold: 1.5,
        }
    }

    pub fn flat(mmr: f64, imr: f64) -> Self {
        Self {
            tiers: vec![MarginTier::new(f64::INFINITY, mmr, imr)],
            liquidation_fee_rate: 0.0005,
            margin_warning_threshold: 1.5,
        }
    }
}

/// 强平计算结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LiquidationResult {
    pub risk_level: RiskLevel,
    pub margin_ratio: f64,
    pub liquidation_price: f64,
    pub distance_to_liquidation_pct: f64,
    pub maintenance_margin: f64,
    pub available_balance: f64,
    pub is_liquidated: bool,
    pub warning_message: Option<String>,
}

impl LiquidationResult {
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
