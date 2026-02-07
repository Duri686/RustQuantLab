//! # 数据模型定义
//!
//! 包含所有共享的数据结构，用于 Wasm 与 JavaScript 之间的数据交换。
//! 纯数据定义，无业务逻辑。

use std::str::FromStr;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

// ============================================================================
// 时间周期枚举
// ============================================================================

/// 支持的 K 线时间周期
///
/// 与前端 ChartToolbar 的 TIMEFRAMES 对应:
/// ['1s', '1m', '5m', '15m', '1H', '4H', '1D']
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Timeframe {
    /// 1 秒
    S1 = 1,
    /// 1 分钟
    M1 = 60,
    /// 5 分钟
    M5 = 300,
    /// 15 分钟
    M15 = 900,
    /// 1 小时
    H1 = 3600,
    /// 4 小时
    H4 = 14400,
    /// 1 天
    D1 = 86400,
}

impl Timeframe {
    /// 获取时间周期对应的秒数
    #[must_use]
    pub fn as_seconds(&self) -> u64 {
        *self as u64
    }

    /// 获取时间周期对应的毫秒数
    #[must_use]
    pub fn as_millis(&self) -> u64 {
        self.as_seconds() * 1000
    }

    /// 转换为字符串表示
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Timeframe::S1 => "1s",
            Timeframe::M1 => "1m",
            Timeframe::M5 => "5m",
            Timeframe::M15 => "15m",
            Timeframe::H1 => "1H",
            Timeframe::H4 => "4H",
            Timeframe::D1 => "1D",
        }
    }

    /// 将时间戳对齐到当前周期的起始点
    #[must_use]
    pub fn align_timestamp(&self, timestamp_ms: u64) -> u64 {
        let interval_ms = self.as_millis();
        (timestamp_ms / interval_ms) * interval_ms
    }
}

/// FromStr 实现，支持 "1s", "1m" 等字符串解析
impl FromStr for Timeframe {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "1s" => Ok(Timeframe::S1),
            "1m" => Ok(Timeframe::M1),
            "5m" => Ok(Timeframe::M5),
            "15m" => Ok(Timeframe::M15),
            "1H" | "1h" => Ok(Timeframe::H1),
            "4H" | "4h" => Ok(Timeframe::H4),
            "1D" | "1d" => Ok(Timeframe::D1),
            _ => Err(format!("无效的时间周期: {}", s)),
        }
    }
}

impl Default for Timeframe {
    fn default() -> Self {
        Timeframe::S1
    }
}

// ============================================================================
// K 线数据结构
// ============================================================================

/// 单根 K 线数据 (OHLCV)
///
/// 聚合后的 K 线，包含开高低收和成交量
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Candle {
    /// K 线开始时间戳 (毫秒)
    pub time: u64,

    /// 开盘价
    pub open: f64,

    /// 最高价
    pub high: f64,

    /// 最低价
    pub low: f64,

    /// 收盘价
    pub close: f64,

    /// 成交量
    pub volume: f64,

    /// 该周期内 tick 数量
    pub tick_count: u32,
}

impl Candle {
    /// 创建新 K 线
    pub fn new(time: u64, price: f64, volume: f64) -> Self {
        Candle {
            time,
            open: price,
            high: price,
            low: price,
            close: price,
            volume,
            tick_count: 1,
        }
    }

    /// 更新 K 线 (接收新 tick)
    #[inline]
    pub fn update(&mut self, price: f64, volume: f64) {
        self.high = self.high.max(price);
        self.low = self.low.min(price);
        self.close = price;
        self.volume += volume;
        self.tick_count += 1;
    }

    /// 检查是否为空 K 线
    pub fn is_empty(&self) -> bool {
        self.tick_count == 0
    }
}

/// K 线历史数据 (用于返回给 JS)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CandleHistory {
    /// 当前时间周期
    pub timeframe: String,

    /// K 线数组
    pub candles: Vec<Candle>,

    /// 当前正在形成的 K 线 (实时)
    pub current_candle: Option<Candle>,

    /// 基于该周期 K 线收盘价计算的指标历史
    pub indicators: IndicatorHistory,
}

