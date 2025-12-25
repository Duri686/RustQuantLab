//! # 技术指标计算库
//!
//! 纯数学函数模块，无状态，易于测试。
//! 所有函数接收数据切片和参数，返回计算结果。
//!
//! ## 设计原则
//! - **无状态**: 函数不依赖任何外部状态
//! - **纯函数**: 相同输入始终产生相同输出
//! - **优雅降级**: 数据不足时返回 `None`
//!
//! ## 模块结构
//! - `ma`: 移动平均线 (SMA, EMA)
//! - `boll`: 布林带指标
//! - `macd`: MACD 指标
//! - `rsi`: RSI 相对强弱指数
//! - `utils`: 辅助函数 (价差计算等)

mod ma;
mod boll;
mod macd;
mod rsi;
mod utils;

pub use ma::{calculate_sma, calculate_ema};
pub use boll::calculate_boll;
pub use macd::calculate_macd;
pub use rsi::calculate_rsi;
pub use utils::calculate_spread;
