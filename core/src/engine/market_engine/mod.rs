//! # MarketEngine 核心模块
//!
//! 包含 MarketEngine 结构体定义、Wasm API 和 impl 扩展。

// impl 扩展模块
mod market_data;     // 市场数据处理
mod state_builder;   // 状态构建
mod risk_control;    // 风控处理
mod trade_executor;  // 交易执行

use std::collections::HashMap;
use wasm_bindgen::prelude::*;

use crate::models::{OrderBook, SimOrder, Timeframe};
use crate::risk::{LiquidationResult, RiskConfig};
use crate::trading::{PendingOrderManager, Position, PositionManager, TradingAccount};

use super::data::{CandleAggregator, CandleCache, TickDataManager};
use super::trading::SimOrderExecutor;
use super::types::{CancelOrderResult, EngineEvent, OpenPositionRequest};

// 测试模块需要的额外导入
#[cfg(test)]
use crate::risk::PositionSide;
#[cfg(test)]
use crate::trading::MarginMode;

/// Wasm 序列化辅助宏
macro_rules! to_js {
    ($expr:expr) => {
        serde_wasm_bindgen::to_value(&$expr)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    };
}

/// Wasm 反序列化辅助宏
macro_rules! from_js {
    ($val:expr, $ty:ty, $msg:expr) => {
        serde_wasm_bindgen::from_value::<$ty>($val)
            .map_err(|e| JsValue::from_str(&format!("{}: {}", $msg, e)))
    };
}

// ============================================================================
// MarketEngine 结构体
// ============================================================================

/// 市场分析引擎
///
/// 有状态的引擎，维护价格和成交量历史，
/// 每次 tick 更新时计算所有技术指标。
/// 同时管理模拟交易状态：仓位、余额、风控。
#[wasm_bindgen]
pub struct MarketEngine {
    /// Tick 数据管理器
    pub(crate) tick_data: TickDataManager,
    /// 当前激活的时间周期
    pub(crate) active_timeframe: Timeframe,
    /// 各时间周期的 K 线历史
    pub(crate) candle_cache: HashMap<Timeframe, CandleCache>,
    /// 风控配置
    pub(crate) risk_config: RiskConfig,
    /// 交易账户
    pub(crate) account: TradingAccount,
    /// 当前市场价格
    pub(crate) current_price: f64,
    /// 各交易对的价格缓存
    pub(crate) symbol_prices: HashMap<String, f64>,
    /// 仓位管理器
    pub(crate) position_manager: PositionManager,
    /// 挂单管理器
    pub(crate) pending_order_manager: PendingOrderManager,
    /// 最新风险评估结果
    pub(crate) risk_assessment: Option<LiquidationResult>,
    /// 待消费的事件队列
    pub(crate) pending_events: Vec<EngineEvent>,
}

// ============================================================================
// Wasm 绑定方法
// ============================================================================

