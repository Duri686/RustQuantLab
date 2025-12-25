//! # 订单管理模块 (Order Management)
//!
//! 支持市价单和限价单（挂单）功能。
//!
//! ## 订单类型
//! - **Market**: 立即以当前市价成交
//! - **Limit**: 挂单等待价格触达后成交
//!
//! ## 限价单触发规则
//! 根据创建时的市价和限价的关系决定触发方向：
//! - **限价 > 创建时价格**: 等待价格上涨到限价时触发
//! - **限价 < 创建时价格**: 等待价格下跌到限价时触发

use std::collections::VecDeque;
use serde::{Deserialize, Serialize};
use crate::risk::PositionSide;
use super::MarginMode;

// ============================================================================
// 订单类型
// ============================================================================

/// 订单类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OrderType {
    /// 市价单: 立即以当前市价成交
    Market,
    /// 限价单: 等待价格触达后成交
    Limit,
}

impl Default for OrderType {
    fn default() -> Self {
        OrderType::Market
    }
}

// ============================================================================
// 挂单状态
// ============================================================================

/// 挂单状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PendingOrderStatus {
    /// 等待触发
    Pending,
    /// 已成交
    Filled,
    /// 已取消
    Cancelled,
    /// 已过期
    Expired,
}

impl Default for PendingOrderStatus {
    fn default() -> Self {
        PendingOrderStatus::Pending
    }
}

// ============================================================================
// 挂单结构体
// ============================================================================

/// 触发方向
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TriggerDirection {
    /// 等待价格上涨到限价
    Above,
    /// 等待价格下跌到限价
    Below,
}

/// 限价挂单
///
/// 表示一个等待执行的限价订单。当市场价格达到限价时，
/// 挂单将被转换为仓位。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingOrder {
    /// 订单唯一标识
    pub id: String,
    /// 交易对符号 (如 "BTCUSDT")
    pub symbol: String,
    /// 订单方向 (Long/Short)
    pub side: PositionSide,
    /// 订单数量
    pub size: f64,
    /// 限价价格
    pub limit_price: f64,
    /// 创建时的市场价格 (用于确定触发方向)
    pub created_price: f64,
    /// 触发方向
    pub trigger_direction: TriggerDirection,
    /// 杠杆倍数
    pub leverage: u8,
    /// 保证金模式
    pub margin_mode: MarginMode,
    /// 订单状态
    pub status: PendingOrderStatus,
    /// 创建时间戳
    pub created_at: u64,
    /// 过期时间戳 (0 = 永不过期, GTC)
    pub expires_at: u64,
    /// 预冻结保证金
    pub frozen_margin: f64,
}

impl PendingOrder {
    /// 创建新的挂单
    ///
    /// 根据限价与当前市价的关系自动确定触发方向：
    /// - 限价 > 当前价格: 等待价格上涨 (Above)
    /// - 限价 < 当前价格: 等待价格下跌 (Below)
    pub fn new(
        id: String,
        symbol: String,
        side: PositionSide,
        size: f64,
        limit_price: f64,
        current_price: f64,
        leverage: u8,
        margin_mode: MarginMode,
        frozen_margin: f64,
        created_at: u64,
    ) -> Self {
        // 根据限价与当前价格的关系确定触发方向
        let trigger_direction = if limit_price > current_price {
            TriggerDirection::Above // 等价格涨上去
        } else {
            TriggerDirection::Below // 等价格跌下来
        };

        Self {
            id,
            symbol,
            side,
            size,
            limit_price,
            created_price: current_price,
            trigger_direction,
            leverage,
            margin_mode,
            status: PendingOrderStatus::Pending,
            created_at,
            expires_at: 0, // GTC (Good-Til-Cancelled)
            frozen_margin,
        }
    }

    /// 检查挂单是否应该被触发
    ///
    /// ## 触发规则
    /// - **Above**: 等待价格上涨，当 current_price >= limit_price 时触发
    /// - **Below**: 等待价格下跌，当 current_price <= limit_price 时触发
    pub fn should_trigger(&self, current_price: f64) -> bool {
        if self.status != PendingOrderStatus::Pending {
            return false;
        }

        match self.trigger_direction {
            // 等待价格上涨到限价
            TriggerDirection::Above => current_price >= self.limit_price,
            // 等待价格下跌到限价
            TriggerDirection::Below => current_price <= self.limit_price,
        }
    }

    /// 检查挂单是否已过期
    pub fn is_expired(&self, current_time: u64) -> bool {
        if self.expires_at == 0 {
            return false; // GTC 永不过期
        }
        current_time >= self.expires_at
    }

