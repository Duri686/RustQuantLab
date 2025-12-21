//! # 账户余额管理 (TradingAccount)
//!
//! 封装钱包余额、保证金计算、权益计算等账户级别的逻辑。
//!
//! ## 职责边界
//! - **TradingAccount**: 余额管理、保证金检查、权益计算
//! - **PositionManager**: 仓位 CRUD、批量 PnL 更新
//! - **Engine**: 路由请求、事件分发、风控触发

use super::manager::PositionManager;

// ============================================================================
// 常量定义
// ============================================================================

/// 默认初始余额 (USDT)
pub const DEFAULT_INITIAL_BALANCE: f64 = 10_000.0;

/// 默认杠杆倍数
pub const DEFAULT_LEVERAGE: u8 = 10;

// ============================================================================
// TradingAccount 结构体
// ============================================================================

/// 交易账户
///
/// 管理钱包余额和杠杆设置，提供保证金检查和权益计算方法。
///
/// ## 设计说明
/// - 从 `MarketEngine` 中提取的账户管理逻辑
/// - 不持有 PositionManager，仅通过参数接收仓位信息
/// - 纯计算，不触发事件
#[derive(Debug, Clone)]
pub struct TradingAccount {
    /// 钱包余额 (USDT)
    /// 包含已实现盈亏，不包含未实现盈亏
    balance: f64,

    /// 默认杠杆倍数 (1-125)
    /// 开仓时如未指定杠杆，使用此默认值
    leverage: u8,
}

impl Default for TradingAccount {
    fn default() -> Self {
        Self::new()
    }
}

impl TradingAccount {
    /// 创建新账户 (使用默认余额和杠杆)
    pub fn new() -> Self {
        Self {
            balance: DEFAULT_INITIAL_BALANCE,
            leverage: DEFAULT_LEVERAGE,
        }
    }

    /// 创建指定余额的账户
    pub fn with_balance(balance: f64) -> Self {
        Self {
            balance,
            leverage: DEFAULT_LEVERAGE,
        }
    }

    /// 创建自定义配置的账户
    pub fn custom(balance: f64, leverage: u8) -> Self {
        Self {
            balance,
            leverage: leverage.clamp(1, 125),
        }
    }

    // ========================================================================
    // Getter 方法
    // ========================================================================

    /// 获取钱包余额
    #[inline]
    pub fn balance(&self) -> f64 {
        self.balance
    }

    /// 获取默认杠杆
    #[inline]
    pub fn leverage(&self) -> u8 {
        self.leverage
    }

    // ========================================================================
    // 余额管理
    // ========================================================================

    /// 更新余额 (加上已实现盈亏)
    ///
    /// # Arguments
    /// - `pnl`: 已实现盈亏 (正为盈利，负为亏损)
    ///
    /// # 注意
    /// 余额不会变为负数，最小为 0
    pub fn update_balance(&mut self, pnl: f64) {
        self.balance = (self.balance + pnl).max(0.0);
    }

    /// 直接设置余额 (用于重置账户)
    pub fn set_balance(&mut self, balance: f64) {
        self.balance = balance.max(0.0);
    }

    /// 从余额扣除金额 (用于逐仓增加保证金)
    ///
    /// # Arguments
    /// - `amount`: 扣除金额
    ///
    /// # 注意
    /// 余额不会变为负数，最小为 0
    pub fn deduct(&mut self, amount: f64) {
        self.balance = (self.balance - amount).max(0.0);
    }

    /// 重置账户到初始状态
    pub fn reset(&mut self, initial_balance: Option<f64>) {
        self.balance = initial_balance.unwrap_or(DEFAULT_INITIAL_BALANCE);
    }

    // ========================================================================
    // 杠杆管理
    // ========================================================================

