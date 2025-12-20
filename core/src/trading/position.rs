//! # 仓位数据结构与交易逻辑
//!
//! 封装单个仓位的状态和 One-Way Mode 交易行为。
//!
//! ## One-Way Mode 规则
//! - **同方向订单**: 合并 (加权平均入场价)
//! - **反方向订单**: 减仓/平仓 (Netting)
//! - 每个交易对最多一个仓位

use serde::{Deserialize, Serialize};
use crate::risk::PositionSide;

// ============================================================================
// 保证金模式
// ============================================================================

/// 保证金模式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MarginMode {
    /// 全仓模式: 所有仓位共享钱包余额作为保证金
    Cross,
    /// 逐仓模式: 每个仓位独立锁定保证金
    Isolated,
}

impl Default for MarginMode {
    fn default() -> Self {
        MarginMode::Cross
    }
}

// ============================================================================
// 交易执行结果
// ============================================================================

/// 交易动作类型
#[derive(Debug, Clone, PartialEq)]
pub enum TradeAction {
    /// 合并仓位 (同方向加仓)
    Merged {
        old_entry_price: f64,
        new_entry_price: f64,
        added_size: f64,
    },
    /// 部分减仓
    Reduced {
        closed_size: f64,
        remaining_size: f64,
        realized_pnl: f64,
    },
    /// 全部平仓
    Closed {
        closed_size: f64,
        realized_pnl: f64,
    },
    /// 反转仓位 (全平后反向开仓)
    /// 返回: (平仓盈亏, 需要反向开的数量)
    Reversed {
        closed_pnl: f64,
        excess_size: f64,
        new_side: PositionSide,
    },
}

/// 交易执行结果
#[derive(Debug, Clone)]
pub struct TradeResult {
    /// 是否执行成功
    pub success: bool,
    /// 执行的动作类型
    pub action: TradeAction,
    /// 释放的保证金 (用于减仓/平仓)
    pub released_margin: f64,
    /// 需要的额外保证金 (用于加仓)
    pub required_margin: f64,
}

impl TradeResult {
    /// 创建合并结果
    pub fn merged(old_entry: f64, new_entry: f64, added_size: f64, required_margin: f64) -> Self {
        Self {
            success: true,
            action: TradeAction::Merged {
                old_entry_price: old_entry,
                new_entry_price: new_entry,
                added_size,
            },
            released_margin: 0.0,
            required_margin,
        }
    }

    /// 创建部分减仓结果
    pub fn reduced(closed_size: f64, remaining: f64, pnl: f64, released: f64) -> Self {
        Self {
            success: true,
            action: TradeAction::Reduced {
                closed_size,
                remaining_size: remaining,
                realized_pnl: pnl,
            },
            released_margin: released,
            required_margin: 0.0,
        }
    }

    /// 创建全部平仓结果
    pub fn closed(size: f64, pnl: f64, released: f64) -> Self {
        Self {
            success: true,
            action: TradeAction::Closed {
                closed_size: size,
                realized_pnl: pnl,
            },
            released_margin: released,
            required_margin: 0.0,
        }
    }

    /// 创建反转结果
    pub fn reversed(closed_pnl: f64, excess_size: f64, new_side: PositionSide, released: f64) -> Self {
        Self {
            success: true,
            action: TradeAction::Reversed {
                closed_pnl,
                excess_size,
                new_side,
            },
            released_margin: released,
            required_margin: 0.0,
        }
    }
}

// ============================================================================
// 仓位结构体
// ============================================================================

/// 活跃仓位
///
/// 表示某个交易对的单一持仓 (One-Way Mode)。
/// 包含仓位状态和 PnL 计算所需的所有字段。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    /// 交易对符号 (如 "BTCUSDT")
    pub symbol: String,
    /// 仓位方向
    pub side: PositionSide,
    /// 仓位大小 (BTC 数量)
    pub size: f64,
    /// 开仓均价 (加仓时加权平均)
    pub entry_price: f64,
    /// 开仓时间戳
    pub open_time: u64,
    /// 使用的保证金 (Isolated: 锁定; Cross: 记录值)
    pub margin: f64,
    /// 杠杆倍数
    pub leverage: u8,
    /// 保证金模式
    pub margin_mode: MarginMode,
    /// 强平价格
    pub liquidation_price: f64,
    /// 未实现盈亏
    pub unrealized_pnl: f64,
    /// 盈亏百分比
    pub pnl_percentage: f64,
}

impl Position {
    /// 创建新仓位
    pub fn new(
        symbol: String,
        side: PositionSide,
        size: f64,
        entry_price: f64,
        margin: f64,
        leverage: u8,
        margin_mode: MarginMode,
        liquidation_price: f64,
        open_time: u64,
    ) -> Self {
        Self {
            symbol,
            side,
            size,
            entry_price,
            open_time,
            margin,
            leverage,
            margin_mode,
            liquidation_price,
            unrealized_pnl: 0.0,
            pnl_percentage: 0.0,
        }
    }

