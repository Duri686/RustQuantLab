//! # 交易逻辑模块
//!
//! 负责交易执行、风险监控、订单处理。
//!
//! ## 子模块
//! - `executor`: TradingExecutor 定义
//! - `risk_monitor`: 风险监控
//! - `open_position`: 开仓逻辑 (impl TradingExecutor)
//! - `close_position`: 平仓逻辑 (impl TradingExecutor)
//! - `limit_order`: 限价单处理
//! - `sim_order`: 模拟订单

mod executor;
mod risk_monitor;
mod open_position;
mod close_position;
mod limit_order;
mod sim_order;

pub(crate) use executor::TradingExecutor;
pub(crate) use risk_monitor::RiskMonitor;
pub(crate) use limit_order::LimitOrderHandler;
pub(crate) use sim_order::SimOrderExecutor;
