//! # 交易模块 (Trading Module)
//!
//! 仓位管理与交易逻辑封装。
//!
//! ## 模块结构
//! - `position`: Position 结构体与 One-Way Mode 交易逻辑
//! - `manager`: PositionManager 负责多仓位 CRUD 操作
//! - `balance`: TradingAccount 负责账户余额与保证金管理

pub mod position;
pub mod manager;
pub mod balance;

// 重新导出核心类型
pub use position::{MarginMode, Position, TradeResult, TradeAction};
pub use manager::{PositionManager, OpenPositionParams};
pub use balance::{TradingAccount, DEFAULT_INITIAL_BALANCE, DEFAULT_LEVERAGE};

// 从 risk 模块重新导出 PositionSide (避免循环依赖)
pub use crate::risk::PositionSide;
