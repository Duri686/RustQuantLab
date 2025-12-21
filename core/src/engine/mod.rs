//! # MarketEngine - 有状态的市场分析引擎
//!
//! 负责状态管理和业务编排。
//!
//! ## 模块结构
//! ```text
//! engine/
//! ├── types.rs           # 公共类型定义
//! ├── market_engine/     # MarketEngine 核心 + impl 扩展
//! ├── data/              # 数据管理 (Tick, K线)
//! └── trading/           # 交易逻辑 (执行器, 订单处理)
//! ```

// 公共类型模块
pub mod types;

// 功能子模块
pub mod data;
pub mod trading;
mod market_engine;

#[cfg(test)]
mod tests;

// 重新导出
pub use market_engine::MarketEngine;
