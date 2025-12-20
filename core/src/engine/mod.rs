//! # MarketEngine - 有状态的市场分析引擎
//!
//! 负责状态管理和业务编排，调用 `indicators` 模块执行计算。
//!
//! ## 职责
//! - 维护价格和成交量历史
//! - 处理每次 Tick 数据更新
//! - 调用指标计算函数并组装结果
//! - **K 线聚合**: 支持多时间周期 K 线生成
//! - **模拟交易**: 仓位管理、盈亏计算、风控强平
//!
//! ## 模块结构
//! - `types`: 事件、状态、请求/响应类型
//! - `candles`: K 线聚合和指标计算
//! - `trading_ops`: 交易执行逻辑

pub mod types;
pub mod candles;
pub mod trading_ops;

#[cfg(test)]
mod tests;

// 重新导出公共类型
pub use types::{
    ClosePositionResult, EngineEvent, OpenPositionRequest, OpenPositionResult, TradingState,
    PlaceOrderResult, CancelOrderResult,
};

use std::collections::HashMap;
use wasm_bindgen::prelude::*;

use crate::indicators;
use crate::models::{
    AnalysisResult, CandleHistory, OrderBook, SimOrder, SimOrderResult, SimOrderSide, Timeframe,
};
use crate::risk::{LiquidationResult, RiskConfig};
use crate::trading::{OrderType, PendingOrderManager, Position, PositionManager, TradingAccount};

// 测试模块需要的额外导入
#[cfg(test)]
use crate::risk::PositionSide;
#[cfg(test)]
use crate::trading::MarginMode;

use candles::{CandleAggregator, CandleCache, CandleIndicatorCalculator};
use trading_ops::TradingExecutor;

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
// MarketEngine 结构体
// ============================================================================

/// 市场分析引擎
///
/// 有状态的引擎，维护价格和成交量历史，
/// 每次 tick 更新时计算所有技术指标。
/// 同时管理模拟交易状态：仓位、余额、风控。
///
/// ## 多仓位支持 (v2)
/// - 支持多个交易对同时持仓 (HashMap<Symbol, Position>)
/// - One-Way Mode: 同方向合并 (加权平均), 反方向减仓 (Netting)
/// - Cross/Isolated 保证金模式
#[wasm_bindgen]
pub struct MarketEngine {
    /// 价格历史列表 (tick 级别)
    price_history: Vec<f64>,

    /// 成交量历史列表 (tick 级别)
    volume_history: Vec<f64>,

    /// 最大历史容量
    max_history_size: usize,

    // ========== K 线聚合相关 ==========
    
    /// 当前激活的时间周期
    active_timeframe: Timeframe,

    /// 各时间周期的 K 线历史
    candle_cache: HashMap<Timeframe, CandleCache>,

    // ========== 交易状态相关 ==========

    /// 风控配置 (阶梯保证金率)
    risk_config: RiskConfig,

    /// 交易账户 (封装余额与杠杆管理)
    account: TradingAccount,

    /// 当前市场价格 (主交易对 BTCUSDT)
    current_price: f64,

    /// 各交易对的价格缓存
    symbol_prices: HashMap<String, f64>,

    /// 仓位管理器 (封装多仓位 CRUD 和 One-Way Mode 逻辑)
    position_manager: PositionManager,

    /// 挂单管理器 (限价单队列)
    pending_order_manager: PendingOrderManager,

    /// 最新风险评估结果 (当前选中仓位)
    risk_assessment: Option<LiquidationResult>,

    /// 待消费的事件队列
    pending_events: Vec<EngineEvent>,
}

// ============================================================================
// Wasm 绑定方法
// ============================================================================

#[wasm_bindgen]
impl MarketEngine {
    /// 创建新的 MarketEngine 实例
    #[wasm_bindgen(constructor)]
    pub fn new() -> MarketEngine {
        MarketEngine {
            price_history: Vec::with_capacity(INITIAL_CAPACITY),
            volume_history: Vec::with_capacity(INITIAL_CAPACITY),
            max_history_size: MAX_HISTORY_SIZE,
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

    /// 处理单次 Tick 数据更新
    pub fn on_tick(&mut self, val: JsValue) -> Result<JsValue, JsValue> {
        let order_book: OrderBook = serde_wasm_bindgen::from_value(val)
            .map_err(|e| JsValue::from_str(&format!("解析 OrderBook 失败: {}", e)))?;

        self.push_price(order_book.price);
        let estimated_volume = self.estimate_volume(&order_book);
        self.push_volume(estimated_volume);

        CandleAggregator::update_all(
            &mut self.candle_cache,
            order_book.timestamp,
            order_book.price,
            estimated_volume,
        );

        self.update_price(order_book.price);

        let result = self.compute_all_indicators(&order_book);

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("序列化结果失败: {}", e)))
    }

