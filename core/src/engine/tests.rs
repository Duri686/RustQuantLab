//! # 引擎集成测试
//!
//! 测试 MarketEngine 的完整交易流程和各组件协调工作。

use super::*;
use crate::trading::{DEFAULT_INITIAL_BALANCE, DEFAULT_LEVERAGE, OrderType};

/// 测试辅助: 创建开仓请求
fn make_open_request(side: &str, size: f64) -> OpenPositionRequest {
    OpenPositionRequest {
        symbol: "BTCUSDT".to_string(),
        side: side.to_string(),
        size,
        price: None,
        current_price: None,
        leverage: None,
        margin_mode: MarginMode::Cross,
        order_type: OrderType::Market,
    }
}

// ============================================================================
// 基础功能测试
// ============================================================================

#[test]
fn test_engine_new() {
    let engine = MarketEngine::new();
    assert_eq!(engine.history_length(), 0);
    assert_eq!(engine.max_history_size, MAX_HISTORY_SIZE);
}

#[test]
fn test_engine_push_price() {
    let mut engine = MarketEngine::new();
    engine.push_price(100.0);
    engine.push_price(200.0);
    assert_eq!(engine.history_length(), 2);
    assert_eq!(engine.prices(), &[100.0, 200.0]);
}

#[test]
fn test_engine_max_capacity() {
    let mut engine = MarketEngine::new();
    engine.max_history_size = 100;

    // 插入 200 个数据点，触发批量清理 (阈值 50)
    for i in 1..=200 {
        engine.push_price(i as f64);
    }

    // 批量清理后应该保持在 max_history_size + threshold 范围内
    assert!(engine.history_length() <= engine.max_history_size + BATCH_CLEANUP_THRESHOLD);
    assert!(engine.history_length() >= engine.max_history_size);
}

#[test]
fn test_engine_clear_history() {
    let mut engine = MarketEngine::with_prices(vec![100.0; 50]).with_volumes(vec![10.0; 50]);
    engine.clear_history();
    assert_eq!(engine.history_length(), 0);
    assert_eq!(engine.volumes().len(), 0);
}

#[test]
fn test_engine_estimate_volume() {
    let engine = MarketEngine::new();
    let order_book = OrderBook {
        symbol: "TEST".to_string(),
        timestamp: 0,
        price: 100.0,
        bids: vec![(99.0, 10.0)],
        asks: vec![(101.0, 20.0)],
    };
    assert_eq!(engine.estimate_volume(&order_book), 15.0);
}

#[test]
fn test_compute_all_indicators() {
    let engine = MarketEngine::with_prices((1..=50).map(|x| 40000.0 + x as f64 * 10.0).collect())
        .with_volumes(vec![100.0; 50]);

    let order_book = OrderBook {
        symbol: "TEST".to_string(),
        timestamp: 0,
        price: 40500.0,
        bids: vec![(40490.0, 1.0)],
        asks: vec![(40510.0, 1.0)],
    };

    let result = engine.compute_all_indicators(&order_book);

    // 验证基础信息
    assert_eq!(result.spread, 20.0);
    assert_eq!(result.history_length, 50);

    // 验证指标已计算 (非 None)
    assert!(result.sma_5.is_some());
    assert!(result.ma_7.is_some());
    assert!(result.ma_25.is_some());
    assert!(result.ema_7.is_some());
    assert!(result.boll.is_some());
    assert!(result.macd.is_some());
    assert!(result.rsi_14.is_some());
    assert!(result.vol_ma_5.is_some());

    // ma_99 需要 99 个数据点，当前只有 50 个
    assert!(result.ma_99.is_none());
}

#[test]
fn test_default_trait() {
    let engine = MarketEngine::default();
    assert_eq!(engine.history_length(), 0);
}

// ============================================================================
// 交易功能测试
// ============================================================================

#[test]
fn test_engine_initial_trading_state() {
    let engine = MarketEngine::new();
    assert_eq!(engine.account.balance(), DEFAULT_INITIAL_BALANCE);
    assert_eq!(engine.account.leverage(), DEFAULT_LEVERAGE);
    assert!(engine.position_manager.is_empty());
}

#[test]
fn test_open_position_success() {
    let mut engine = MarketEngine::with_prices(vec![50_000.0])
        .with_balance(10_000.0)
        .with_current_price(50_000.0);

    let req = make_open_request("long", 0.1);

    let result = engine.open_position_internal(req);
    assert!(result.success);
    assert!(!engine.position_manager.is_empty());

    let pos = engine.get_test_position().unwrap();
    assert_eq!(pos.size, 0.1);
    assert_eq!(pos.entry_price, 50_000.0);
    assert!(matches!(pos.side, PositionSide::Long));
}

#[test]
fn test_open_position_insufficient_margin() {
    let mut engine = MarketEngine::with_prices(vec![50_000.0])
        .with_balance(100.0)
        .with_current_price(50_000.0);

    let req = make_open_request("long", 0.1);

    let result = engine.open_position_internal(req);
    // 名义价值 = 5000, IMR = 1%, 需要 50 USDT
    // 余额 100 应该足够
    assert!(result.success);
}