    /// 标记为已成交
    pub fn mark_filled(&mut self) {
        self.status = PendingOrderStatus::Filled;
    }

    /// 标记为已取消
    pub fn mark_cancelled(&mut self) {
        self.status = PendingOrderStatus::Cancelled;
    }

    /// 标记为已过期
    pub fn mark_expired(&mut self) {
        self.status = PendingOrderStatus::Expired;
    }
}

// ============================================================================
// 挂单管理器
// ============================================================================

/// 订单历史最大容量
const MAX_ORDER_HISTORY: usize = 100;

/// 挂单管理器
///
/// 管理所有等待执行的限价订单。
#[derive(Debug, Default)]
pub struct PendingOrderManager {
    /// 活跃挂单列表
    orders: Vec<PendingOrder>,
    /// 已完成订单历史 (最近 N 条，使用 VecDeque 优化 pop_front)
    order_history: VecDeque<PendingOrder>,
    /// 下一个订单 ID 计数器
    next_id: u64,
}

impl PendingOrderManager {
    /// 创建新的挂单管理器
    pub fn new() -> Self {
        Self {
            orders: Vec::new(),
            order_history: VecDeque::with_capacity(MAX_ORDER_HISTORY),
            next_id: 1,
        }
    }

    /// 生成新的订单 ID
    fn generate_id(&mut self) -> String {
        let id = self.next_id;
        self.next_id += 1;
        format!("ORDER_{}", id)
    }

    /// 添加挂单
    pub fn add_order(&mut self, order: PendingOrder) -> String {
        let id = order.id.clone();
        self.orders.push(order);
        id
    }

    /// 创建并添加挂单
    ///
    /// `current_price` 用于确定触发方向：
    /// - 限价 > 当前价格: 等待价格上涨触发
    /// - 限价 < 当前价格: 等待价格下跌触发
    pub fn create_order(
        &mut self,
        symbol: String,
        side: PositionSide,
        size: f64,
        limit_price: f64,
        current_price: f64,
        leverage: u8,
        margin_mode: MarginMode,
        frozen_margin: f64,
        created_at: u64,
    ) -> String {
        let id = self.generate_id();
        let order = PendingOrder::new(
            id.clone(),
            symbol,
            side,
            size,
            limit_price,
            current_price,
            leverage,
            margin_mode,
            frozen_margin,
            created_at,
        );
        self.orders.push(order);
        id
    }

    /// 获取所有活跃挂单
    pub fn active_orders(&self) -> &[PendingOrder] {
        &self.orders
    }

    /// 获取活跃挂单数量
    pub fn active_count(&self) -> usize {
        self.orders.len()
    }

    /// 检查是否有活跃挂单
    pub fn has_active_orders(&self) -> bool {
        !self.orders.is_empty()
    }

    /// 获取指定 ID 的挂单
    pub fn get(&self, id: &str) -> Option<&PendingOrder> {
        self.orders.iter().find(|o| o.id == id)
    }

    /// 取消指定 ID 的挂单
    ///
    /// 返回被取消订单的冻结保证金 (用于解冻)
    pub fn cancel_order(&mut self, id: &str) -> Option<f64> {
        if let Some(idx) = self.orders.iter().position(|o| o.id == id) {
            let mut order = self.orders.remove(idx);
            let frozen = order.frozen_margin;
            order.mark_cancelled();
            self.add_to_history(order);
            Some(frozen)
        } else {
            None
        }
    }

    /// 取消所有挂单
    ///
    /// 返回总冻结保证金
    pub fn cancel_all(&mut self) -> f64 {
        let total_frozen: f64 = self.orders.iter().map(|o| o.frozen_margin).sum();
        let orders: Vec<_> = self.orders.drain(..).collect();
        for mut order in orders {
            order.mark_cancelled();
            self.add_to_history(order);
        }
        total_frozen
    }

    /// 检查并返回所有可触发的挂单
    ///
    /// 返回可触发的挂单列表 (从队列中移除)
    pub fn check_triggers(&mut self, current_price: f64, current_time: u64) -> Vec<PendingOrder> {
        let mut triggered = Vec::new();
        let mut to_remove = Vec::new();

        for (idx, order) in self.orders.iter_mut().enumerate() {
            // 检查过期
            if order.is_expired(current_time) {
                order.mark_expired();
                to_remove.push(idx);
                continue;
            }

            // 检查触发
            if order.should_trigger(current_price) {
                order.mark_filled();
                to_remove.push(idx);
            }
        }

        // 逆序移除，避免索引错位
        for idx in to_remove.into_iter().rev() {
            let order = self.orders.remove(idx);
            if order.status == PendingOrderStatus::Filled {
                triggered.push(order.clone());
            }
            self.add_to_history(order);
        }

        triggered
    }