    /// 获取当前历史数据长度
    pub fn history_length(&self) -> usize {
        self.price_history.len()
    }

    /// 清空所有历史数据
    pub fn clear_history(&mut self) {
        self.price_history.clear();
        self.volume_history.clear();
        self.candle_cache.clear();
    }

    /// 设置当前激活的时间周期
    pub fn set_timeframe(&mut self, timeframe_str: &str) -> bool {
        if let Some(tf) = Timeframe::from_str(timeframe_str) {
            self.active_timeframe = tf;
            true
        } else {
            false
        }
    }

    /// 获取当前激活的时间周期
    pub fn get_timeframe(&self) -> String {
        self.active_timeframe.as_str().to_string()
    }

    /// 获取指定时间周期的 K 线历史
    pub fn get_candles(&self, timeframe_str: &str) -> Result<JsValue, JsValue> {
        let tf = Timeframe::from_str(timeframe_str)
            .ok_or_else(|| JsValue::from_str(&format!("无效的时间周期: {}", timeframe_str)))?;

        let cache = self.candle_cache.get(&tf);
        let candles = cache.map(|c| c.history.clone()).unwrap_or_default();
        let current_candle = cache.and_then(|c| c.current.clone());

        let indicators = CandleIndicatorCalculator::compute(&candles, current_candle.as_ref());
        
        let history = CandleHistory {
            timeframe: timeframe_str.to_string(),
            candles,
            current_candle,
            indicators,
        };

        serde_wasm_bindgen::to_value(&history)
            .map_err(|e| JsValue::from_str(&format!("序列化 K 线失败: {}", e)))
    }

    /// 获取当前激活时间周期的 K 线历史
    pub fn get_active_candles(&self) -> Result<JsValue, JsValue> {
        self.get_candles(self.active_timeframe.as_str())
    }

    /// 获取指定时间周期的 K 线数量
    pub fn get_candle_count(&self, timeframe_str: &str) -> usize {
        Timeframe::from_str(timeframe_str)
            .and_then(|tf| self.candle_cache.get(&tf))
            .map(|c| c.history.len())
            .unwrap_or(0)
    }

