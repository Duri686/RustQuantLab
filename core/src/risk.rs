//! # 风控与强平引擎 (Risk & Liquidation Engine)
//!
//! 实现 P0 架构任务：将风控逻辑完全迁移至 Rust Core。
//!
//! ## 核心功能
//! - 阶梯保证金率 (Tiered Margin Rate)
//! - 强平价格计算 (Liquidation Price Calculation)
//! - 保证金追缴逻辑 (Margin Call Logic)
//!
//! ## 模块结构
//! - `types`: 核心数据类型和枚举定义
//! - `margin`: 保证金计算逻辑
//! - `liquidation`: 强平价格计算和风险评估
//!
//! ## 设计原则
//! - 使用 `f64` 进行所有金融计算，保证精度
//! - 纯 Rust 实现，无 web-sys 依赖
//! - 类型安全，防止无效状态
//! - 模块化设计，职责清晰

mod types;
mod margin;
mod liquidation;

pub use types::{
    MarginTier,
    RiskConfig,
    PositionSide,
    RiskLevel,
    LiquidationResult,
};

pub use liquidation::RiskCalculator;