    /// 设置默认杠杆
    ///
    /// # Arguments
    /// - `leverage`: 杠杆倍数 (1-125)
    /// - `has_positions`: 是否有活跃仓位 (有仓位时不允许修改)
    ///
    /// # Returns
    /// - `true`: 设置成功
    /// - `false`: 设置失败 (超出范围或有仓位)
    pub fn set_leverage(&mut self, leverage: u8, has_positions: bool) -> bool {
        if leverage < 1 || leverage > 125 {
            return false;
        }
        if has_positions {
            return false;
        }
        self.leverage = leverage;
        true
    }

    // ========================================================================
    // 保证金检查
    // ========================================================================

    /// 检查保证金是否充足
    ///
    /// # Arguments
    /// - `required_margin`: 所需保证金
    /// - `position_manager`: 仓位管理器引用 (用于计算可用余额)
    ///
    /// # Returns
    /// - `Ok(())`: 保证金充足
    /// - `Err(String)`: 保证金不足，包含错误信息
    pub fn check_margin(
        &self,
        required_margin: f64,
        position_manager: &PositionManager,
    ) -> Result<(), String> {
        let available = self.calculate_available_balance(position_manager);
        if available >= required_margin {
            Ok(())
        } else {
            Err(format!(
                "保证金不足: 需要 {:.2} USDT, 可用 {:.2} USDT",
                required_margin, available
            ))
        }
    }

    // ========================================================================
    // 权益计算 (从 engine.rs 提取的逻辑)
    // ========================================================================

    /// 计算账户权益
    ///
    /// 账户权益 = 钱包余额 + 所有仓位未实现盈亏
    ///
    /// # Arguments
    /// - `total_unrealized_pnl`: 所有仓位的未实现盈亏总和
    ///
    /// # Returns
    /// 账户权益 (f64)
    #[inline]
    pub fn get_equity(&self, total_unrealized_pnl: f64) -> f64 {
        self.balance + total_unrealized_pnl
    }

    /// 计算可用余额
    ///
    /// ## Cross 模式
    /// 可用 = 余额 - Cross保证金 + Cross未实现盈亏 - Isolated锁定
    ///
    /// ## Isolated 模式
    /// 保证金已锁定在仓位中，不影响可用余额计算
    ///
    /// # Arguments
    /// - `position_manager`: 仓位管理器引用
    ///
    /// # Returns
    /// 可用余额 (非负)
    ///
    /// # 原始逻辑 (来自 engine.rs)
    /// ```text
    /// (self.balance - total_cross_margin + total_unrealized_pnl - total_isolated_margin).max(0.0)
    /// ```
    pub fn calculate_available_balance(&self, position_manager: &PositionManager) -> f64 {
        if position_manager.is_empty() {
            return self.balance;
        }

        let total_isolated_margin = position_manager.total_isolated_margin();
        let total_cross_margin = position_manager.total_cross_margin();
        let total_cross_unrealized_pnl = position_manager.total_cross_unrealized_pnl();

        // Cross 可用 = 余额 - Cross保证金 + Cross未实现盈亏 - Isolated锁定
        (self.balance - total_cross_margin + total_cross_unrealized_pnl - total_isolated_margin)
            .max(0.0)
    }

    /// 计算账户权益 (使用 PositionManager)
    ///
    /// # Arguments
    /// - `position_manager`: 仓位管理器引用
    ///
    /// # Returns
    /// 账户权益 = 余额 + 所有未实现盈亏
    pub fn calculate_account_equity(&self, position_manager: &PositionManager) -> f64 {
        self.balance + position_manager.total_unrealized_pnl()
    }

    // ========================================================================
    // 强平处理
    // ========================================================================

    /// 强平后清零余额 (保证金已损失)
    ///
    /// 当全仓模式触发强平时调用
    pub fn slash(&mut self) {
        self.balance = 0.0;
    }
}