    /// 提交模拟订单
    pub fn submit_order(&mut self, val: JsValue) -> Result<JsValue, JsValue> {
        let order: SimOrder = serde_wasm_bindgen::from_value(val)
            .map_err(|e| JsValue::from_str(&format!("解析订单失败: {}", e)))?;

        let current_price = self.price_history.last().copied().unwrap_or(order.price);
        let order_value = order.price * order.size;

        let base_impact_rate = 0.0001;
        let size_multiplier = (1.0 + order.size.ln().abs()).min(5.0);
        let price_impact_percent = base_impact_rate * size_multiplier * (order_value / 10000.0).min(1.0);

        let price_impact = match order.side {
            SimOrderSide::Buy => current_price * price_impact_percent,
            SimOrderSide::Sell => -current_price * price_impact_percent,
        };

        let executed_price = current_price + price_impact;
        let volume_multiplier = 1.5 + (order.size * 0.5).min(1.5);
        let executed_volume = order.size * volume_multiplier;
        let timestamp = js_sys::Date::now() as u64;

        self.push_price(executed_price);
        self.push_volume(executed_volume);

        CandleAggregator::update_all(
            &mut self.candle_cache,
            timestamp,
            executed_price,
            executed_volume,
        );

        let side_str = match order.side {
            SimOrderSide::Buy => "buy",
            SimOrderSide::Sell => "sell",
        };

        let result = SimOrderResult {
            success: true,
            executed_price,
            price_impact,
            executed_volume,
            side: side_str.to_string(),
            message: format!(
                "订单已执行: {} {} BTC @ {:.2} USDT, 价格影响 {:.2}",
                side_str, order.size, executed_price, price_impact
            ),
        };

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("序列化结果失败: {}", e)))
    }

    // ========== 交易状态管理方法 ==========

    /// 获取当前交易状态
    pub fn get_trading_state(&mut self) -> Result<JsValue, JsValue> {
        let events = std::mem::take(&mut self.pending_events);

        let available = self.account.calculate_available_balance(&self.position_manager);
        let account_equity = self.account.calculate_account_equity(&self.position_manager);
        
        let positions: Vec<Position> = self.position_manager.to_vec();
        let primary_position = self.position_manager.get("BTCUSDT").cloned()
            .or_else(|| positions.first().cloned());

        let state = TradingState {
            balance: self.account.balance(),
            available_balance: available,
            account_equity,
            leverage: self.account.leverage(),
            current_price: self.current_price,
            positions,
            closed_positions: self.position_manager.closed_positions().clone(),
            position: primary_position,
            risk_assessment: self.risk_assessment.clone(),
            pending_events: events,
            pending_orders: self.pending_order_manager.to_vec(),
        };

        serde_wasm_bindgen::to_value(&state)
            .map_err(|e| JsValue::from_str(&format!("序列化交易状态失败: {}", e)))
    }

    /// 设置杠杆倍数
    /// 全仓模式: 允许随时调整杠杆
    /// 逐仓模式: 持仓期间不允许调整
    pub fn set_leverage(&mut self, leverage: u8) -> bool {
        // 只有存在逐仓仓位时才禁止修改杠杆
        self.account.set_leverage(leverage, self.position_manager.has_isolated_positions())
    }

    /// 获取当前杠杆倍数
    pub fn get_leverage(&self) -> u8 {
        self.account.leverage()
    }

    /// 获取当前余额
    pub fn get_balance(&self) -> f64 {
        self.account.balance()
    }

    /// 重置账户余额
    pub fn reset_balance(&mut self, initial_balance: Option<f64>) {
        self.account.reset(initial_balance);
        self.position_manager.clear();
        self.pending_order_manager.clear();
        self.symbol_prices.clear();
        self.risk_assessment = None;
        self.pending_events.clear();
    }

    /// 配置简化风控参数 (统一费率模式)
    ///
    /// 用于不同交易对或自定义手续费模型。
    ///
    /// # 参数
    /// - `maintenance_margin_rate`: 维持保证金率 (如 0.005 = 0.5%)
    /// - `initial_margin_rate`: 初始保证金率 (如 0.01 = 1%)
    ///
    /// # 示例 (JavaScript)
    /// ```javascript
    /// engine.set_flat_risk_config(0.005, 0.01); // 0.5% MMR, 1% IMR
    /// ```
    pub fn set_flat_risk_config(&mut self, maintenance_margin_rate: f64, initial_margin_rate: f64) {
        use crate::risk::RiskConfig;
        self.risk_config = RiskConfig::flat(maintenance_margin_rate, initial_margin_rate);
    }
    
    /// 获取指定交易对的仓位
    pub fn get_position(&self, symbol: &str) -> Result<JsValue, JsValue> {
        match self.position_manager.get(symbol) {
            Some(pos) => serde_wasm_bindgen::to_value(pos)
                .map_err(|e| JsValue::from_str(&format!("序列化仓位失败: {}", e))),
            None => Ok(JsValue::NULL),
        }
    }
    
    /// 获取所有仓位数量
    pub fn position_count(&self) -> usize {
        self.position_manager.len()
    }

    /// 开仓
    pub fn open_position(&mut self, val: JsValue) -> Result<JsValue, JsValue> {
        let req: OpenPositionRequest = serde_wasm_bindgen::from_value(val)
            .map_err(|e| JsValue::from_str(&format!("解析开仓请求失败: {}", e)))?;

        let result = self.open_position_internal(req);

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("序列化开仓结果失败: {}", e)))
    }

    /// 平仓 (指定交易对)
    pub fn close_position_by_symbol(
        &mut self, 
        symbol: Option<String>,
        exit_price: Option<f64>,
        close_size: Option<f64>,
    ) -> Result<JsValue, JsValue> {
        let sym = symbol.unwrap_or_else(|| "BTCUSDT".to_string());
        let price = exit_price.unwrap_or(self.current_price);
        let result = self.close_position_internal(&sym, price, close_size, false);

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("序列化平仓结果失败: {}", e)))
    }

    /// 平仓 (向后兼容)
    pub fn close_position(&mut self, exit_price: Option<f64>) -> Result<JsValue, JsValue> {
        self.close_position_by_symbol(None, exit_price, None)
    }

    /// 检查指定交易对是否有仓位
    pub fn has_position_for_symbol(&self, symbol: &str) -> bool {
        self.position_manager.contains(symbol)
    }

    /// 检查是否有任何活跃仓位
    pub fn has_position(&self) -> bool {
        !self.position_manager.is_empty()
    }

    /// 获取待处理事件数量
    pub fn pending_event_count(&self) -> usize {
        self.pending_events.len()
    }

    /// 获取活跃挂单数量
    pub fn pending_order_count(&self) -> usize {
        self.pending_order_manager.active_count()
    }

    /// 取消挂单
    pub fn cancel_order(&mut self, order_id: &str) -> Result<JsValue, JsValue> {
        let result = self.cancel_order_internal(order_id);
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("序列化取消结果失败: {}", e)))
    }

    /// 取消所有挂单
    pub fn cancel_all_orders(&mut self) -> Result<JsValue, JsValue> {
        let total_released = self.pending_order_manager.cancel_all();
        let result = CancelOrderResult {
            success: true,
            message: format!("已取消所有挂单，解冻保证金 {:.2} USDT", total_released),
            released_margin: total_released,
        };
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("序列化取消结果失败: {}", e)))
    }
}

