//! # 数据管理模块
//!
//! 负责 Tick 数据和 K 线数据的管理与聚合。

mod tick_data;
pub mod candles;

pub(crate) use tick_data::TickDataManager;
pub(crate) use candles::{CandleAggregator, CandleCache, CandleIndicatorCalculator};
