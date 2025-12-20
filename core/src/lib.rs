//! # RustQuantLab Core - Wasm 计算引擎
//!
//! 实现 "Full Client-Side Calculation" 架构的核心模块。
//!
//! ## 模块结构
//! - `models`: 数据结构定义
//! - `indicators`: 纯数学计算函数 (无状态)
//! - `engine`: 有状态的市场分析引擎
//! - `risk`: 风控与强平引擎
//!
//! ## 架构角色
//! 本模块作为 **Logic Layer (The Brain)**，负责:
//! - 技术指标计算: SMA, EMA, BOLL, MACD, RSI
//! - 数据清洗与预处理
//! - 订单预校验
//! - 风控与强平逻辑 (P0)

use wasm_bindgen::prelude::*;

// ============================================================================
// 模块声明
// ============================================================================

/// 数据模型定义
pub mod models;

/// 技术指标计算 (纯函数)
pub mod indicators;

/// 市场分析引擎 (有状态)
mod engine;

/// 风控与强平引擎
pub mod risk;

/// 交易模块 (仓位管理)
pub mod trading;

// ============================================================================
// 公共导出
// ============================================================================

// WASM 绑定的主入口点
// 注意: 其他类型通过 serde 自动序列化到 JS，无需显式导出
pub use engine::MarketEngine;

// 以下导出仅供 Rust 侧集成测试使用 (不会编译进 WASM)
#[cfg(not(target_arch = "wasm32"))]
pub use models::{
    AnalysisResult, BollResult, Candle, CandleHistory, IndicatorHistory, MacdResult, OrderBook, 
    SimOrder, SimOrderResult, SimOrderSide, Timeframe,
};
#[cfg(not(target_arch = "wasm32"))]
pub use risk::{
    LiquidationResult, MarginTier, PositionSide, RiskCalculator, RiskConfig, RiskLevel,
};
#[cfg(not(target_arch = "wasm32"))]
pub use trading::{MarginMode, OpenPositionParams, Position, PositionManager, TradeAction, TradeResult};

// ============================================================================
// Wasm 初始化
// ============================================================================

/// 初始化 panic hook
///
/// 将 Rust panic 信息输出到浏览器控制台，便于调试。
pub fn set_panic_hook() {
    console_error_panic_hook::set_once();
}

/// Wasm 模块初始化入口
///
/// 在模块加载时自动执行，设置 panic hook。
#[wasm_bindgen(start)]
pub fn init() {
    set_panic_hook();
}


// ============================================================================
// 集成测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_exports() {
        // 验证模块可正常访问
        let _engine = MarketEngine::new();

        // 验证指标函数可调用
        let data = vec![10.0, 20.0, 30.0, 40.0, 50.0];
        let sma = indicators::calculate_sma(&data, 3);
        assert_eq!(sma, Some(40.0));
    }
}
