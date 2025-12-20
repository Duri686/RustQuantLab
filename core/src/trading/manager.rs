//! # 仓位管理器 (PositionManager)
//!
//! 管理多个交易对的仓位集合，提供 CRUD 操作和批量 PnL 更新。
//!
//! ## 职责边界
//! - **PositionManager**: 仓位存储、查询、批量更新
//! - **Position**: 单仓位交易逻辑 (apply_trade)
//! - **Engine**: 余额管理、风控触发、事件发送

use std::collections::HashMap;
use crate::risk::{PositionSide, RiskCalculator, RiskConfig};
use super::position::{MarginMode, Position, PositionStatus, TradeResult};

// ============================================================================
// 开仓参数
// ============================================================================

/// 开仓参数 (由 Engine 层解析后传入)
#[derive(Debug, Clone)]
pub struct OpenPositionParams {
    /// 仓位 ID/存储 Key (如 "BTCUSDT_Long")
    pub symbol: String,
    /// 显示用交易对名称 (如 "BTCUSDT")
    pub display_symbol: Option<String>,
    pub side: PositionSide,
    pub size: f64,
    pub price: f64,
    pub leverage: u8,
    pub margin_mode: MarginMode,
    pub timestamp: u64,
}

// ============================================================================
// PositionManager
// ============================================================================

/// 仓位管理器
///
/// 封装 `HashMap<String, Position>` 的 CRUD 操作，
/// 并提供批量 PnL 更新功能。
#[derive(Debug, Default)]
pub struct PositionManager {
    /// 活跃仓位存储 (Key: position_key)
    positions: HashMap<String, Position>,
    /// 已平仓仓位历史
    closed_positions: Vec<Position>,
}

impl PositionManager {
    /// 创建空的仓位管理器
    pub fn new() -> Self {
        Self {
            positions: HashMap::new(),
            closed_positions: Vec::new(),
        }
    }

    // ========================================================================
    // CRUD 操作
    // ========================================================================

    /// 获取仓位引用
    pub fn get(&self, symbol: &str) -> Option<&Position> {
        self.positions.get(symbol)
    }

    /// 获取仓位可变引用
    pub fn get_mut(&mut self, symbol: &str) -> Option<&mut Position> {
        self.positions.get_mut(symbol)
    }

    /// 插入或替换仓位
    pub fn insert(&mut self, position: Position) {
        self.positions.insert(position.symbol.clone(), position);
    }

    /// 移除仓位
    pub fn remove(&mut self, symbol: &str) -> Option<Position> {
        self.positions.remove(symbol)
    }

    /// 检查仓位是否存在
    pub fn contains(&self, symbol: &str) -> bool {
        self.positions.contains_key(symbol)
    }

    /// 获取仓位数量
    pub fn len(&self) -> usize {
        self.positions.len()
    }

    /// 检查是否为空
    pub fn is_empty(&self) -> bool {
        self.positions.is_empty()
    }

    /// 检查是否有逐仓仓位 (用于杠杆修改限制)
    pub fn has_isolated_positions(&self) -> bool {
        use crate::trading::position::MarginMode;
        self.positions.values().any(|p| p.margin_mode == MarginMode::Isolated)
    }

    /// 清空所有仓位
    pub fn clear(&mut self) {
        self.positions.clear();
    }

    /// 获取所有仓位的迭代器
    pub fn iter(&self) -> impl Iterator<Item = (&String, &Position)> {
        self.positions.iter()
    }

    /// 获取所有仓位的可变迭代器
    pub fn iter_mut(&mut self) -> impl Iterator<Item = (&String, &mut Position)> {
        self.positions.iter_mut()
    }

    /// 获取所有活跃仓位的 Vec (用于序列化)
    pub fn to_vec(&self) -> Vec<Position> {
        self.positions.values().cloned().collect()
    }

    /// 获取所有已平仓仓位历史
    pub fn closed_positions(&self) -> &Vec<Position> {
        &self.closed_positions
    }