// ============================================================================
// 内部方法 (非 Wasm 导出)
// ============================================================================

impl MarketEngine {
    /// 添加价格到历史
    fn push_price(&mut self, price: f64) {
        self.price_history.push(price);
        let overflow = self.price_history.len().saturating_sub(self.max_history_size);
        if overflow >= BATCH_CLEANUP_THRESHOLD {
            self.price_history.drain(0..overflow);
        }
    }

    /// 添加成交量到历史
    fn push_volume(&mut self, volume: f64) {
        self.volume_history.push(volume);
        let overflow = self.volume_history.len().saturating_sub(self.max_history_size);
        if overflow >= BATCH_CLEANUP_THRESHOLD {
            self.volume_history.drain(0..overflow);
        }
    }

    /// 从订单簿估算成交量
    fn estimate_volume(&self, order_book: &OrderBook) -> f64 {
        let bid_vol = order_book.bids.first().map(|(_, q)| *q).unwrap_or(0.0);
        let ask_vol = order_book.asks.first().map(|(_, q)| *q).unwrap_or(0.0);
        (bid_vol + ask_vol) / 2.0
    }

    /// 计算所有技术指标
    fn compute_all_indicators(&self, order_book: &OrderBook) -> AnalysisResult {
        let prices = &self.price_history;
        let volumes = &self.volume_history;

        AnalysisResult {
            spread: indicators::calculate_spread(&order_book.bids, &order_book.asks),
            history_length: prices.len(),
            sma_5: indicators::calculate_sma(prices, 5),
            ma_7: indicators::calculate_sma(prices, 7),
            ma_25: indicators::calculate_sma(prices, 25),
            ma_99: indicators::calculate_sma(prices, 99),
            ema_7: indicators::calculate_ema(prices, 7),
            ema_25: indicators::calculate_ema(prices, 25),
            boll: indicators::calculate_boll(prices, 20, 2.0),
            macd: indicators::calculate_macd(prices, 12, 26, 9),
            rsi_14: indicators::calculate_rsi(prices, 14),
            vol_ma_5: indicators::calculate_sma(volumes, 5),
        }
    }

    /// 更新价格并执行风险检查
    fn update_price(&mut self, price: f64) {
        // 1. 检查挂单触发
        let timestamp = self.get_timestamp();
        let triggered_orders = self.pending_order_manager.check_triggers(price, timestamp);
        
        // 执行触发的挂单
        for order in triggered_orders {
            self.execute_triggered_order(order, price);
        }

        // 2. 更新仓位 PnL 和风险检查
        let positions_to_liquidate = TradingExecutor::update_price(
            price,
            &mut self.current_price,
            &mut self.symbol_prices,
            &mut self.position_manager,
            &self.account,
            &self.risk_config,
            &mut self.risk_assessment,
            &mut self.pending_events,
        );

        // 3. 执行强平
        // position_key 是 "BTCUSDT_Long" 格式，需要提取 display_symbol 来获取价格
        for position_key in positions_to_liquidate {
            // 从 position_key 提取 display_symbol (如 "BTCUSDT_Long" -> "BTCUSDT")
            let display_symbol = position_key.rsplit_once('_')
                .map(|(s, _)| s.to_string())
                .unwrap_or_else(|| position_key.clone());
            let pos_price = *self.symbol_prices.get(&display_symbol).unwrap_or(&price);
            self.close_position_internal(&position_key, pos_price, None, true);
        }
    }