    /// 计算总冻结保证金
    pub fn total_frozen_margin(&self) -> f64 {
        self.orders.iter().map(|o| o.frozen_margin).sum()
    }

    /// 获取订单历史 (slice view)
    pub fn history(&self) -> impl Iterator<Item = &PendingOrder> {
        self.order_history.iter()
    }

    /// 获取订单历史数量
    pub fn history_len(&self) -> usize {
        self.order_history.len()
    }

    /// 添加到历史记录 (保留最近 N 条，pop_front 为 O(1))
    fn add_to_history(&mut self, order: PendingOrder) {
        if self.order_history.len() >= MAX_ORDER_HISTORY {
            self.order_history.pop_front();
        }
        self.order_history.push_back(order);
    }

    /// 清空所有挂单
    pub fn clear(&mut self) {
        self.orders.clear();
        self.order_history.clear();
    }

    /// 转换为 Vec 用于序列化
    pub fn to_vec(&self) -> Vec<PendingOrder> {
        self.orders.clone()
    }
}

// ============================================================================
// 单元测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// 创建测试挂单
    /// - current_price: 创建时的市场价格
    /// - limit_price: 限价
    fn create_test_order(side: PositionSide, limit_price: f64, current_price: f64) -> PendingOrder {
        PendingOrder::new(
            "TEST_1".to_string(),
            "BTCUSDT".to_string(),
            side,
            0.1,
            limit_price,
            current_price,
            10,
            MarginMode::Cross,
            500.0,
            1000,
        )
    }

    #[test]
    fn test_long_limit_order_trigger() {
        // 当前价格 51000，限价 50000 → 等待价格下跌 (Below)
        let order = create_test_order(PositionSide::Long, 50000.0, 51000.0);

        // 价格高于限价，不触发
        assert!(!order.should_trigger(50500.0));

        // 价格等于限价，触发
        assert!(order.should_trigger(50000.0));

        // 价格低于限价，触发
        assert!(order.should_trigger(49000.0));
    }

    #[test]
    fn test_short_limit_order_trigger() {
        // 当前价格 49000，限价 50000 → 等待价格上涨 (Above)
        let order = create_test_order(PositionSide::Short, 50000.0, 49000.0);

        // 价格低于限价，不触发
        assert!(!order.should_trigger(49500.0));

        // 价格等于限价，触发
        assert!(order.should_trigger(50000.0));

        // 价格高于限价，触发
        assert!(order.should_trigger(51000.0));
    }

    #[test]
    fn test_order_manager_create_and_cancel() {
        let mut manager = PendingOrderManager::new();

        // 创建挂单 (当前价 51000，限价 50000，等待下跌)
        let id = manager.create_order(
            "BTCUSDT".to_string(),
            PositionSide::Long,
            0.1,
            50000.0,
            51000.0,  // current_price
            10,
            MarginMode::Cross,
            500.0,
            1000,
        );

        assert_eq!(manager.active_count(), 1);

        // 取消挂单
        let frozen = manager.cancel_order(&id);
        assert_eq!(frozen, Some(500.0));
        assert_eq!(manager.active_count(), 0);
        assert_eq!(manager.history_len(), 1);
    }

    #[test]
    fn test_order_manager_check_triggers() {
        let mut manager = PendingOrderManager::new();

        // 创建两个挂单 (当前价 51000，等待下跌)
        manager.create_order(
            "BTCUSDT".to_string(),
            PositionSide::Long,
            0.1,
            50000.0,
            51000.0,  // current_price
            10,
            MarginMode::Cross,
            500.0,
            1000,
        );
        manager.create_order(
            "BTCUSDT".to_string(),
            PositionSide::Long,
            0.05,
            49000.0,
            51000.0,  // current_price
            10,
            MarginMode::Cross,
            250.0,
            1000,
        );

        assert_eq!(manager.active_count(), 2);

        // 价格 50500: 无触发
        let triggered = manager.check_triggers(50500.0, 2000);
        assert_eq!(triggered.len(), 0);
        assert_eq!(manager.active_count(), 2);

        // 价格 50000: 触发第一个
        let triggered = manager.check_triggers(50000.0, 2000);
        assert_eq!(triggered.len(), 1);
        assert!((triggered[0].limit_price - 50000.0).abs() < 0.01);
        assert_eq!(manager.active_count(), 1);

        // 价格 48000: 触发第二个
        let triggered = manager.check_triggers(48000.0, 2000);
        assert_eq!(triggered.len(), 1);
        assert!((triggered[0].limit_price - 49000.0).abs() < 0.01);
        assert_eq!(manager.active_count(), 0);
    }
}
