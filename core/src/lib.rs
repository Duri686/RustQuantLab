use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// 初始化 panic hook，将 Rust panic 信息输出到浏览器控制台
/// 便于调试 WebAssembly 错误
pub fn set_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// 初始化 Wasm 模块
/// 在 JavaScript 侧调用其他函数前需先调用此函数
#[wasm_bindgen(start)]
pub fn init() {
    set_panic_hook();
}

// ============================================================================
// 数据结构定义
// ============================================================================

/// 订单簿数据结构（内部使用）
/// 用于从 JS 接收市场数据
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OrderBook {
    /// 交易对符号
    #[allow(dead_code)]
    symbol: String,
    /// 时间戳
    #[allow(dead_code)]
    timestamp: u64,
    /// 当前价格
    price: f64,
    /// 买单列表 [价格, 数量]
    bids: Vec<(f64, f64)>,
    /// 卖单列表 [价格, 数量]
    asks: Vec<(f64, f64)>,
}

/// 分析结果结构（返回给 JS）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResult {
    /// 买卖价差 (Ask[0] - Bid[0])
    pub spread: f64,
    /// 5 周期简单移动平均线
    pub sma_5: Option<f64>,
    /// 当前历史价格数量
    pub history_length: usize,
}

// ============================================================================
// MarketEngine - 有状态的市场分析引擎
// ============================================================================

/// 市场分析引擎
/// 
/// 接收来自 JS Worker 的价格更新，存储历史数据并计算技术指标
/// 
/// # Example (JS)
/// ```js
/// const engine = MarketEngine.new();
/// const result = engine.on_tick(orderBookData);
/// console.log(result.spread, result.sma_5);
/// ```
#[wasm_bindgen]
pub struct MarketEngine {
    /// 历史价格列表，用于计算 SMA
    price_history: Vec<f64>,
    /// 最大历史记录数（防止内存泄漏）
    max_history_size: usize,
}

#[wasm_bindgen]
impl MarketEngine {
    /// 创建新的 MarketEngine 实例
    #[wasm_bindgen(constructor)]
    pub fn new() -> MarketEngine {
        MarketEngine {
            price_history: Vec::with_capacity(1000),
            max_history_size: 1000,
        }
    }

    /// 处理单次价格更新
    /// 
    /// # Arguments
    /// * `val` - JS 传入的 OrderBook 对象
    /// 
    /// # Returns
    /// 返回包含 spread 和 sma_5 的 AnalysisResult
    pub fn on_tick(&mut self, val: JsValue) -> Result<JsValue, JsValue> {
        // 反序列化 JS 对象为 Rust 结构体
        let order_book: OrderBook = serde_wasm_bindgen::from_value(val)
            .map_err(|e| JsValue::from_str(&format!("解析 OrderBook 失败: {}", e)))?;

        // 将当前价格加入历史记录
        self.price_history.push(order_book.price);

        // 限制历史记录大小，防止内存泄漏
        if self.price_history.len() > self.max_history_size {
            // 移除最早的数据
            self.price_history.remove(0);
        }

        // 计算买卖价差
        let spread = self.calculate_spread(&order_book);

        // 计算 SMA(5)
        let sma_5 = self.calculate_sma(5);

        // 构建分析结果
        let result = AnalysisResult {
            spread,
            sma_5,
            history_length: self.price_history.len(),
        };

        // 序列化结果返回给 JS
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&format!("序列化结果失败: {}", e)))
    }

    /// 获取当前历史价格数量
    pub fn history_length(&self) -> usize {
        self.price_history.len()
    }

    /// 清空历史数据
    pub fn clear_history(&mut self) {
        self.price_history.clear();
    }
}

impl MarketEngine {
    /// 计算买卖价差
    /// Spread = Ask[0].price - Bid[0].price
    fn calculate_spread(&self, order_book: &OrderBook) -> f64 {
        let best_ask = order_book.asks.first().map(|(price, _)| *price).unwrap_or(0.0);
        let best_bid = order_book.bids.first().map(|(price, _)| *price).unwrap_or(0.0);
        best_ask - best_bid
    }

    /// 计算简单移动平均线 (SMA)
    /// 
    /// # Arguments
    /// * `period` - 周期数
    /// 
    /// # Returns
    /// 如果历史数据不足，返回 None
    fn calculate_sma(&self, period: usize) -> Option<f64> {
        if self.price_history.len() < period {
            return None;
        }

        let start_index = self.price_history.len() - period;
        let sum: f64 = self.price_history[start_index..].iter().sum();
        Some(sum / period as f64)
    }
}

impl Default for MarketEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// 保留原有的测试函数
// ============================================================================

/// 问候函数 - 用于测试 Rust 与 JavaScript 的通信
#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! This is Rust speaking from WebAssembly. 🦀", name)
}

/// 简单的加法运算 - 演示数值计算
#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_greet() {
        let result = greet("World");
        assert!(result.contains("World"));
    }

    #[test]
    fn test_add() {
        assert_eq!(add(2, 3), 5);
    }

    #[test]
    fn test_sma_calculation() {
        let mut engine = MarketEngine::new();
        
        // 模拟价格历史
        engine.price_history = vec![10.0, 20.0, 30.0, 40.0, 50.0];
        
        // SMA(5) = (10 + 20 + 30 + 40 + 50) / 5 = 30
        assert_eq!(engine.calculate_sma(5), Some(30.0));
        
        // 数据不足时返回 None
        engine.price_history = vec![10.0, 20.0];
        assert_eq!(engine.calculate_sma(5), None);
    }
}