    /// 移动仓位到历史 (平仓时调用)
    pub fn move_to_history(&mut self, position_key: &str, exit_price: f64, realized_pnl: f64, is_liquidation: bool) {
        self.move_to_history_with_time(position_key, exit_price, realized_pnl, is_liquidation, 0);
    }
    
    /// 移动仓位到历史 (带时间戳)
    pub fn move_to_history_with_time(&mut self, position_key: &str, exit_price: f64, realized_pnl: f64, is_liquidation: bool, close_time: u64) {
        if let Some(mut pos) = self.positions.remove(position_key) {
            pos.status = if is_liquidation {
                PositionStatus::Liquidated
            } else {
                PositionStatus::Closed
            };
            pos.exit_price = exit_price;
            pos.realized_pnl = realized_pnl;
            pos.close_time = close_time;
            self.closed_positions.push(pos);
        }
    }

    /// 获取所有仓位符号列表
    pub fn symbols(&self) -> Vec<String> {
        self.positions.keys().cloned().collect()
    }

    // ========================================================================
    // 批量 PnL 更新
    // ========================================================================

    /// 批量更新所有仓位的未实现盈亏
    ///
    /// # Arguments
    /// - `current_prices`: 各交易对的最新价格 (Key: Symbol)
    ///
    /// # Returns
    /// 所有仓位的未实现盈亏总和
    pub fn update_pnl(&mut self, current_prices: &HashMap<String, f64>) -> f64 {
        let mut total_unrealized_pnl = 0.0;

        for (_position_key, position) in self.positions.iter_mut() {
            // Hedge Mode: 使用 position.symbol (display_symbol) 查找价格
            // position_key 是 "BTCUSDT_Long"，但价格 map 用 "BTCUSDT"
            if let Some(&price) = current_prices.get(&position.symbol) {
                position.update_pnl(price);
                total_unrealized_pnl += position.unrealized_pnl;
            }
        }

        total_unrealized_pnl
    }

    /// 更新单个仓位的 PnL
    pub fn update_position_pnl(&mut self, symbol: &str, current_price: f64) {
        if let Some(position) = self.positions.get_mut(symbol) {
            position.update_pnl(current_price);
        }
    }

    // ========================================================================
    // 交易执行 (委托给 Position)
    // ========================================================================

    /// 执行交易 (One-Way Mode)
    ///
    /// 根据现有仓位状态自动判断:
    /// - 无仓位: 需要外部创建新仓位
    /// - 同方向: 合并
    /// - 反方向: 减仓/平仓/反转
    ///
    /// # Arguments
    /// - `symbol`: 交易对符号
    /// - `order_side`: 订单方向
    /// - `order_size`: 订单数量
    /// - `order_price`: 订单价格
    /// - `margin_rate`: 保证金率 (IMR)
    ///
    /// # Returns
    /// - `Some(TradeResult)`: 执行成功，包含动作类型和保证金变化
    /// - `None`: 无现有仓位，需要创建新仓位
    pub fn apply_trade(
        &mut self,
        symbol: &str,
        order_side: PositionSide,
        order_size: f64,
        order_price: f64,
        margin_rate: f64,
    ) -> Option<TradeResult> {
        let position = self.positions.get_mut(symbol)?;
        let result = position.apply_trade(order_side, order_size, order_price, margin_rate);

        // 注: 不再自动删除已关闭仓位
        // 由调用者决定是删除还是移到历史 (通过 move_to_history)

        Some(result)
    }

