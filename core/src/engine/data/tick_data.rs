//! # Tick 数据管理模块
//!
//! 负责管理价格和成交量的历史数据。
//!
//! ## 职责
//! - 维护固定容量的价格历史
//! - 维护固定容量的成交量历史
//! - 批量清理过期数据

use crate::models::OrderBook;

// ============================================================================
// 常量定义
// ============================================================================

/// Tick 级别历史数据最大容量
const MAX_HISTORY_SIZE: usize = 1000;

/// 初始容量预分配
const INITIAL_CAPACITY: usize = 500;

/// 批量清理阈值
const BATCH_CLEANUP_THRESHOLD: usize = 50;

// ============================================================================
// TickDataManager
// ============================================================================

/// Tick 数据管理器
///
/// 维护价格和成交量历史，自动清理过期数据
#[derive(Debug, Clone)]
pub(crate) struct TickDataManager {
    /// 价格历史列表
    price_history: Vec<f64>,
    /// 成交量历史列表
    volume_history: Vec<f64>,
    /// 最大历史容量
    max_size: usize,
}

impl TickDataManager {
    /// 创建新的数据管理器
    pub fn new() -> Self {
        TickDataManager {
            price_history: Vec::with_capacity(INITIAL_CAPACITY),
            volume_history: Vec::with_capacity(INITIAL_CAPACITY),
            max_size: MAX_HISTORY_SIZE,
        }
    }

    /// 添加价格数据
    pub fn push_price(&mut self, price: f64) {
        self.price_history.push(price);
        self.cleanup_if_needed(&mut self.price_history.clone());
        
        // 实际清理
        let overflow = self.price_history.len().saturating_sub(self.max_size);
        if overflow >= BATCH_CLEANUP_THRESHOLD {
            self.price_history.drain(0..overflow);
        }
    }

    /// 添加成交量数据
    pub fn push_volume(&mut self, volume: f64) {
        self.volume_history.push(volume);
        
        let overflow = self.volume_history.len().saturating_sub(self.max_size);
        if overflow >= BATCH_CLEANUP_THRESHOLD {
            self.volume_history.drain(0..overflow);
        }
    }

    /// 从订单簿估算成交量
    pub fn estimate_volume(&self, order_book: &OrderBook) -> f64 {
        let bid_vol = order_book.bids.first().map(|(_, q)| *q).unwrap_or(0.0);
        let ask_vol = order_book.asks.first().map(|(_, q)| *q).unwrap_or(0.0);
        (bid_vol + ask_vol) / 2.0
    }

    /// 获取价格历史引用
    pub fn prices(&self) -> &[f64] {
        &self.price_history
    }

    /// 获取成交量历史引用
    pub fn volumes(&self) -> &[f64] {
        &self.volume_history
    }

    /// 获取最新价格
    pub fn last_price(&self) -> Option<f64> {
        self.price_history.last().copied()
    }

    /// 获取历史长度
    pub fn len(&self) -> usize {
        self.price_history.len()
    }

    /// 清空所有历史
    pub fn clear(&mut self) {
        self.price_history.clear();
        self.volume_history.clear();
    }

    /// 内部: 判断是否需要清理
    fn cleanup_if_needed(&self, _data: &mut Vec<f64>) {
        // 占位函数，清理逻辑已内联到 push_* 方法
    }
}

impl Default for TickDataManager {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// 测试辅助
// ============================================================================

#[cfg(test)]
impl TickDataManager {
    /// 测试辅助: 直接设置价格历史
    pub fn with_prices(prices: Vec<f64>) -> Self {
        TickDataManager {
            price_history: prices,
            volume_history: Vec::new(),
            max_size: MAX_HISTORY_SIZE,
        }
    }

    /// 测试辅助: 设置成交量
    pub fn set_volumes(&mut self, volumes: Vec<f64>) {
        self.volume_history = volumes;
    }
}