    /// 应用交易 (One-Way Mode 核心逻辑)
    ///
    /// 根据传入的交易方向和数量，自动判断并执行:
    /// - 同方向: 合并 (加权平均价)
    /// - 反方向: 减仓 (Netting) / 平仓 / 反转
    ///
    /// # Arguments
    /// - `order_side`: 订单方向
    /// - `order_size`: 订单数量
    /// - `order_price`: 订单价格 (市价/限价)
    /// - `margin_per_unit`: 每单位所需保证金 (名义价值 × IMR)
    ///
    /// # Returns
    /// `TradeResult` 描述执行结果和保证金变化
    ///
    /// # 注意
    /// 此方法只修改 Position 自身状态，不处理:
    /// - 余额检查 (由 PositionManager 负责)
    /// - 强平价格更新 (需要外部重新计算)
    /// - 事件发送 (由 Engine 层负责)
    pub fn apply_trade(
        &mut self,
        order_side: PositionSide,
        order_size: f64,
        order_price: f64,
        margin_per_unit: f64,
    ) -> TradeResult {
        if order_side == self.side {
            // ===== 同方向: 合并 (加仓) =====
            self.merge(order_size, order_price, margin_per_unit)
        } else {
            // ===== 反方向: 减仓 / 平仓 / 反转 =====
            self.net(order_size, order_price)
        }
    }

    /// 合并仓位 (同方向加仓)
    ///
    /// 加权平均价计算:
    /// ```text
    /// new_entry = (old_size × old_entry + add_size × add_price) / new_size
    /// ```
    fn merge(&mut self, add_size: f64, add_price: f64, margin_per_unit: f64) -> TradeResult {
        let old_entry = self.entry_price;
        let old_size = self.size;

        // 计算新的加权平均入场价
        let new_size = old_size + add_size;
        let new_entry = (old_size * old_entry + add_size * add_price) / new_size;

        // 计算新增保证金
        let add_margin = add_size * add_price * margin_per_unit;

        // 更新仓位状态
        self.size = new_size;
        self.entry_price = new_entry;
        self.margin += add_margin;

        TradeResult::merged(old_entry, new_entry, add_size, add_margin)
    }

    /// 减仓/平仓/反转 (反方向订单)
    ///
    /// Netting 逻辑:
    /// - `order_size < position_size`: 部分平仓
    /// - `order_size == position_size`: 全部平仓
    /// - `order_size > position_size`: 全平后反向开仓
    fn net(&mut self, close_size: f64, exit_price: f64) -> TradeResult {
        let current_size = self.size;
        let released_margin: f64;
        
        if close_size < current_size {
            // ===== 部分平仓 =====
            let remaining_size = current_size - close_size;
            let realized_pnl = self.calculate_pnl(exit_price, close_size);
            released_margin = self.margin * (close_size / current_size);

            // 更新仓位
            self.size = remaining_size;
            self.margin -= released_margin;

            TradeResult::reduced(close_size, remaining_size, realized_pnl, released_margin)
        } else if (close_size - current_size).abs() < 1e-10 {
            // ===== 全部平仓 (使用容差比较浮点数) =====
            let realized_pnl = self.calculate_pnl(exit_price, current_size);
            released_margin = self.margin;

            // 标记仓位为空 (由 PositionManager 移除)
            self.size = 0.0;
            self.margin = 0.0;

            TradeResult::closed(current_size, realized_pnl, released_margin)
        } else {
            // ===== 反转 (close_size > current_size) =====
            let excess_size = close_size - current_size;
            let closed_pnl = self.calculate_pnl(exit_price, current_size);
            released_margin = self.margin;
            let new_side = self.opposite_side();

            // 标记仓位为空 (Manager 会创建新仓位)
            self.size = 0.0;
            self.margin = 0.0;

            TradeResult::reversed(closed_pnl, excess_size, new_side, released_margin)
        }
    }

    /// 计算盈亏
    ///
    /// - Long: (exit - entry) × size
    /// - Short: (entry - exit) × size
    fn calculate_pnl(&self, exit_price: f64, size: f64) -> f64 {
        let price_diff = exit_price - self.entry_price;
        match self.side {
            PositionSide::Long => price_diff * size,
            PositionSide::Short => -price_diff * size,
        }
    }

    /// 获取反向
    fn opposite_side(&self) -> PositionSide {
        match self.side {
            PositionSide::Long => PositionSide::Short,
            PositionSide::Short => PositionSide::Long,
        }
    }