    /// 开新仓位
    ///
    /// # Arguments
    /// - `params`: 开仓参数
    /// - `risk_config`: 风控配置 (用于计算强平价格)
    ///
    /// # Returns
    /// 创建的仓位引用
    pub fn open_position(&mut self, params: OpenPositionParams, risk_config: &RiskConfig) -> &Position {
        // 计算所需保证金
        let notional_value = params.size * params.price;
        let imr = risk_config.get_initial_margin_rate(notional_value);
        let required_margin = notional_value * imr;

        // 计算强平价格
        let mmr = risk_config.get_maintenance_margin_rate(notional_value);
        let liquidation_price = RiskCalculator::calculate_liquidation_price(
            params.price,
            params.leverage,
            params.side,
            mmr,
        );

        // 创建仓位 (Hedge Mode: id = position_key, symbol = display_symbol)
        let display_symbol = params.display_symbol.clone().unwrap_or_else(|| params.symbol.clone());
        let position = Position::new(
            params.symbol.clone(),  // id = position_key
            display_symbol,         // symbol = 显示用交易对
            params.side,
            params.size,
            params.price,
            required_margin,
            params.leverage,
            params.margin_mode,
            liquidation_price,
            params.timestamp,
        );

        self.positions.insert(params.symbol.clone(), position);
        self.positions.get(&params.symbol).unwrap()
    }

    // ========================================================================
    // 按保证金模式筛选
    // ========================================================================

    /// 获取所有全仓模式仓位的符号
    pub fn cross_position_symbols(&self) -> Vec<String> {
        self.positions
            .iter()
            .filter(|(_, pos)| pos.margin_mode == MarginMode::Cross)
            .map(|(sym, _)| sym.clone())
            .collect()
    }

    /// 获取所有逐仓模式仓位的符号
    pub fn isolated_position_symbols(&self) -> Vec<String> {
        self.positions
            .iter()
            .filter(|(_, pos)| pos.margin_mode == MarginMode::Isolated)
            .map(|(sym, _)| sym.clone())
            .collect()
    }

    /// 计算全仓模式总保证金
    pub fn total_cross_margin(&self) -> f64 {
        self.positions
            .values()
            .filter(|pos| pos.margin_mode == MarginMode::Cross)
            .map(|pos| pos.margin)
            .sum()
    }

    /// 计算逐仓模式总保证金
    pub fn total_isolated_margin(&self) -> f64 {
        self.positions
            .values()
            .filter(|pos| pos.margin_mode == MarginMode::Isolated)
            .map(|pos| pos.margin)
            .sum()
    }

    /// 计算全仓模式总未实现盈亏
    pub fn total_cross_unrealized_pnl(&self) -> f64 {
        self.positions
            .values()
            .filter(|pos| pos.margin_mode == MarginMode::Cross)
            .map(|pos| pos.unrealized_pnl)
            .sum()
    }

    /// 计算全部未实现盈亏
    pub fn total_unrealized_pnl(&self) -> f64 {
        self.positions.values().map(|pos| pos.unrealized_pnl).sum()
    }

    // ========================================================================
    // 风险检查辅助
    // ========================================================================

    /// 计算各仓位的维持保证金
    ///
    /// # Returns
    /// (全仓总维持保证金, 需强平的逐仓仓位符号列表)
    pub fn calculate_maintenance_requirements(
        &self,
        current_prices: &HashMap<String, f64>,
        risk_config: &RiskConfig,
    ) -> (f64, Vec<String>) {
        let mut total_cross_mm = 0.0;
        let mut isolated_to_liquidate = Vec::new();

        for (position_key, pos) in &self.positions {
            // Hedge Mode: 使用 pos.symbol (display_symbol) 查找价格
            let price = current_prices.get(&pos.symbol).copied().unwrap_or(pos.entry_price);
            let notional = pos.size * price;
            let mmr = risk_config.get_maintenance_margin_rate(notional);
            let maintenance_margin = notional * mmr;

            match pos.margin_mode {
                MarginMode::Cross => {
                    total_cross_mm += maintenance_margin;
                }
                MarginMode::Isolated => {
                    // 逐仓: 检查独立保证金是否足够
                    let isolated_equity = pos.margin + pos.unrealized_pnl;
                    if isolated_equity <= maintenance_margin {
                        isolated_to_liquidate.push(position_key.clone());
                    }
                }
            }
        }

        (total_cross_mm, isolated_to_liquidate)
    }
}