    /// 执行触发的挂单
    fn execute_triggered_order(&mut self, order: crate::trading::PendingOrder, fill_price: f64) {
        use crate::risk::PositionSide;
        use crate::trading::MarginMode;

        // 发送挂单成交事件
        self.pending_events.push(EngineEvent::LimitOrderFilled {
            order_id: order.id.clone(),
            symbol: order.symbol.clone(),
            side: format!("{:?}", order.side),
            size: order.size,
            fill_price,
        });

        // 构建开仓请求 (挂单触发后以市价执行)
        let req = OpenPositionRequest {
            symbol: order.symbol,
            side: match order.side {
                PositionSide::Long => "long".to_string(),
                PositionSide::Short => "short".to_string(),
            },
            size: order.size,
            price: Some(fill_price),
            current_price: None, // 市价单不需要
            leverage: Some(order.leverage),
            margin_mode: order.margin_mode,
            order_type: OrderType::Market,
        };

        // 执行开仓
        let timestamp = self.get_timestamp();
        let _ = TradingExecutor::open_position(
            req,
            fill_price,
            &mut self.position_manager,
            &mut self.account,
            &self.risk_config,
            &mut self.pending_events,
            &mut self.risk_assessment,
            || timestamp,
        );
    }

    /// 开仓内部实现 (支持市价单和限价单)
    fn open_position_internal(&mut self, req: OpenPositionRequest) -> OpenPositionResult {
        use crate::risk::PositionSide;
        use crate::trading::PendingOrder;

        // 市价单: 立即执行
        if req.order_type == OrderType::Market {
            let timestamp = self.get_timestamp();
            return TradingExecutor::open_position(
                req,
                self.current_price,
                &mut self.position_manager,
                &mut self.account,
                &self.risk_config,
                &mut self.pending_events,
                &mut self.risk_assessment,
                || timestamp,
            );
        }

        // 限价单: 创建挂单
        let limit_price = match req.price {
            Some(p) if p > 0.0 => p,
            _ => {
                return OpenPositionResult {
                    success: false,
                    message: "限价单必须指定价格".to_string(),
                    position: None,
                    error_code: Some("LIMIT_PRICE_REQUIRED".to_string()),
                };
            }
        };

        // 解析方向
        let order_side = match req.side.to_lowercase().as_str() {
            "long" | "buy" => PositionSide::Long,
            "short" | "sell" => PositionSide::Short,
            _ => {
                return OpenPositionResult {
                    success: false,
                    message: format!("无效的仓位方向: {}", req.side),
                    position: None,
                    error_code: Some("INVALID_SIDE".to_string()),
                };
            }
        };

        let leverage = req.leverage.unwrap_or(self.account.leverage());

        // 计算需要冻结的保证金
        let notional_value = req.size * limit_price;
        let imr = self.risk_config.get_initial_margin_rate(notional_value);
        let frozen_margin = notional_value * imr;

        // 检查可用余额 (考虑已冻结保证金)
        let available = self.account.calculate_available_balance(&self.position_manager)
            - self.pending_order_manager.total_frozen_margin();
        if frozen_margin > available {
            return OpenPositionResult {
                success: false,
                message: format!("可用余额不足: 需要 {:.2} USDT, 可用 {:.2} USDT", frozen_margin, available),
                position: None,
                error_code: Some("INSUFFICIENT_MARGIN".to_string()),
            };
        }

        // 获取当前市场价格 (优先使用引擎内部价格，它通过 onTick 实时更新)
        let market_price = if self.current_price > 0.0 {
            self.current_price
        } else {
            req.current_price.unwrap_or(0.0)
        };
        
        if market_price <= 0.0 {
            return OpenPositionResult {
                success: false,
                message: "限价单需要有效的当前市场价格，请确保已有 tick 数据".to_string(),
                position: None,
                error_code: Some("INVALID_MARKET_PRICE".to_string()),
            };
        }

        // 检查限价是否等于市价 (无意义的挂单)
        if (limit_price - market_price).abs() < 0.01 {
            return OpenPositionResult {
                success: false,
                message: "限价不能等于当前市价，请使用市价单".to_string(),
                position: None,
                error_code: Some("LIMIT_EQUALS_MARKET".to_string()),
            };
        }

        // 创建挂单 (传入当前价格以确定触发方向)
        let timestamp = self.get_timestamp();
        let order_id = self.pending_order_manager.create_order(
            req.symbol.clone(),
            order_side,
            req.size,
            limit_price,
            market_price,  // 当前市场价格，用于确定触发方向
            leverage,
            req.margin_mode,
            frozen_margin,
            timestamp,
        );

        // 获取触发方向用于返回信息
        let trigger_dir = if limit_price > market_price { "等涨" } else { "等跌" };

        // 发送事件
        self.pending_events.push(EngineEvent::LimitOrderCreated {
            order_id: order_id.clone(),
            symbol: req.symbol.clone(),
            side: format!("{:?}", order_side),
            size: req.size,
            limit_price,
            leverage,
        });

        OpenPositionResult {
            success: true,
            message: format!(
                "限价单已创建: {:?} {:.4} {} @ {:.2} [{}，当前价{:.2}]",
                order_side, req.size, req.symbol, limit_price, trigger_dir, market_price
            ),
            position: None,
            error_code: None,
        }
    }

