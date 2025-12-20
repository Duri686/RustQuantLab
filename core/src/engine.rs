//! # MarketEngine - 有状态的市场分析引擎
//!
//! 负责状态管理和业务编排，调用 `indicators` 模块执行计算。
//!
//! ## 职责
//! - 维护价格和成交量历史
//! - 处理每次 Tick 数据更新
//! - 调用指标计算函数并组装结果
//! - **K 线聚合**: 支持多时间周期 K 线生成

use std::collections::HashMap;
use wasm_bindgen::prelude::*;

use crate::indicators;
use crate::models::{
    AnalysisResult, Candle, CandleHistory, IndicatorHistory, OrderBook, 
    SimOrder, SimOrderResult, SimOrderSide, Timeframe,
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

// ============================================================================
// MarketEngine 结构体
// ============================================================================

/// 市场分析引擎
///
/// 有状态的引擎，维护价格和成交量历史，
/// 每次 tick 更新时计算所有技术指标。
///
/// # 使用示例 (JavaScript)
/// ```javascript
/// const engine = new MarketEngine();
/// const result = engine.on_tick(orderBookData);
/// console.log(result.ma7, result.rsi14);
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
    #[wasm_bindgen(constructor)]
    pub fn new() -> MarketEngine {
        MarketEngine {
            price_history: Vec::with_capacity(INITIAL_CAPACITY),
            volume_history: Vec::with_capacity(INITIAL_CAPACITY),
            max_history_size: MAX_HISTORY_SIZE,
            active_timeframe: Timeframe::S1,
            candle_cache: HashMap::new(),
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
        MarketEngine {
            price_history: prices,
            volume_history: Vec::new(),
            max_history_size: MAX_HISTORY_SIZE,
            active_timeframe: Timeframe::S1,
            candle_cache: HashMap::new(),
        }
    }

    /// 测试辅助：直接设置成交量历史
    pub fn with_volumes(mut self, volumes: Vec<f64>) -> Self {
        self.volume_history = volumes;
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
}