#[wasm_bindgen]
impl MarketEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> MarketEngine {
        MarketEngine {
            tick_data: TickDataManager::new(),
            active_timeframe: Timeframe::S1,
            candle_cache: HashMap::new(),
            risk_config: RiskConfig::default(),
            account: TradingAccount::new(),
            current_price: 0.0,
            symbol_prices: HashMap::new(),
            position_manager: PositionManager::new(),
            pending_order_manager: PendingOrderManager::new(),
            risk_assessment: None,
            pending_events: Vec::new(),
        }
    }

    /// 处理 Tick 数据更新
    pub fn on_tick(&mut self, val: JsValue) -> Result<JsValue, JsValue> {
        let order_book: OrderBook = from_js!(val, OrderBook, "解析 OrderBook 失败")?;
        self.process_tick(&order_book);
        to_js!(self.compute_all_indicators(&order_book))
    }

    pub fn history_length(&self) -> usize { self.tick_data.len() }

    pub fn clear_history(&mut self) {
        self.tick_data.clear();
        self.candle_cache.clear();
    }

    pub fn set_timeframe(&mut self, timeframe_str: &str) -> bool {
        Timeframe::from_str(timeframe_str).map(|tf| self.active_timeframe = tf).is_some()
    }

    pub fn get_timeframe(&self) -> String { self.active_timeframe.as_str().to_string() }

    pub fn get_candles(&self, timeframe_str: &str) -> Result<JsValue, JsValue> {
        let tf = Timeframe::from_str(timeframe_str)
            .ok_or_else(|| JsValue::from_str(&format!("无效的时间周期: {}", timeframe_str)))?;
        to_js!(self.build_candle_history(tf, timeframe_str))
    }

    pub fn get_active_candles(&self) -> Result<JsValue, JsValue> {
        self.get_candles(self.active_timeframe.as_str())
    }

    pub fn get_candle_count(&self, timeframe_str: &str) -> usize {
        Timeframe::from_str(timeframe_str)
            .and_then(|tf| self.candle_cache.get(&tf))
            .map(|c| c.history.len())
            .unwrap_or(0)
    }

    /// 提交模拟订单
    pub fn submit_order(&mut self, val: JsValue) -> Result<JsValue, JsValue> {
        let order: SimOrder = from_js!(val, SimOrder, "解析订单失败")?;
        let price = self.tick_data.last_price().unwrap_or(order.price);
        let result = SimOrderExecutor::execute(&order, price);
        
        let ts = self.get_timestamp();
        self.tick_data.push_price(result.executed_price);
        self.tick_data.push_volume(result.executed_volume);
        CandleAggregator::update_all(&mut self.candle_cache, ts, result.executed_price, result.executed_volume);
        
        to_js!(result)
    }

    // ========== 交易状态 ==========

    pub fn get_trading_state(&mut self) -> Result<JsValue, JsValue> { to_js!(self.build_trading_state()) }
    pub fn set_leverage(&mut self, leverage: u8) -> bool { self.account.set_leverage(leverage, self.position_manager.has_isolated_positions()) }
    pub fn get_leverage(&self) -> u8 { self.account.leverage() }
    pub fn get_balance(&self) -> f64 { self.account.balance() }

    pub fn reset_balance(&mut self, initial_balance: Option<f64>) {
        self.account.reset(initial_balance);
        self.position_manager.clear();
        self.pending_order_manager.clear();
        self.symbol_prices.clear();
        self.risk_assessment = None;
        self.pending_events.clear();
    }

    pub fn set_flat_risk_config(&mut self, maintenance_margin_rate: f64, initial_margin_rate: f64) {
        self.risk_config = RiskConfig::flat(maintenance_margin_rate, initial_margin_rate);
    }

    pub fn get_position(&self, symbol: &str) -> Result<JsValue, JsValue> {
        match self.position_manager.get(symbol) {
            Some(pos) => to_js!(pos),
            None => Ok(JsValue::NULL),
        }
    }

    pub fn position_count(&self) -> usize { self.position_manager.len() }

    // ========== 交易操作 ==========

    pub fn open_position(&mut self, val: JsValue) -> Result<JsValue, JsValue> {
        let req = from_js!(val, OpenPositionRequest, "解析开仓请求失败")?;
        to_js!(self.open_position_internal(req))
    }

    pub fn close_position_by_symbol(&mut self, symbol: Option<String>, exit_price: Option<f64>, close_size: Option<f64>) -> Result<JsValue, JsValue> {
        let sym = symbol.unwrap_or_else(|| "BTCUSDT".to_string());
        let price = exit_price.unwrap_or(self.current_price);
        to_js!(self.close_position_internal(&sym, price, close_size, false))
    }

    pub fn close_position(&mut self, exit_price: Option<f64>) -> Result<JsValue, JsValue> {
        self.close_position_by_symbol(None, exit_price, None)
    }

    pub fn has_position_for_symbol(&self, symbol: &str) -> bool { self.position_manager.contains(symbol) }
    pub fn has_position(&self) -> bool { !self.position_manager.is_empty() }
    pub fn pending_event_count(&self) -> usize { self.pending_events.len() }
    pub fn pending_order_count(&self) -> usize { self.pending_order_manager.active_count() }

    pub fn cancel_order(&mut self, order_id: &str) -> Result<JsValue, JsValue> {
        to_js!(self.cancel_order_internal(order_id))
    }

    pub fn cancel_all_orders(&mut self) -> Result<JsValue, JsValue> {
        let released = self.pending_order_manager.cancel_all();
        to_js!(CancelOrderResult { success: true, message: format!("已取消所有挂单，解冻保证金 {:.2} USDT", released), released_margin: released })
    }
}

impl Default for MarketEngine {
    fn default() -> Self { Self::new() }
}

// ============================================================================
// 测试辅助方法
// ============================================================================

#[cfg(test)]
impl MarketEngine {
    pub fn with_prices(prices: Vec<f64>) -> Self {
        let current_price = prices.last().copied().unwrap_or(0.0);
        MarketEngine {
            tick_data: TickDataManager::with_prices(prices),
            active_timeframe: Timeframe::S1,
            candle_cache: HashMap::new(),
            risk_config: RiskConfig::default(),
            account: TradingAccount::new(),
            current_price,
            symbol_prices: HashMap::new(),
            position_manager: PositionManager::new(),
            pending_order_manager: PendingOrderManager::new(),
            risk_assessment: None,
            pending_events: Vec::new(),
        }
    }

    pub fn with_volumes(mut self, volumes: Vec<f64>) -> Self { self.tick_data.set_volumes(volumes); self }
    pub fn with_balance(mut self, balance: f64) -> Self { self.account.set_balance(balance); self }
    pub fn with_current_price(mut self, price: f64) -> Self { self.current_price = price; self }
    pub fn prices(&self) -> &[f64] { self.tick_data.prices() }
    pub fn volumes(&self) -> &[f64] { self.tick_data.volumes() }
    
    pub fn get_test_position(&self) -> Option<&Position> {
        self.position_manager.get("BTCUSDT_Long").or_else(|| self.position_manager.get("BTCUSDT_Short"))
    }
    
    pub fn get_position_manager(&self) -> &PositionManager { &self.position_manager }
    pub fn get_pending_events(&self) -> &[EngineEvent] { &self.pending_events }
}