// ============================================================================
// 单元测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::trading::TradeAction;

    fn create_test_position(symbol: &str, side: PositionSide, size: f64, entry: f64) -> Position {
        let id = format!("{}_{:?}", symbol, side);
        Position::new(
            id,
            symbol.to_string(),
            side,
            size,
            entry,
            500.0,
            10,
            MarginMode::Cross,
            45000.0,
            1000,
        )
    }

    #[test]
    fn test_crud_operations() {
        let mut manager = PositionManager::new();
        assert!(manager.is_empty());

        // Insert
        let pos = create_test_position("BTCUSDT", PositionSide::Long, 0.1, 50000.0);
        manager.insert(pos);
        assert_eq!(manager.len(), 1);
        assert!(manager.contains("BTCUSDT"));

        // Get
        let pos_ref = manager.get("BTCUSDT").unwrap();
        assert_eq!(pos_ref.size, 0.1);

        // Remove
        let removed = manager.remove("BTCUSDT");
        assert!(removed.is_some());
        assert!(manager.is_empty());
    }

    #[test]
    fn test_update_pnl() {
        let mut manager = PositionManager::new();
        
        let pos = create_test_position("BTCUSDT", PositionSide::Long, 0.1, 50000.0);
        manager.insert(pos);

        let mut prices = HashMap::new();
        prices.insert("BTCUSDT".to_string(), 51000.0);

        let total_pnl = manager.update_pnl(&prices);
        
        // 盈利: (51000 - 50000) * 0.1 = 100
        assert!((total_pnl - 100.0).abs() < 0.01);
        
        let pos = manager.get("BTCUSDT").unwrap();
        assert!((pos.unrealized_pnl - 100.0).abs() < 0.01);
    }

    #[test]
    fn test_apply_trade_merge() {
        let mut manager = PositionManager::new();
        
        let pos = create_test_position("BTCUSDT", PositionSide::Long, 0.1, 50000.0);
        manager.insert(pos);

        // 加仓
        let result = manager.apply_trade("BTCUSDT", PositionSide::Long, 0.05, 51000.0, 0.01);
        
        assert!(result.is_some());
        let result = result.unwrap();
        assert!(matches!(result.action, TradeAction::Merged { .. }));

        let pos = manager.get("BTCUSDT").unwrap();
        assert!((pos.size - 0.15).abs() < 1e-10);
    }

    #[test]
    fn test_apply_trade_close() {
        let mut manager = PositionManager::new();
        
        let pos = create_test_position("BTCUSDT", PositionSide::Long, 0.1, 50000.0);
        manager.insert(pos);

        // 全部平仓
        let result = manager.apply_trade("BTCUSDT", PositionSide::Short, 0.1, 51000.0, 0.01);
        
        assert!(result.is_some());
        let result = result.unwrap();
        assert!(matches!(result.action, TradeAction::Closed { .. }));

        // 仓位应该被移除
        assert!(!manager.contains("BTCUSDT"));
    }

    #[test]
    fn test_apply_trade_no_position() {
        let mut manager = PositionManager::new();

        // 没有仓位时返回 None
        let result = manager.apply_trade("BTCUSDT", PositionSide::Long, 0.1, 50000.0, 0.01);
        assert!(result.is_none());
    }

    #[test]
    fn test_margin_mode_filters() {
        let mut manager = PositionManager::new();

        let mut btc = create_test_position("BTCUSDT", PositionSide::Long, 0.1, 50000.0);
        btc.margin_mode = MarginMode::Cross;
        btc.margin = 500.0;
        manager.insert(btc);

        let mut eth = create_test_position("ETHUSDT", PositionSide::Short, 1.0, 3000.0);
        eth.margin_mode = MarginMode::Isolated;
        eth.margin = 300.0;
        manager.insert(eth);

        assert_eq!(manager.cross_position_symbols(), vec!["BTCUSDT".to_string()]);
        assert_eq!(manager.isolated_position_symbols(), vec!["ETHUSDT".to_string()]);
        assert!((manager.total_cross_margin() - 500.0).abs() < 0.01);
        assert!((manager.total_isolated_margin() - 300.0).abs() < 0.01);
    }
}