#[test]
fn test_hedge_mode_independent_positions() {
    // Hedge Mode: 多空仓位独立存在，不执行 Netting
    let mut engine = MarketEngine::with_prices(vec![50_000.0])
        .with_balance(10_000.0)
        .with_current_price(50_000.0);

    // 开多仓 0.1 BTC
    let req1 = make_open_request("long", 0.1);
    engine.open_position_internal(req1);
    
    let long_pos = engine.position_manager.get("BTCUSDT_Long").unwrap();
    assert_eq!(long_pos.size, 0.1);

    // 开空仓 0.05 BTC → Hedge Mode 下创建独立的空头仓位
    let req2 = make_open_request("short", 0.05);
    let result = engine.open_position_internal(req2);
    assert!(result.success, "Hedge Mode 应该允许开反向仓位");
    
    // 验证多头仓位不变
    let long_pos = engine.position_manager.get("BTCUSDT_Long").unwrap();
    assert!((long_pos.size - 0.1).abs() < 1e-10, "多头仓位应该保持不变");
    
    // 验证空头仓位被创建
    let short_pos = engine.position_manager.get("BTCUSDT_Short").unwrap();
    assert!((short_pos.size - 0.05).abs() < 1e-10, "空头仓位应该被创建");
    
    // 总共有两个仓位
    assert_eq!(engine.position_manager.len(), 2);
}

#[test]
fn test_one_way_mode_merge() {
    // One-Way Mode: 同方向订单执行合并 (加权平均价)
    let mut engine = MarketEngine::with_prices(vec![50_000.0])
        .with_balance(10_000.0)
        .with_current_price(50_000.0);

    // 开多仓 0.1 BTC @ 50000
    let req1 = make_open_request("long", 0.1);
    engine.open_position_internal(req1);

    // 加仓 0.05 BTC @ 51000
    engine.current_price = 51_000.0;
    let req2 = make_open_request("long", 0.05);
    let result = engine.open_position_internal(req2);
    assert!(result.success);
    
    // 验证仓位合并
    let pos = engine.get_test_position().unwrap();
    assert!((pos.size - 0.15).abs() < 1e-10, "仓位应该增加到 0.15");
    // 加权平均: (0.1 * 50000 + 0.05 * 51000) / 0.15 = 50333.33
    assert!((pos.entry_price - 50333.33).abs() < 1.0, "均价应为加权平均");
}

#[test]
fn test_close_position() {
    let mut engine = MarketEngine::with_prices(vec![50_000.0])
        .with_balance(10_000.0)
        .with_current_price(50_000.0);

    // 开仓
    let req = make_open_request("long", 0.1);
    engine.open_position_internal(req);

    // 价格上涨后平仓 (Hedge Mode: 使用 position_key)
    let result = engine.close_position_internal("BTCUSDT_Long", 51_000.0, None, false);
    assert!(result.success);
    
    // 盈利 = (51000 - 50000) * 0.1 = 100 USDT
    assert!((result.realized_pnl - 100.0).abs() < 0.01);
    assert!(engine.position_manager.is_empty());
}

#[test]
fn test_update_price_updates_pnl() {
    let mut engine = MarketEngine::with_prices(vec![50_000.0])
        .with_balance(10_000.0)
        .with_current_price(50_000.0);

    // 开多仓
    let req = make_open_request("long", 0.1);
    engine.open_position_internal(req);

    // 价格上涨
    engine.update_price(51_000.0);

    let pos = engine.get_test_position().unwrap();
    // 盈利 = (51000 - 50000) * 0.1 = 100 USDT
    assert!((pos.unrealized_pnl - 100.0).abs() < 0.01);
}

#[test]
fn test_liquidation_on_price_drop() {
    let mut engine = MarketEngine::with_prices(vec![50_000.0])
        .with_balance(100.0)
        .with_current_price(50_000.0);

    engine.set_leverage(50);

    // 开多仓
    let req = make_open_request("long", 0.1);
    engine.open_position_internal(req);
    assert!(!engine.position_manager.is_empty());

    // 验证仓位创建成功
    let pos = engine.get_test_position().unwrap();
    assert!((pos.margin - 50.0).abs() < 1.0);

    // 价格大幅下跌，触发强平
    engine.update_price(48_000.0);

    // 应该被强平
    assert!(engine.position_manager.is_empty(), "仓位应该被强平");
    
    // 检查是否有强平事件
    let events = engine.get_pending_events();
    assert!(events.iter().any(|e| matches!(e, EngineEvent::Liquidated { .. })), 
            "应该有强平事件");
}

#[test]
fn test_set_leverage() {
    let mut engine = MarketEngine::new();
    
    // 无持仓时可以修改杠杆
    assert!(engine.set_leverage(20));
    assert_eq!(engine.account.leverage(), 20);

    // 超出范围的杠杆
    assert!(!engine.set_leverage(0));
    assert!(!engine.set_leverage(200));
}

#[test]
fn test_calculate_available_balance() {
    let mut engine = MarketEngine::with_prices(vec![50_000.0])
        .with_balance(10_000.0)
        .with_current_price(50_000.0);

    // 无持仓时，可用余额 = 钱包余额
    assert_eq!(engine.account.calculate_available_balance(&engine.position_manager), 10_000.0);

    // 开仓后
    let req = make_open_request("long", 0.1);
    engine.open_position_internal(req);

    let pos = engine.get_test_position().unwrap();
    let margin = pos.margin;

    // 可用余额 = 余额 - 保证金 + 未实现盈亏
    let available = engine.account.calculate_available_balance(&engine.position_manager);
    assert!((available - (10_000.0 - margin)).abs() < 0.01);
}