    /// 取消挂单内部实现
    fn cancel_order_internal(&mut self, order_id: &str) -> CancelOrderResult {
        // 获取订单信息用于事件
        let symbol = self.pending_order_manager.get(order_id)
            .map(|o| o.symbol.clone())
            .unwrap_or_default();

        match self.pending_order_manager.cancel_order(order_id) {
            Some(released) => {
                self.pending_events.push(EngineEvent::LimitOrderCancelled {
                    order_id: order_id.to_string(),
                    symbol,
                    released_margin: released,
                });
                CancelOrderResult {
                    success: true,
                    message: format!("挂单已取消，解冻保证金 {:.2} USDT", released),
                    released_margin: released,
                }
            }
            None => CancelOrderResult {
                success: false,
                message: format!("挂单不存在: {}", order_id),
                released_margin: 0.0,
            },
        }
    }

    /// 平仓内部实现
    fn close_position_internal(
        &mut self,
        symbol: &str,
        exit_price: f64,
        close_size: Option<f64>,
        is_liquidation: bool,
    ) -> ClosePositionResult {
        TradingExecutor::close_position(
            symbol,
            exit_price,
            close_size,
            is_liquidation,
            &mut self.position_manager,
            &mut self.account,
            &mut self.pending_events,
            &mut self.risk_assessment,
        )
    }

    /// 获取时间戳
    fn get_timestamp(&self) -> u64 {
        #[cfg(target_arch = "wasm32")]
        {
            js_sys::Date::now() as u64
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0)
        }
    }
}

// ============================================================================
// Default trait 实现
// ============================================================================

impl Default for MarketEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// 测试辅助方法 (仅测试模式可用)
// ============================================================================

#[cfg(test)]
impl MarketEngine {
    /// 测试辅助：直接设置价格历史
    pub fn with_prices(prices: Vec<f64>) -> Self {
        let current_price = prices.last().copied().unwrap_or(0.0);
        MarketEngine {
            price_history: prices,
            volume_history: Vec::new(),
            max_history_size: MAX_HISTORY_SIZE,
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

    /// 测试辅助：设置成交量历史
    pub fn with_volumes(mut self, volumes: Vec<f64>) -> Self {
        self.volume_history = volumes;
        self
    }

    /// 测试辅助：设置初始余额
    pub fn with_balance(mut self, balance: f64) -> Self {
        self.account.set_balance(balance);
        self
    }

    /// 测试辅助：设置当前价格
    pub fn with_current_price(mut self, price: f64) -> Self {
        self.current_price = price;
        self
    }

    /// 测试辅助：获取价格历史引用
    pub fn prices(&self) -> &[f64] {
        &self.price_history
    }

    /// 测试辅助：获取成交量历史引用
    pub fn volumes(&self) -> &[f64] {
        &self.volume_history
    }

    /// 测试辅助：获取仓位引用 (BTCUSDT_Long 或 BTCUSDT_Short)
    pub fn get_test_position(&self) -> Option<&Position> {
        // Hedge Mode: 先尝试多头，再尝试空头
        self.position_manager.get("BTCUSDT_Long")
            .or_else(|| self.position_manager.get("BTCUSDT_Short"))
    }
    
    /// 测试辅助：获取 PositionManager 引用
    pub fn get_position_manager(&self) -> &PositionManager {
        &self.position_manager
    }

    /// 测试辅助：获取待处理事件
    pub fn get_pending_events(&self) -> &[EngineEvent] {
        &self.pending_events
    }
}