// ============================================================================
// 单元测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::risk::PositionSide;
    use crate::trading::{Position, MarginMode};

    fn create_test_position(symbol: &str, margin: f64, mode: MarginMode, pnl: f64) -> Position {
        let id = format!("{}_Long", symbol);
        let mut pos = Position::new(
            id,
            symbol.to_string(),
            PositionSide::Long,
            0.1,
            50000.0,
            margin,
            10,
            mode,
            45000.0,
            1000,
        );
        pos.unrealized_pnl = pnl;
        pos
    }

    #[test]
    fn test_account_new() {
        let account = TradingAccount::new();
        assert_eq!(account.balance(), DEFAULT_INITIAL_BALANCE);
        assert_eq!(account.leverage(), DEFAULT_LEVERAGE);
    }

    #[test]
    fn test_account_with_balance() {
        let account = TradingAccount::with_balance(5000.0);
        assert_eq!(account.balance(), 5000.0);
    }

    #[test]
    fn test_update_balance() {
        let mut account = TradingAccount::with_balance(1000.0);

        // 盈利
        account.update_balance(100.0);
        assert_eq!(account.balance(), 1100.0);

        // 亏损
        account.update_balance(-200.0);
        assert_eq!(account.balance(), 900.0);

        // 亏损超过余额，不会变负
        account.update_balance(-1000.0);
        assert_eq!(account.balance(), 0.0);
    }

    #[test]
    fn test_set_leverage() {
        let mut account = TradingAccount::new();

        // 无仓位时可以修改
        assert!(account.set_leverage(20, false));
        assert_eq!(account.leverage(), 20);

        // 有仓位时不能修改
        assert!(!account.set_leverage(50, true));
        assert_eq!(account.leverage(), 20);

        // 超出范围
        assert!(!account.set_leverage(0, false));
        assert!(!account.set_leverage(200, false));
    }

    #[test]
    fn test_get_equity() {
        let account = TradingAccount::with_balance(1000.0);

        assert_eq!(account.get_equity(100.0), 1100.0);
        assert_eq!(account.get_equity(-200.0), 800.0);
    }

    #[test]
    fn test_calculate_available_balance_no_positions() {
        let account = TradingAccount::with_balance(10000.0);
        let manager = PositionManager::new();

        assert_eq!(account.calculate_available_balance(&manager), 10000.0);
    }

    #[test]
    fn test_calculate_available_balance_with_cross_position() {
        let account = TradingAccount::with_balance(10000.0);
        let mut manager = PositionManager::new();

        // Cross 仓位: 500 保证金, 100 未实现盈利
        let pos = create_test_position("BTCUSDT", 500.0, MarginMode::Cross, 100.0);
        manager.insert(pos);

        // 可用 = 10000 - 500 + 100 - 0 = 9600
        assert!((account.calculate_available_balance(&manager) - 9600.0).abs() < 0.01);
    }

    #[test]
    fn test_calculate_available_balance_with_isolated_position() {
        let account = TradingAccount::with_balance(10000.0);
        let mut manager = PositionManager::new();

        // Isolated 仓位: 300 保证金
        let pos = create_test_position("ETHUSDT", 300.0, MarginMode::Isolated, 50.0);
        manager.insert(pos);

        // 可用 = 10000 - 0 + 0 - 300 = 9700
        assert!((account.calculate_available_balance(&manager) - 9700.0).abs() < 0.01);
    }

    #[test]
    fn test_check_margin() {
        let account = TradingAccount::with_balance(1000.0);
        let manager = PositionManager::new();

        // 充足
        assert!(account.check_margin(500.0, &manager).is_ok());

        // 不足
        assert!(account.check_margin(2000.0, &manager).is_err());
    }

    #[test]
    fn test_reset() {
        let mut account = TradingAccount::with_balance(5000.0);
        account.reset(None);
        assert_eq!(account.balance(), DEFAULT_INITIAL_BALANCE);

        account.reset(Some(20000.0));
        assert_eq!(account.balance(), 20000.0);
    }

    #[test]
    fn test_slash() {
        let mut account = TradingAccount::with_balance(10000.0);
        account.slash();
        assert_eq!(account.balance(), 0.0);
    }
}
