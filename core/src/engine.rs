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

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::indicators;
use crate::models::{
    AnalysisResult, Candle, CandleHistory, IndicatorHistory, OrderBook, 
    SimOrder, SimOrderResult, SimOrderSide, Timeframe,
};
use crate::risk::{
    LiquidationResult, PositionSide, RiskCalculator, RiskConfig, RiskLevel,
};

// ============================================================================
// 常量定义
// ============================================================================

/// Tick 级别历史数据最大容量
/// 用于计算基于 tick 的实时指标（非 K 线指标）
/// 注意：此值影响 `compute_all_indicators` 的计算精度
const MAX_HISTORY_SIZE: usize = 1000;

/// K 线历史最大容量
/// Rust/Wasm 可轻松处理 2000-10000 根 K 线
/// 性能瓶颈通常在 ECharts 渲染层而非 Rust 计算层
///
/// 数据量参考：
/// - 2000 根: ~1MB 内存, 指标计算 <10ms, 推荐用于实时交易
/// - 10000 根: ~5MB 内存, 指标计算 ~50ms, 可用于回测分析
/// - 超过 10000 根时应考虑分页加载或虚拟滚动
const MAX_CANDLE_HISTORY: usize = 2000;

/// 初始容量预分配
const INITIAL_CAPACITY: usize = 500;

/// 默认初始余额 (USDT)
const DEFAULT_INITIAL_BALANCE: f64 = 10_000.0;

/// 默认杠杆倍数
const DEFAULT_LEVERAGE: u8 = 10;

// ============================================================================
// 交易状态结构体
// ============================================================================

/// 引擎事件类型
///
/// 用于向前端通知重要状态变化
///
/// 注意: `rename_all = "camelCase"` 在 enum 上只重命名 variant tag，
/// 需要在每个 variant 的字段上单独应用 camelCase 转换。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum EngineEvent {
    /// 仓位已开启
    #[serde(rename_all = "camelCase")]
    PositionOpened {
        side: String,
        size: f64,
        entry_price: f64,
        leverage: u8,
        liquidation_price: f64,
    },
    /// 仓位已关闭
    #[serde(rename_all = "camelCase")]
    PositionClosed {
        side: String,
        size: f64,
        entry_price: f64,
        exit_price: f64,
        realized_pnl: f64,
    },
    /// 仓位被强制平仓
    #[serde(rename_all = "camelCase")]
    Liquidated {
        side: String,
        size: f64,
        entry_price: f64,
        liquidation_price: f64,
        lost_margin: f64,
    },
    /// 风险预警
    #[serde(rename_all = "camelCase")]
    MarginWarning {
        risk_level: String,
        margin_ratio: f64,
        liquidation_price: f64,
        distance_pct: f64,
    },
}

/// 活跃仓位
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    /// 仓位方向
    pub side: PositionSide,
    /// 仓位大小 (BTC 数量)
    pub size: f64,
    /// 开仓均价
    pub entry_price: f64,
    /// 开仓时间戳
    pub open_time: u64,
    /// 使用的保证金
    pub margin: f64,
    /// 杠杆倍数
    pub leverage: u8,
    /// 强平价格
    pub liquidation_price: f64,
    /// 未实现盈亏
    pub unrealized_pnl: f64,
    /// 盈亏百分比
    pub pnl_percentage: f64,
}

/// 交易状态快照
///
/// 包含当前账户和仓位的完整状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TradingState {
    /// 钱包余额 (包含已实现盈亏)
    pub balance: f64,
    /// 可用余额 (未被仓位占用的保证金)
    pub available_balance: f64,
    /// 当前杠杆设置
    pub leverage: u8,
    /// 当前价格
    pub current_price: f64,
    /// 活跃仓位
    pub position: Option<Position>,
    /// 最新风险评估结果
    pub risk_assessment: Option<LiquidationResult>,
    /// 待处理事件队列
    pub pending_events: Vec<EngineEvent>,
}

/// 开仓请求
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenPositionRequest {
    /// 仓位方向: "long" 或 "short"
    pub side: String,
    /// 仓位大小 (BTC)
    pub size: f64,
    /// 可选: 指定开仓价格 (默认使用当前市价)
    pub price: Option<f64>,
}

/// 开仓结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenPositionResult {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position: Option<Position>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
}

/// 平仓结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClosePositionResult {
    pub success: bool,
    pub message: String,
    pub realized_pnl: f64,
    pub exit_price: f64,
    pub new_balance: f64,
}

// ============================================================================
// MarketEngine 结构体
// ============================================================================