    /// 更新未实现盈亏
    ///
    /// 根据当前市场价格重新计算 unrealized_pnl 和 pnl_percentage
    pub fn update_pnl(&mut self, current_price: f64) {
        self.unrealized_pnl = self.calculate_pnl(current_price, self.size);
        self.pnl_percentage = if self.margin > 0.0 {
            (self.unrealized_pnl / self.margin) * 100.0
        } else {
            0.0
        };
    }

    /// 检查仓位是否已关闭 (size == 0)
    pub fn is_closed(&self) -> bool {
        self.size <= 0.0
    }

    /// 计算名义价值
    pub fn notional_value(&self, current_price: f64) -> f64 {
        self.size * current_price
    }
}

// ============================================================================
// 单元测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_position(side: PositionSide, size: f64, entry: f64) -> Position {
        Position::new(
            "BTCUSDT".to_string(),
            side,
            size,
            entry,
            500.0, // margin
            10,    // leverage
            MarginMode::Cross,
            45000.0, // liquidation_price
            1000,    // open_time
        )
    }

    #[test]
    fn test_merge_same_side() {
        let mut pos = create_test_position(PositionSide::Long, 0.1, 50000.0);
        
        // 加仓: 0.05 BTC @ 51000
        let result = pos.apply_trade(PositionSide::Long, 0.05, 51000.0, 0.01);
        
        assert!(result.success);
        if let TradeAction::Merged { new_entry_price, .. } = result.action {
            // 加权平均: (0.1 * 50000 + 0.05 * 51000) / 0.15 = 50333.33
            assert!((new_entry_price - 50333.33).abs() < 1.0);
        } else {
            panic!("Expected Merged action");
        }
        
        assert!((pos.size - 0.15).abs() < 1e-10);
    }

    #[test]
    fn test_partial_close() {
        let mut pos = create_test_position(PositionSide::Long, 0.1, 50000.0);
        
        // 反向订单平掉一半: 0.05 @ 51000
        let result = pos.apply_trade(PositionSide::Short, 0.05, 51000.0, 0.01);
        
        assert!(result.success);
        if let TradeAction::Reduced { closed_size, remaining_size, realized_pnl } = result.action {
            assert!((closed_size - 0.05).abs() < 1e-10);
            assert!((remaining_size - 0.05).abs() < 1e-10);
            // 盈利: (51000 - 50000) * 0.05 = 50
            assert!((realized_pnl - 50.0).abs() < 0.01);
        } else {
            panic!("Expected Reduced action");
        }
    }

    #[test]
    fn test_full_close() {
        let mut pos = create_test_position(PositionSide::Long, 0.1, 50000.0);
        
        // 完全平仓: 0.1 @ 52000
        let result = pos.apply_trade(PositionSide::Short, 0.1, 52000.0, 0.01);
        
        assert!(result.success);
        if let TradeAction::Closed { closed_size, realized_pnl } = result.action {
            assert!((closed_size - 0.1).abs() < 1e-10);
            // 盈利: (52000 - 50000) * 0.1 = 200
            assert!((realized_pnl - 200.0).abs() < 0.01);
        } else {
            panic!("Expected Closed action");
        }
        
        assert!(pos.is_closed());
    }

    #[test]
    fn test_reverse_position() {
        let mut pos = create_test_position(PositionSide::Long, 0.1, 50000.0);
        
        // 反转: 反向 0.15 @ 51000 (平 0.1 + 开空 0.05)
        let result = pos.apply_trade(PositionSide::Short, 0.15, 51000.0, 0.01);
        
        assert!(result.success);
        if let TradeAction::Reversed { closed_pnl, excess_size, new_side } = result.action {
            // 平仓盈利: (51000 - 50000) * 0.1 = 100
            assert!((closed_pnl - 100.0).abs() < 0.01);
            assert!((excess_size - 0.05).abs() < 1e-10);
            assert_eq!(new_side, PositionSide::Short);
        } else {
            panic!("Expected Reversed action");
        }
    }

    #[test]
    fn test_short_position_pnl() {
        let mut pos = create_test_position(PositionSide::Short, 0.1, 50000.0);
        
        // 空头平仓: 价格下跌到 49000
        let result = pos.apply_trade(PositionSide::Long, 0.1, 49000.0, 0.01);
        
        if let TradeAction::Closed { realized_pnl, .. } = result.action {
            // 空头盈利: (50000 - 49000) * 0.1 = 100
            assert!((realized_pnl - 100.0).abs() < 0.01);
        } else {
            panic!("Expected Closed action");
        }
    }

    #[test]
    fn test_update_pnl() {
        let mut pos = create_test_position(PositionSide::Long, 0.1, 50000.0);
        
        pos.update_pnl(51000.0);
        
        // 未实现盈利: (51000 - 50000) * 0.1 = 100
        assert!((pos.unrealized_pnl - 100.0).abs() < 0.01);
        // 盈亏百分比: 100 / 500 * 100 = 20%
        assert!((pos.pnl_percentage - 20.0).abs() < 0.01);
    }
}