/// 指标历史数据 (与 K 线数组长度对齐)
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorHistory {
    /// MA(7) 历史
    pub ma7: Vec<Option<f64>>,
    /// MA(25) 历史
    pub ma25: Vec<Option<f64>>,
    /// MA(99) 历史
    pub ma99: Vec<Option<f64>>,
    /// EMA(7) 历史
    pub ema7: Vec<Option<f64>>,
    /// EMA(25) 历史
    pub ema25: Vec<Option<f64>>,
    /// BOLL 上轨历史
    pub boll_upper: Vec<Option<f64>>,
    /// BOLL 中轨历史
    pub boll_mid: Vec<Option<f64>>,
    /// BOLL 下轨历史
    pub boll_lower: Vec<Option<f64>>,
    /// MACD DIF 历史
    pub macd_dif: Vec<Option<f64>>,
    /// MACD DEA 历史
    pub macd_dea: Vec<Option<f64>>,
    /// MACD Hist 历史
    pub macd_hist: Vec<Option<f64>>,
    /// RSI(14) 历史
    pub rsi14: Vec<Option<f64>>,
}

impl IndicatorHistory {
    /// 移除前 n 个元素（当 K 线历史溢出时同步裁剪）
    pub fn drain_front(&mut self, n: usize) {
        if n == 0 { return; }
        self.ma7.drain(0..n.min(self.ma7.len()));
        self.ma25.drain(0..n.min(self.ma25.len()));
        self.ma99.drain(0..n.min(self.ma99.len()));
        self.ema7.drain(0..n.min(self.ema7.len()));
        self.ema25.drain(0..n.min(self.ema25.len()));
        self.boll_upper.drain(0..n.min(self.boll_upper.len()));
        self.boll_mid.drain(0..n.min(self.boll_mid.len()));
        self.boll_lower.drain(0..n.min(self.boll_lower.len()));
        self.macd_dif.drain(0..n.min(self.macd_dif.len()));
        self.macd_dea.drain(0..n.min(self.macd_dea.len()));
        self.macd_hist.drain(0..n.min(self.macd_hist.len()));
        self.rsi14.drain(0..n.min(self.rsi14.len()));
    }
}

// ============================================================================
// 模拟订单相关结构 (从 JavaScript 接收)
// ============================================================================

/// 模拟订单类型
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SimOrderSide {
    /// 买入/做多
    Buy,
    /// 卖出/做空
    Sell,
}

/// 模拟订单输入 (从 JavaScript 接收)
///
/// 用于模拟交易场景，订单提交后会影响市场价格和成交量
///
/// # JSON 格式示例
/// ```json
/// {
///   "side": "Buy",
///   "price": 42000.50,
///   "size": 0.5,
///   "leverage": 20
/// }
/// ```
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimOrder {
    /// 订单方向 (买入/卖出)
    pub side: SimOrderSide,

    /// 委托价格 (USDT)
    pub price: f64,

    /// 委托数量 (BTC)
    pub size: f64,

    /// 杠杆倍数
    pub leverage: u32,
}

/// 模拟订单执行结果 (返回给 JavaScript)
///
/// 包含订单执行后的市场影响
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimOrderResult {
    /// 订单是否成功执行
    pub success: bool,

    /// 执行后的价格
    pub executed_price: f64,

    /// 价格变动量 (正数涨/负数跌)
    pub price_impact: f64,

    /// 成交量
    pub executed_volume: f64,

    /// 订单方向
    pub side: String,

    /// 消息/错误信息
    pub message: String,
}

// ============================================================================
// 输入数据结构 (从 JavaScript 接收)
// ============================================================================

/// 订单簿数据结构
///
/// 从 JavaScript 接收的实时行情数据，包含买卖盘深度信息。
///
/// # JSON 格式示例
/// ```json
/// {
///   "symbol": "BTC-USDT",
///   "timestamp": 1703059200000,
///   "price": 42000.50,
///   "bids": [[41999.0, 1.5], [41998.0, 2.0]],
///   "asks": [[42001.0, 1.2], [42002.0, 0.8]]
/// }
/// ```
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderBook {
    /// 交易对符号 (如 "BTC-USDT")
    #[allow(dead_code)]
    pub symbol: String,

    /// 数据时间戳 (毫秒)
    #[allow(dead_code)]
    pub timestamp: u64,

    /// 当前中间价
    pub price: f64,

    /// 买单列表 [(价格, 数量), ...] - 按价格降序
    pub bids: Vec<(f64, f64)>,

    /// 卖单列表 [(价格, 数量), ...] - 按价格升序
    pub asks: Vec<(f64, f64)>,

    /// 成交量（可选，来自 Binance K 线数据的累计成交量）
    #[serde(default)]
    pub volume: Option<f64>,
}