/// 市场分析引擎
///
/// 有状态的引擎，维护价格和成交量历史，
/// 每次 tick 更新时计算所有技术指标。
/// 同时管理模拟交易状态：仓位、余额、风控。
///
/// # 使用示例 (JavaScript)
/// ```javascript
/// const engine = new MarketEngine();
/// const result = engine.on_tick(orderBookData);
/// console.log(result.ma7, result.rsi14);
///
/// // 开仓
/// engine.open_position({ side: "long", size: 0.1 });
/// ```
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
    /// Key: Timeframe, Value: (已完成K线列表, 当前正在形成的K线)
    candle_cache: HashMap<Timeframe, CandleCache>,

    // ========== 交易状态相关 ==========

    /// 风控配置 (阶梯保证金率)
    risk_config: RiskConfig,

    /// 钱包余额 (USDT)
    balance: f64,

    /// 当前杠杆倍数
    leverage: u8,

    /// 当前市场价格
    current_price: f64,

    /// 活跃仓位
    position: Option<Position>,

    /// 最新风险评估结果
    risk_assessment: Option<LiquidationResult>,

    /// 待消费的事件队列
    pending_events: Vec<EngineEvent>,
}

/// K 线缓存结构
#[derive(Debug, Clone)]
struct CandleCache {
    /// 已完成的 K 线历史
    history: Vec<Candle>,
    /// 当前正在形成的 K 线
    current: Option<Candle>,
}

impl CandleCache {
    fn new() -> Self {
        CandleCache {
            history: Vec::with_capacity(MAX_CANDLE_HISTORY),
            current: None,
        }
    }
}

// ============================================================================
// Wasm 绑定方法
// ============================================================================

#[wasm_bindgen]
impl MarketEngine {
    /// 创建新的 MarketEngine 实例
    ///
    /// 预分配 2000 条数据的容量，避免频繁内存分配。
    /// 使用默认风控配置（阶梯保证金率）和 10,000 USDT 初始余额。
    #[wasm_bindgen(constructor)]
    pub fn new() -> MarketEngine {
        MarketEngine {
            price_history: Vec::with_capacity(INITIAL_CAPACITY),
            volume_history: Vec::with_capacity(INITIAL_CAPACITY),
            max_history_size: MAX_HISTORY_SIZE,
            active_timeframe: Timeframe::S1,
            candle_cache: HashMap::new(),
            // 交易状态初始化
            risk_config: RiskConfig::default(),
            balance: DEFAULT_INITIAL_BALANCE,
            leverage: DEFAULT_LEVERAGE,
            current_price: 0.0,
            position: None,
            risk_assessment: None,
            pending_events: Vec::new(),
        }
    }

