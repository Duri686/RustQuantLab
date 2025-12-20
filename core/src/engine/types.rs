//! # 引擎类型定义 (Frontend API Types)
//!
//! 包含前端通信所需的事件、状态快照、请求/响应结构体。
//!
//! ## 使用方式
//!
//! 所有类型都通过 JSON 序列化传递给 JavaScript。字段名自动转换为 camelCase。
//!
//! ## TypeScript 类型参考
//!
//! ```typescript
//! // 开仓请求
//! interface OpenPositionRequest {
//!   symbol?: string;      // 默认 "BTCUSDT"
//!   side: "long" | "short";
//!   size: number;         // BTC 数量
//!   price?: number;       // 可选，默认市价
//!   leverage?: number;    // 可选，1-125
//!   marginMode?: "cross" | "isolated";
//! }
//!
//! // 交易状态
//! interface TradingState {
//!   balance: number;
//!   availableBalance: number;
//!   accountEquity: number;
//!   leverage: number;
//!   currentPrice: number;
//!   positions: Position[];
//!   pendingEvents: EngineEvent[];
//! }
//! ```

use serde::{Deserialize, Serialize};
use crate::risk::LiquidationResult;
use crate::trading::{MarginMode, OrderType, PendingOrder, Position};

// ============================================================================
// 引擎事件
// ============================================================================

/// 引擎事件类型
///
/// 用于向前端通知重要状态变化。通过 `get_trading_state()` 返回的
/// `pendingEvents` 字段获取。
///
/// ## JSON 示例
///
/// ```json
/// {
///   "type": "positionOpened",
///   "symbol": "BTCUSDT",
///   "side": "Long",
///   "size": 0.1,
///   "entryPrice": 50000.0,
///   "leverage": 10,
///   "liquidationPrice": 45000.0,
///   "marginMode": "Cross"
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum EngineEvent {
    /// 仓位已开启
    #[serde(rename_all = "camelCase")]
    PositionOpened {
        symbol: String,
        side: String,
        size: f64,
        entry_price: f64,
        leverage: u8,
        liquidation_price: f64,
        margin_mode: String,
    },
    /// 仓位已合并 (加仓)
    #[serde(rename_all = "camelCase")]
    PositionMerged {
        symbol: String,
        side: String,
        added_size: f64,
        new_size: f64,
        old_entry_price: f64,
        new_entry_price: f64,
    },
    /// 仓位已减少 (部分平仓)
    #[serde(rename_all = "camelCase")]
    PositionReduced {
        symbol: String,
        side: String,
        closed_size: f64,
        remaining_size: f64,
        realized_pnl: f64,
    },
    /// 仓位已关闭
    #[serde(rename_all = "camelCase")]
    PositionClosed {
        symbol: String,
        side: String,
        size: f64,
        entry_price: f64,
        exit_price: f64,
        realized_pnl: f64,
    },
    /// 仓位被强制平仓
    #[serde(rename_all = "camelCase")]
    Liquidated {
        symbol: String,
        side: String,
        size: f64,
        entry_price: f64,
        liquidation_price: f64,
        lost_margin: f64,
    },
    /// 风险预警
    #[serde(rename_all = "camelCase")]
    MarginWarning {
        symbol: String,
        risk_level: String,
        margin_ratio: f64,
        liquidation_price: f64,
        distance_pct: f64,
    },
    /// 全仓账户风险预警
    #[serde(rename_all = "camelCase")]
    AccountRiskWarning {
        account_equity: f64,
        total_maintenance_margin: f64,
        risk_level: String,
    },
    /// 限价单已创建
    #[serde(rename_all = "camelCase")]
    LimitOrderCreated {
        order_id: String,
        symbol: String,
        side: String,
        size: f64,
        limit_price: f64,
        leverage: u8,
    },
    /// 限价单已触发成交
    #[serde(rename_all = "camelCase")]
    LimitOrderFilled {
        order_id: String,
        symbol: String,
        side: String,
        size: f64,
        fill_price: f64,
    },
    /// 限价单已取消
    #[serde(rename_all = "camelCase")]
    LimitOrderCancelled {
        order_id: String,
        symbol: String,
        released_margin: f64,
    },
}

// ============================================================================
// 交易状态
// ============================================================================

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
    /// 账户权益 (全仓模式: balance + sum(unrealized_pnl))
    pub account_equity: f64,
    /// 当前杠杆设置
    pub leverage: u8,
    /// 当前价格 (主交易对)
    pub current_price: f64,
    /// 所有活跃仓位 (按 symbol 索引)
    pub positions: Vec<Position>,
    /// 已平仓仓位历史
    pub closed_positions: Vec<Position>,
    /// 当前选中的仓位 (向后兼容)
    pub position: Option<Position>,
    /// 最新风险评估结果 (当前选中仓位)
    pub risk_assessment: Option<LiquidationResult>,
    /// 待处理事件队列
    pub pending_events: Vec<EngineEvent>,
    /// 活跃挂单列表
    pub pending_orders: Vec<PendingOrder>,
}

// ============================================================================
// 请求/响应结构体
// ============================================================================

/// 开仓请求
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenPositionRequest {
    /// 交易对符号 (如 "BTCUSDT", 默认 "BTCUSDT")
    #[serde(default = "default_symbol")]
    pub symbol: String,
    /// 仓位方向: "long" 或 "short"
    pub side: String,
    /// 仓位大小 (BTC)
    pub size: f64,
    /// 可选: 指定开仓价格 (默认使用当前市价)
    pub price: Option<f64>,
    /// 当前市场价格 (限价单必填，用于确定触发方向)
    pub current_price: Option<f64>,
    /// 可选: 杠杆倍数 (默认使用引擎当前杠杆)
    pub leverage: Option<u8>,
    /// 保证金模式 (默认 Cross)
    #[serde(default)]
    pub margin_mode: MarginMode,
    /// 订单类型 (默认 Market)
    #[serde(default)]
    pub order_type: OrderType,
}

fn default_symbol() -> String {
    "BTCUSDT".to_string()
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

/// 挂单创建结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaceOrderResult {
    pub success: bool,
    pub message: String,
    /// 市价单: 返回仓位; 限价单: 返回挂单 ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position: Option<Position>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
}

/// 取消挂单结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelOrderResult {
    pub success: bool,
    pub message: String,
    /// 解冻的保证金
    pub released_margin: f64,
}