// ============================================================================
// 输出数据结构 (返回给 JavaScript)
// ============================================================================

/// 布林带计算结果
///
/// 包含上轨、中轨、下轨三条线的值。
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BollResult {
    /// 上轨 = MA + (k × σ)
    pub upper: f64,

    /// 中轨 = MA(period)
    pub mid: f64,

    /// 下轨 = MA - (k × σ)
    pub lower: f64,
}

/// MACD 计算结果
///
/// 包含 DIF、DEA 和柱状图值。
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MacdResult {
    /// DIF = EMA(fast) - EMA(slow)
    pub dif: f64,

    /// DEA = EMA(DIF, signal)
    pub dea: f64,

    /// 柱状图 = (DIF - DEA) × 2
    pub hist: f64,
}

/// 完整分析结果
///
/// 包含所有技术指标的计算结果，序列化后返回给 JavaScript。
/// 字段使用 camelCase 命名以符合 JavaScript 习惯。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResult {
    // ========== 基础信息 ==========

    /// 买卖价差 (Best Ask - Best Bid)
    pub spread: f64,

    /// 当前价格历史长度
    pub history_length: usize,

    // ========== 简单移动平均线 (SMA) ==========

    /// SMA(5) - 5 周期简单移动平均
    pub sma_5: Option<f64>,

    /// MA(7) - 7 周期移动平均 (短期)
    pub ma_7: Option<f64>,

    /// MA(25) - 25 周期移动平均 (中期)
    pub ma_25: Option<f64>,

    /// MA(99) - 99 周期移动平均 (长期)
    pub ma_99: Option<f64>,

    // ========== 指数移动平均线 (EMA) ==========

    /// EMA(7) - 7 周期指数移动平均
    pub ema_7: Option<f64>,

    /// EMA(25) - 25 周期指数移动平均
    pub ema_25: Option<f64>,

    // ========== 布林带 (Bollinger Bands) ==========

    /// 布林带 (20 周期, 2 倍标准差)
    pub boll: Option<BollResult>,

    // ========== MACD ==========

    /// MACD (12, 26, 9)
    pub macd: Option<MacdResult>,

    // ========== RSI ==========

    /// RSI(14) - 14 周期相对强弱指数
    pub rsi_14: Option<f64>,

    // ========== 成交量指标 ==========

    /// 成交量 MA(5)
    pub vol_ma_5: Option<f64>,
}

// ============================================================================
// 单元测试
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_orderbook_structure() {
        let ob = OrderBook {
            symbol: "BTC-USDT".to_string(),
            timestamp: 1703059200000,
            price: 42000.5,
            bids: vec![(41999.0, 1.5), (41998.0, 2.0)],
            asks: vec![(42001.0, 1.2)],
            volume: None,
        };

        assert_eq!(ob.price, 42000.5);
        assert_eq!(ob.bids.len(), 2);
        assert_eq!(ob.asks.len(), 1);
        assert_eq!(ob.bids[0], (41999.0, 1.5));
    }

    #[test]
    fn test_boll_result() {
        let boll = BollResult {
            upper: 43000.0,
            mid: 42000.0,
            lower: 41000.0,
        };

        assert!(boll.upper > boll.mid);
        assert!(boll.mid > boll.lower);
    }

    #[test]
    fn test_macd_result() {
        let macd = MacdResult {
            dif: 100.0,
            dea: 80.0,
            hist: 40.0, // (100 - 80) * 2
        };

        assert_eq!(macd.hist, (macd.dif - macd.dea) * 2.0);
    }

    #[test]
    fn test_analysis_result_default_values() {
        let result = AnalysisResult {
            spread: 10.0,
            history_length: 100,
            sma_5: Some(42000.0),
            ma_7: None,
            ma_25: None,
            ma_99: None,
            ema_7: None,
            ema_25: None,
            boll: Some(BollResult {
                upper: 43000.0,
                mid: 42000.0,
                lower: 41000.0,
            }),
            macd: None,
            rsi_14: Some(55.5),
            vol_ma_5: None,
        };

        assert_eq!(result.spread, 10.0);
        assert_eq!(result.history_length, 100);
        assert!(result.sma_5.is_some());
        assert!(result.ma_7.is_none());
        assert!(result.boll.is_some());
    }
}