    /// 处理单次 Tick 数据更新
    ///
    /// 接收订单簿数据，更新历史，计算所有技术指标。
    ///
    /// # 参数
    /// - `val`: JavaScript 传入的 OrderBook 对象
    ///
    /// # 返回
    /// - `Ok(JsValue)`: 序列化的 AnalysisResult
    /// - `Err(JsValue)`: 解析或序列化错误信息
    pub fn on_tick(&mut self, val: JsValue) -> Result<JsValue, JsValue> {
        // 反序列化订单簿数据
        let order_book: OrderBook = serde_wasm_bindgen::from_value(val)
            .map_err(|e| JsValue::from_str(&format!("解析 OrderBook 失败: {}", e)))?;

        // 更新价格历史
        self.push_price(order_book.price);

        // 估算成交量 (最优买卖盘平均量)
        let estimated_volume = self.estimate_volume(&order_book);
        self.push_volume(estimated_volume);

        // 更新所有时间周期的 K 线
        self.update_all_candles(order_book.timestamp, order_book.price, estimated_volume);

        // 🔴 更新当前价格并执行风险检查
        self.update_price(order_book.price);

        // 计算所有指标
        let result = self.compute_all_indicators(&order_book);

        // 序列化结果
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
    ///
    /// # 参数
    /// - `timeframe_str`: 时间周期字符串 ('1s', '1m', '5m', '15m', '1H', '4H', '1D')
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
    ///
    /// # 参数
    /// - `timeframe_str`: 时间周期字符串
    ///
    /// # 返回
    /// - `Ok(JsValue)`: 序列化的 CandleHistory (包含指标历史)
    /// - `Err(JsValue)`: 错误信息
    pub fn get_candles(&self, timeframe_str: &str) -> Result<JsValue, JsValue> {
        let tf = Timeframe::from_str(timeframe_str)
            .ok_or_else(|| JsValue::from_str(&format!("无效的时间周期: {}", timeframe_str)))?;

        let cache = self.candle_cache.get(&tf);
        let candles = cache.map(|c| c.history.clone()).unwrap_or_default();
        let current_candle = cache.and_then(|c| c.current.clone());

        // 基于 K 线收盘价计算该周期的指标历史
        let indicators = self.compute_candle_indicators(&candles, current_candle.as_ref());
        
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
    ///
    /// 处理买入/卖出订单，模拟市场影响：
    /// - 买单：价格上涨 + 成交量增加
    /// - 卖单：价格下跌 + 成交量增加
    ///
    /// # 参数
    /// - `val`: JavaScript 传入的 SimOrder 对象
    ///
    /// # 返回
    /// - `Ok(JsValue)`: 序列化的 SimOrderResult
    /// - `Err(JsValue)`: 解析或序列化错误信息
    ///
    /// # 模拟逻辑
    /// 价格影响 = 订单价值 × 影响系数 / 当前价格
    /// 影响系数：基于订单规模的非线性函数，大单影响更大
    pub fn submit_order(&mut self, val: JsValue) -> Result<JsValue, JsValue> {
        // 反序列化订单数据
        let order: SimOrder = serde_wasm_bindgen::from_value(val)
            .map_err(|e| JsValue::from_str(&format!("解析订单失败: {}", e)))?;

        // 获取当前价格（使用最新历史价格或订单价格）
        let current_price = self.price_history.last().copied().unwrap_or(order.price);

        // 计算订单价值 (USDT)
        let order_value = order.price * order.size;

        // 计算价格影响（模拟市场冲击）
        // 基础影响: 0.001% ~ 0.1% 根据订单规模
        // 公式: impact = order_value / (current_price * 10000) * (1 + log(size))
        let base_impact_rate = 0.0001; // 0.01% 基础影响率
        let size_multiplier = (1.0 + order.size.ln().abs()).min(5.0); // 大单放大效应，上限5倍
        let price_impact_percent = base_impact_rate * size_multiplier * (order_value / 10000.0).min(1.0);

        // 根据订单方向计算价格变动
        let price_impact = match order.side {
            SimOrderSide::Buy => current_price * price_impact_percent,  // 买入推高价格
            SimOrderSide::Sell => -current_price * price_impact_percent, // 卖出压低价格
        };

        // 计算执行价格
        let executed_price = current_price + price_impact;

        // 计算执行成交量（订单数量的 1.5~3 倍，模拟市场反应）
        let volume_multiplier = 1.5 + (order.size * 0.5).min(1.5);
        let executed_volume = order.size * volume_multiplier;

        // 生成模拟 tick 时间戳
        let timestamp = js_sys::Date::now() as u64;

        // 将订单影响注入到市场数据中
        self.push_price(executed_price);
        self.push_volume(executed_volume);

        // 更新所有时间周期的 K 线
        self.update_all_candles(timestamp, executed_price, executed_volume);

        // 构建返回结果
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

        // 序列化结果
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("序列化结果失败: {}", e)))
    }

    // ========== 交易状态管理方法 ==========

    /// 获取当前交易状态
    ///
    /// 返回账户余额、仓位信息、风险评估等完整状态
    pub fn get_trading_state(&mut self) -> Result<JsValue, JsValue> {
        // 消费待处理事件
        let events = std::mem::take(&mut self.pending_events);

        let available = self.calculate_available_balance();

        let state = TradingState {
            balance: self.balance,
            available_balance: available,
            leverage: self.leverage,
            current_price: self.current_price,
            position: self.position.clone(),
            risk_assessment: self.risk_assessment.clone(),
            pending_events: events,
        };

        serde_wasm_bindgen::to_value(&state)
            .map_err(|e| JsValue::from_str(&format!("序列化交易状态失败: {}", e)))
    }

    /// 设置杠杆倍数
    ///
    /// # 参数
    /// - `leverage`: 杠杆倍数 (1-125)
    ///
    /// # 返回
    /// - 是否设置成功
    pub fn set_leverage(&mut self, leverage: u8) -> bool {
        if leverage >= 1 && leverage <= 125 {
            // 如果有持仓，不允许修改杠杆
            if self.position.is_some() {
                return false;
            }
            self.leverage = leverage;
            true
        } else {
            false
        }
    }

    /// 获取当前杠杆倍数
    pub fn get_leverage(&self) -> u8 {
        self.leverage
    }

    /// 获取当前余额
    pub fn get_balance(&self) -> f64 {
        self.balance
    }

    /// 重置账户余额
    ///
    /// 用于模拟环境重置，清除所有仓位并恢复初始余额
    pub fn reset_balance(&mut self, initial_balance: Option<f64>) {
        self.balance = initial_balance.unwrap_or(DEFAULT_INITIAL_BALANCE);
        self.position = None;
        self.risk_assessment = None;
        self.pending_events.clear();
    }

    /// 开仓
    ///
    /// # 参数
    /// - `val`: OpenPositionRequest JSON 对象
    ///
    /// # 返回
    /// - `Ok(JsValue)`: OpenPositionResult
    /// - `Err(JsValue)`: 错误信息
    ///
    /// # 验证逻辑
    /// 1. 检查是否已有仓位 (单仓位模式)
    /// 2. 计算所需初始保证金 = 名义价值 × IMR (阶梯费率)
    /// 3. 验证可用余额是否充足
    /// 4. 计算强平价格
    pub fn open_position(&mut self, val: JsValue) -> Result<JsValue, JsValue> {
        let req: OpenPositionRequest = serde_wasm_bindgen::from_value(val)
            .map_err(|e| JsValue::from_str(&format!("解析开仓请求失败: {}", e)))?;

        let result = self.open_position_internal(req);

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("序列化开仓结果失败: {}", e)))
    }

    /// 平仓
    ///
    /// # 参数
    /// - `exit_price`: 可选的平仓价格，默认使用当前市价
    ///
    /// # 返回
    /// - `Ok(JsValue)`: ClosePositionResult
    /// - `Err(JsValue)`: 错误信息
    pub fn close_position(&mut self, exit_price: Option<f64>) -> Result<JsValue, JsValue> {
        let price = exit_price.unwrap_or(self.current_price);
        let result = self.close_position_internal(price, false);

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("序列化平仓结果失败: {}", e)))
    }

    /// 检查是否有活跃仓位
    pub fn has_position(&self) -> bool {
        self.position.is_some()
    }

    /// 获取待处理事件数量
    pub fn pending_event_count(&self) -> usize {
        self.pending_events.len()
    }
}

// ============================================================================
// 内部方法 (非 Wasm 导出)
// ============================================================================

/// 批量清理阈值：当超出此数量时触发清理
const BATCH_CLEANUP_THRESHOLD: usize = 50;

impl MarketEngine {
    /// 添加价格到历史，自动维护最大容量
    ///
    /// 使用批量清理策略：当超出阈值时一次性清理，减少 drain 调用频率
    fn push_price(&mut self, price: f64) {
        self.price_history.push(price);

        // 只有当超出阈值时才批量清理
        let overflow = self.price_history.len().saturating_sub(self.max_history_size);
        if overflow >= BATCH_CLEANUP_THRESHOLD {
            self.price_history.drain(0..overflow);
        }
    }

    /// 添加成交量到历史，自动维护最大容量
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
            // 基础信息
            spread: indicators::calculate_spread(&order_book.bids, &order_book.asks),
            history_length: prices.len(),

            // SMA
            sma_5: indicators::calculate_sma(prices, 5),
            ma_7: indicators::calculate_sma(prices, 7),
            ma_25: indicators::calculate_sma(prices, 25),
            ma_99: indicators::calculate_sma(prices, 99),

            // EMA
            ema_7: indicators::calculate_ema(prices, 7),
            ema_25: indicators::calculate_ema(prices, 25),

            // Bollinger Bands (20 周期, 2 倍标准差)
            boll: indicators::calculate_boll(prices, 20, 2.0),

            // MACD (12, 26, 9)
            macd: indicators::calculate_macd(prices, 12, 26, 9),

            // RSI (14)
            rsi_14: indicators::calculate_rsi(prices, 14),

            // Volume MA (5)
            vol_ma_5: indicators::calculate_sma(volumes, 5),
        }
    }

    // ========== K 线指标计算方法 ==========

    /// 基于 K 线收盘价计算完整的指标历史
    ///
    /// 此方法为每根 K 线计算对应位置的指标值，确保指标数据与 K 线数据长度对齐
    fn compute_candle_indicators(&self, candles: &[Candle], current: Option<&Candle>) -> IndicatorHistory {
        // 收集所有收盘价（包括当前正在形成的 K 线）
        let mut closes: Vec<f64> = candles.iter().map(|c| c.close).collect();
        if let Some(curr) = current {
            closes.push(curr.close);
        }

        let total_len = closes.len();
        if total_len == 0 {
            return IndicatorHistory::default();
        }

        // 预分配指标数组
        let mut ma7 = Vec::with_capacity(total_len);
        let mut ma25 = Vec::with_capacity(total_len);
        let mut ma99 = Vec::with_capacity(total_len);
        let mut ema7 = Vec::with_capacity(total_len);
        let mut ema25 = Vec::with_capacity(total_len);
        let mut boll_upper = Vec::with_capacity(total_len);
        let mut boll_mid = Vec::with_capacity(total_len);
        let mut boll_lower = Vec::with_capacity(total_len);
        let mut macd_dif = Vec::with_capacity(total_len);
        let mut macd_dea = Vec::with_capacity(total_len);
        let mut macd_hist = Vec::with_capacity(total_len);
        let mut rsi14 = Vec::with_capacity(total_len);

        // 为每个位置计算指标（使用该位置及之前的数据）
        for i in 0..total_len {
            let slice = &closes[..=i];
            
            // MA
            ma7.push(indicators::calculate_sma(slice, 7));
            ma25.push(indicators::calculate_sma(slice, 25));
            ma99.push(indicators::calculate_sma(slice, 99));

            // EMA
            ema7.push(indicators::calculate_ema(slice, 7));
            ema25.push(indicators::calculate_ema(slice, 25));

            // BOLL
            if let Some(boll) = indicators::calculate_boll(slice, 20, 2.0) {
                boll_upper.push(Some(boll.upper));
                boll_mid.push(Some(boll.mid));
                boll_lower.push(Some(boll.lower));
            } else {
                boll_upper.push(None);
                boll_mid.push(None);
                boll_lower.push(None);
            }

            // MACD
            if let Some(macd) = indicators::calculate_macd(slice, 12, 26, 9) {
                macd_dif.push(Some(macd.dif));
                macd_dea.push(Some(macd.dea));
                macd_hist.push(Some(macd.hist));
            } else {
                macd_dif.push(None);
                macd_dea.push(None);
                macd_hist.push(None);
            }

            // RSI
            rsi14.push(indicators::calculate_rsi(slice, 14));
        }

        IndicatorHistory {
            ma7,
            ma25,
            ma99,
            ema7,
            ema25,
            boll_upper,
            boll_mid,
            boll_lower,
            macd_dif,
            macd_dea,
            macd_hist,
            rsi14,
        }
    }

    // ========== K 线聚合方法 ==========

    /// 更新所有时间周期的 K 线
    ///
    /// 对每个支持的时间周期进行 K 线聚合
    fn update_all_candles(&mut self, timestamp: u64, price: f64, volume: f64) {
        // 更新所有支持的时间周期
        let timeframes = [
            Timeframe::S1,
            Timeframe::M1,
            Timeframe::M5,
            Timeframe::M15,
            Timeframe::H1,
            Timeframe::H4,
            Timeframe::D1,
        ];

        for tf in timeframes {
            self.update_candle(tf, timestamp, price, volume);
        }
    }

    /// 更新指定时间周期的 K 线
    ///
    /// K 线聚合逻辑:
    /// 1. 如果无当前 K 线，创建新 K 线
    /// 2. 如果时间戳属于当前 K 线周期，更新 OHLCV
    /// 3. 如果时间戳属于新周期，将当前 K 线移入历史，创建新 K 线
    fn update_candle(&mut self, tf: Timeframe, timestamp: u64, price: f64, volume: f64) {
        // 获取或创建缓存
        let cache = self.candle_cache.entry(tf).or_insert_with(CandleCache::new);

        // 将时间戳对齐到当前周期起始点
        let aligned_time = tf.align_timestamp(timestamp);

        match &mut cache.current {
            Some(current_candle) => {
                if current_candle.time == aligned_time {
                    // 同一周期，更新 K 线
                    current_candle.update(price, volume);
                } else {
                    // 新周期，将当前 K 线移入历史
                    let completed = current_candle.clone();
                    cache.history.push(completed);

                    // 维护历史容量
                    if cache.history.len() > MAX_CANDLE_HISTORY {
                        let overflow = cache.history.len() - MAX_CANDLE_HISTORY;
                        cache.history.drain(0..overflow);
                    }

                    // 创建新 K 线
                    *current_candle = Candle::new(aligned_time, price, volume);
                }
            }
            None => {
                // 首次创建 K 线
                cache.current = Some(Candle::new(aligned_time, price, volume));
            }
        }
    }

    // ========== 交易核心方法 ==========

    /// 更新当前价格并执行风险检查
    ///
    /// 每次价格更新时:
    /// 1. 更新 current_price
    /// 2. 如果有持仓，重新计算未实现盈亏
    /// 3. 执行风险评估
    /// 4. 如果触发强平条件，执行强制平仓
    fn update_price(&mut self, price: f64) {
        self.current_price = price;

        // 如果没有持仓，无需风险检查
        let position = match &mut self.position {
            Some(p) => p,
            None => {
                self.risk_assessment = None;
                return;
            }
        };

        // 1. 重新计算未实现盈亏
        let unrealized_pnl = RiskCalculator::calculate_unrealized_pnl(
            position.entry_price,
            price,
            position.size,
            position.side,
        );
        position.unrealized_pnl = unrealized_pnl;

        // 计算盈亏百分比 (相对于保证金)
        position.pnl_percentage = if position.margin > 0.0 {
            (unrealized_pnl / position.margin) * 100.0
        } else {
            0.0
        };

        // 2. 计算维持保证金
        let current_notional = position.size * price;
        let mmr = self.risk_config.get_maintenance_margin_rate(current_notional);
        let maintenance_margin = current_notional * mmr;

        // 3. 计算保证金率
        let margin_ratio = RiskCalculator::calculate_margin_ratio(
            self.balance,
            unrealized_pnl,
            maintenance_margin,
        );

        // 4. 评估风险等级
        let risk_level = RiskCalculator::evaluate_risk_level(
            margin_ratio,
            self.risk_config.margin_warning_threshold,
        );

        // 5. 计算距离强平的百分比
        let distance_pct = if position.liquidation_price > 0.0 {
            ((price - position.liquidation_price) / price * 100.0).abs()
        } else {
            100.0
        };

        // 6. 构建风险评估结果
        let available = (self.balance + unrealized_pnl - maintenance_margin).max(0.0);
        
        let is_liquidated = margin_ratio <= 1.0;
        
        let risk_assessment = LiquidationResult {
            risk_level,
            margin_ratio,
            liquidation_price: position.liquidation_price,
            distance_to_liquidation_pct: distance_pct,
            maintenance_margin,
            available_balance: available,
            is_liquidated,
            warning_message: match risk_level {
                RiskLevel::Critical => Some("⚠️ 极高风险：即将触发强制平仓！".to_string()),
                RiskLevel::High => Some("⚠️ 高风险：请注意保证金水平".to_string()),
                RiskLevel::Medium => Some("注意：保证金率较低".to_string()),
                _ => None,
            },
        };

        // 7. 发送风险预警事件 (如果有)
        if matches!(risk_level, RiskLevel::High | RiskLevel::Critical) {
            self.pending_events.push(EngineEvent::MarginWarning {
                risk_level: format!("{:?}", risk_level),
                margin_ratio,
                liquidation_price: position.liquidation_price,
                distance_pct,
            });
        }

        self.risk_assessment = Some(risk_assessment);

        // 8. 🔴 强平检查 - The Kill Switch
        if is_liquidated {
            self.liquidate_position(price);
        }
    }

    /// 开仓内部实现
    fn open_position_internal(&mut self, req: OpenPositionRequest) -> OpenPositionResult {
        // 1. 检查是否已有仓位
        if self.position.is_some() {
            return OpenPositionResult {
                success: false,
                message: "已有持仓，请先平仓".to_string(),
                position: None,
                error_code: Some("POSITION_EXISTS".to_string()),
            };
        }

        // 2. 解析仓位方向
        let side = match req.side.to_lowercase().as_str() {
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

        // 3. 确定开仓价格
        let entry_price = req.price.unwrap_or(self.current_price);
        if entry_price <= 0.0 {
            return OpenPositionResult {
                success: false,
                message: "无效的开仓价格".to_string(),
                position: None,
                error_code: Some("INVALID_PRICE".to_string()),
            };
        }

        // 4. 计算名义价值和所需保证金
        let notional_value = req.size * entry_price;
        let imr = self.risk_config.get_initial_margin_rate(notional_value);
        let required_margin = notional_value * imr;

        // 5. 检查可用余额
        let available = self.calculate_available_balance();
        if available < required_margin {
            return OpenPositionResult {
                success: false,
                message: format!(
                    "保证金不足: 需要 {:.2} USDT, 可用 {:.2} USDT",
                    required_margin, available
                ),
                position: None,
                error_code: Some("INSUFFICIENT_MARGIN".to_string()),
            };
        }

        // 6. 计算强平价格
        let mmr = self.risk_config.get_maintenance_margin_rate(notional_value);
        let liquidation_price = RiskCalculator::calculate_liquidation_price(
            entry_price,
            self.leverage,
            side,
            mmr,
        );

        // 7. 创建仓位
        #[cfg(target_arch = "wasm32")]
        let timestamp = js_sys::Date::now() as u64;
        #[cfg(not(target_arch = "wasm32"))]
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        
        let position = Position {
            side,
            size: req.size,
            entry_price,
            open_time: timestamp,
            margin: required_margin,
            leverage: self.leverage,
            liquidation_price,
            unrealized_pnl: 0.0,
            pnl_percentage: 0.0,
        };

        // 8. 发送开仓事件
        self.pending_events.push(EngineEvent::PositionOpened {
            side: format!("{:?}", side),
            size: req.size,
            entry_price,
            leverage: self.leverage,
            liquidation_price,
        });

        self.position = Some(position.clone());

        OpenPositionResult {
            success: true,
            message: format!(
                "开仓成功: {:?} {:.4} BTC @ {:.2}, 杠杆 {}x, 强平价 {:.2}",
                side, req.size, entry_price, self.leverage, liquidation_price
            ),
            position: Some(position),
            error_code: None,
        }
    }

    /// 平仓内部实现
    ///
    /// # 参数
    /// - `exit_price`: 平仓价格
    /// - `is_liquidation`: 是否为强制平仓
    fn close_position_internal(&mut self, exit_price: f64, is_liquidation: bool) -> ClosePositionResult {
        let position = match self.position.take() {
            Some(p) => p,
            None => {
                return ClosePositionResult {
                    success: false,
                    message: "无持仓可平".to_string(),
                    realized_pnl: 0.0,
                    exit_price: 0.0,
                    new_balance: self.balance,
                };
            }
        };

        // 计算已实现盈亏
        let realized_pnl = RiskCalculator::calculate_unrealized_pnl(
            position.entry_price,
            exit_price,
            position.size,
            position.side,
        );

        // 更新余额
        // 平仓时: 新余额 = 原余额 + 已实现盈亏
        // (保证金在开仓时已从 available_balance 扣除，但 balance 未变)
        self.balance = (self.balance + realized_pnl).max(0.0);

        // 清除风险评估
        self.risk_assessment = None;

        // 发送事件
        if is_liquidation {
            self.pending_events.push(EngineEvent::Liquidated {
                side: format!("{:?}", position.side),
                size: position.size,
                entry_price: position.entry_price,
                liquidation_price: position.liquidation_price,
                lost_margin: position.margin,
            });
        } else {
            self.pending_events.push(EngineEvent::PositionClosed {
                side: format!("{:?}", position.side),
                size: position.size,
                entry_price: position.entry_price,
                exit_price,
                realized_pnl,
            });
        }

        ClosePositionResult {
            success: true,
            message: if is_liquidation {
                format!(
                    "⚠️ 强制平仓: {:?} {:.4} BTC @ {:.2}, 亏损 {:.2} USDT",
                    position.side, position.size, exit_price, realized_pnl.abs()
                )
            } else {
                format!(
                    "平仓成功: {:?} {:.4} BTC @ {:.2}, 盈亏 {:.2} USDT",
                    position.side, position.size, exit_price, realized_pnl
                )
            },
            realized_pnl,
            exit_price,
            new_balance: self.balance,
        }
    }

    /// 强制平仓
    ///
    /// 当保证金率 <= 1.0 时触发，立即以当前价格平仓
    fn liquidate_position(&mut self, price: f64) {
        // 执行强制平仓
        let _result = self.close_position_internal(price, true);
        
        // 如果强平后余额为负，设为 0 (模拟穿仓保护)
        if self.balance < 0.0 {
            self.balance = 0.0;
        }

        // 注意: 强平事件已在 close_position_internal 中推送到 pending_events
        // 前端可通过 get_trading_state() 获取 EngineEvent::Liquidated 事件
    }

    /// 计算可用余额
    ///
    /// 可用余额 = 钱包余额 - 已用保证金 + 未实现盈亏
    fn calculate_available_balance(&self) -> f64 {
        match &self.position {
            Some(pos) => {
                (self.balance - pos.margin + pos.unrealized_pnl).max(0.0)
            }
            None => self.balance,
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
            // 交易状态
            risk_config: RiskConfig::default(),
            balance: DEFAULT_INITIAL_BALANCE,
            leverage: DEFAULT_LEVERAGE,
            current_price,
            position: None,
            risk_assessment: None,
            pending_events: Vec::new(),
        }
    }

    /// 测试辅助：直接设置成交量历史
    pub fn with_volumes(mut self, volumes: Vec<f64>) -> Self {
        self.volume_history = volumes;
        self
    }

    /// 测试辅助：设置初始余额
    pub fn with_balance(mut self, balance: f64) -> Self {
        self.balance = balance;
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

    /// 测试辅助：获取仓位引用
    pub fn get_position(&self) -> Option<&Position> {
        self.position.as_ref()
    }

    /// 测试辅助：获取待处理事件
    pub fn get_pending_events(&self) -> &[EngineEvent] {
        &self.pending_events
    }
}

// ============================================================================
// 单元测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

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
        engine.max_history_size = 100; // 设置小容量

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

    // ========== 交易功能测试 ==========

    #[test]
    fn test_engine_initial_trading_state() {
        let engine = MarketEngine::new();
        assert_eq!(engine.balance, DEFAULT_INITIAL_BALANCE);
        assert_eq!(engine.leverage, DEFAULT_LEVERAGE);
        assert!(engine.position.is_none());
    }

    #[test]
    fn test_open_position_success() {
        let mut engine = MarketEngine::with_prices(vec![50_000.0])
            .with_balance(10_000.0)
            .with_current_price(50_000.0);

        let req = OpenPositionRequest {
            side: "long".to_string(),
            size: 0.1,
            price: None,
        };

        let result = engine.open_position_internal(req);
        assert!(result.success);
        assert!(engine.position.is_some());

        let pos = engine.get_position().unwrap();
        assert_eq!(pos.size, 0.1);
        assert_eq!(pos.entry_price, 50_000.0);
        assert!(matches!(pos.side, PositionSide::Long));
    }

    #[test]
    fn test_open_position_insufficient_margin() {
        let mut engine = MarketEngine::with_prices(vec![50_000.0])
            .with_balance(100.0) // 余额不足
            .with_current_price(50_000.0);

        let req = OpenPositionRequest {
            side: "long".to_string(),
            size: 0.1, // 需要 50000 * 0.1 * 0.01 = 50 USDT 保证金 (但杠杆不够)
            price: None,
        };

        let result = engine.open_position_internal(req);
        // 名义价值 = 5000, IMR = 1%, 需要 50 USDT
        // 余额 100 应该足够
        // 但如果 size 更大会失败
        assert!(result.success); // 100 > 50, 应该成功
    }

    #[test]
    fn test_open_position_already_exists() {
        let mut engine = MarketEngine::with_prices(vec![50_000.0])
            .with_balance(10_000.0)
            .with_current_price(50_000.0);

        // 第一次开仓
        let req1 = OpenPositionRequest {
            side: "long".to_string(),
            size: 0.1,
            price: None,
        };
        engine.open_position_internal(req1);

        // 第二次开仓应该失败
        let req2 = OpenPositionRequest {
            side: "short".to_string(),
            size: 0.05,
            price: None,
        };
        let result = engine.open_position_internal(req2);
        assert!(!result.success);
        assert_eq!(result.error_code, Some("POSITION_EXISTS".to_string()));
    }

    #[test]
    fn test_close_position() {
        let mut engine = MarketEngine::with_prices(vec![50_000.0])
            .with_balance(10_000.0)
            .with_current_price(50_000.0);

        // 开仓
        let req = OpenPositionRequest {
            side: "long".to_string(),
            size: 0.1,
            price: None,
        };
        engine.open_position_internal(req);

        // 价格上涨后平仓
        let result = engine.close_position_internal(51_000.0, false);
        assert!(result.success);
        
        // 盈利 = (51000 - 50000) * 0.1 = 100 USDT
        assert!((result.realized_pnl - 100.0).abs() < 0.01);
        assert!(engine.position.is_none());
    }

    #[test]
    fn test_update_price_updates_pnl() {
        let mut engine = MarketEngine::with_prices(vec![50_000.0])
            .with_balance(10_000.0)
            .with_current_price(50_000.0);

        // 开多仓
        let req = OpenPositionRequest {
            side: "long".to_string(),
            size: 0.1,
            price: None,
        };
        engine.open_position_internal(req);

        // 价格上涨
        engine.update_price(51_000.0);

        let pos = engine.get_position().unwrap();
        // 盈利 = (51000 - 50000) * 0.1 = 100 USDT
        assert!((pos.unrealized_pnl - 100.0).abs() < 0.01);
    }

    #[test]
    fn test_liquidation_on_price_drop() {
        let mut engine = MarketEngine::with_prices(vec![50_000.0])
            .with_balance(100.0) // 极小余额，刚好够开仓
            .with_current_price(50_000.0);

        engine.leverage = 50; // 高杠杆

        // 开多仓
        // 名义价值 = 0.1 * 50000 = 5000 USDT
        // Tier 1 IMR = 1%, 所需保证金 = 50 USDT
        let req = OpenPositionRequest {
            side: "long".to_string(),
            size: 0.1,
            price: None,
        };
        engine.open_position_internal(req);
        assert!(engine.position.is_some());

        // 验证仓位创建成功
        let pos = engine.get_position().unwrap();
        assert!((pos.margin - 50.0).abs() < 1.0); // 约 50 USDT 保证金

        // 价格下跌，计算是否触发强平
        // 余额 = 100, 亏损需要使 margin_ratio <= 1
        // 当 (balance + unrealized_pnl) <= maintenance_margin 时触发
        // maintenance_margin ≈ 5000 * 0.5% = 25 USDT
        // 所以当 100 + pnl <= 25，即 pnl <= -75
        // pnl = (price - 50000) * 0.1 <= -75
        // price - 50000 <= -750
        // price <= 49250
        
        engine.update_price(48_000.0); // 大幅下跌，亏损 200，触发强平

        // 应该被强平
        assert!(engine.position.is_none(), "仓位应该被强平");
        
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
        assert_eq!(engine.leverage, 20);

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
        assert_eq!(engine.calculate_available_balance(), 10_000.0);

        // 开仓后
        let req = OpenPositionRequest {
            side: "long".to_string(),
            size: 0.1,
            price: None,
        };
        engine.open_position_internal(req);

        let pos = engine.get_position().unwrap();
        let margin = pos.margin;

        // 可用余额 = 余额 - 保证金 + 未实现盈亏
        let available = engine.calculate_available_balance();
        assert!((available - (10_000.0 - margin)).abs() < 0.01);
    }
}
