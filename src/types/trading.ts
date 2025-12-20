/**
 * @fileoverview 交易引擎类型定义
 *
 * 与 Rust `core/src/engine.rs` 和 `core/src/risk.rs` 结构体严格对应。
 * 所有字段命名遵循 Serde `rename_all = "camelCase"` 规则。
 *
 * @see core/src/engine.rs - 交易状态结构体
 * @see core/src/risk.rs - 风险评估结构体
 * @module types/trading
 */

// ============================================================================
// 仓位相关类型
// ============================================================================

/**
 * 仓位方向
 *
 * 与 Rust `PositionSide` 枚举对应
 */
export type PositionSide = 'Long' | 'Short';

/**
 * 活跃仓位
 *
 * 由 Rust `Position` 结构体序列化而来
 */
export interface Position {
  /** 仓位唯一标识 (如 "BTCUSDT_Long", "BTCUSDT_Short") */
  id: string;

  /** 仓位方向 */
  side: PositionSide;

  /** 仓位大小 (BTC 数量) */
  size: number;

  /** 开仓均价 */
  entryPrice: number;

  /** 开仓时间戳 (毫秒) */
  openTime: number;

  /** 使用的保证金 (USDT) */
  margin: number;

  /** 杠杆倍数 */
  leverage: number;

  /** 强平价格 */
  liquidationPrice: number;

  /** 未实现盈亏 (USDT) */
  unrealizedPnl: number;

  /** 盈亏百分比 (相对于保证金) */
  pnlPercentage: number;

  /** 保证金率 (仓位权益 / 维持保证金) */
  marginRatio: number;

  /** 交易对符号 (如 "BTCUSDT") */
  symbol?: string;

  /** 保证金模式 */
  marginMode?: 'Cross' | 'Isolated';

  /** 仓位状态 */
  status?: 'open' | 'closed' | 'liquidated';

  /** 已实现盈亏 (平仓后有值) */
  realizedPnl?: number;

  /** 平仓价格 (平仓后有值) */
  exitPrice?: number;

  /** 平仓时间戳 (平仓后有值) */
  closeTime?: number;
}

// ============================================================================
// 核心类型定义
// ============================================================================

/**
 * 保证金模式
 */
export type MarginMode = 'cross' | 'isolated';

/**
 * 风险等级
 */
export type RiskLevel = 'Safe' | 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * 风险等级配置 (用于 UI 展示)
 */
export const RISK_LEVEL_CONFIG: Record<
  RiskLevel,
  { color: string; bgColor: string; label: string }
> = {
  Safe: { color: 'text-green-500', bgColor: 'bg-green-500/10', label: '安全' },
  Low: { color: 'text-blue-500', bgColor: 'bg-blue-500/10', label: '低风险' },
  Medium: {
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    label: '中风险',
  },
  High: {
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    label: '高风险',
  },
  Critical: {
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    label: '极高风险',
  },
};

/**
 * 强平计算结果
 *
 * 由 Rust `LiquidationResult` 结构体序列化而来
 */
export interface LiquidationResult {
  /** 风险等级 */
  riskLevel: RiskLevel;

  /** 当前保证金率 = (钱包余额 + 未实现盈亏) / 维持保证金 */
  marginRatio: number;

  /** 强平价格 */
  liquidationPrice: number;

  /** 距离强平的价格百分比 */
  distanceToLiquidationPct: number;

  /** 维持保证金 (USDT) */
  maintenanceMargin: number;

  /** 可用余额 (USDT) */
  availableBalance: number;

  /** 是否触发强平 */
  isLiquidated: boolean;

  /** 预警消息 (如有) */
  warningMessage: string | null;
}

// ============================================================================
// 引擎事件类型 (Tagged Union)
// ============================================================================

/**
 * 仓位开启事件
 */
export interface PositionOpenedEvent {
  type: 'positionOpened';
  symbol: string;
  side: string;
  size: number;
  entryPrice: number;
  leverage: number;
  liquidationPrice: number;
  marginMode: string;
}

/**
 * 仓位合并事件 (加仓)
 */
export interface PositionMergedEvent {
  type: 'positionMerged';
  symbol: string;
  side: string;
  addedSize: number;
  newSize: number;
  oldEntryPrice: number;
  newEntryPrice: number;
}

/**
 * 仓位减少事件 (部分平仓)
 */
export interface PositionReducedEvent {
  type: 'positionReduced';
  symbol: string;
  side: string;
  closedSize: number;
  remainingSize: number;
  realizedPnl: number;
}

/**
 * 仓位关闭事件
 */
export interface PositionClosedEvent {
  type: 'positionClosed';
  symbol: string;
  side: string;
  size: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnl: number;
}

/**
 * 强制平仓事件
 */
export interface LiquidatedEvent {
  type: 'liquidated';
  symbol: string;
  side: string;
  size: number;
  entryPrice: number;
  liquidationPrice: number;
  lostMargin: number;
}

/**
 * 保证金预警事件
 */
export interface MarginWarningEvent {
  type: 'marginWarning';
  symbol: string;
  riskLevel: string;
  marginRatio: number;
  liquidationPrice: number;
  distancePct: number;
}

/**
 * 账户风险预警事件 (全仓模式)
 */
export interface AccountRiskWarningEvent {
  type: 'accountRiskWarning';
  accountEquity: number;
  totalMaintenanceMargin: number;
  riskLevel: string;
}

/**
 * 引擎事件联合类型
 *
 * 与 Rust `EngineEvent` 枚举对应 (tagged union)
 */
export type EngineEvent =
  | PositionOpenedEvent
  | PositionMergedEvent
  | PositionReducedEvent
  | PositionClosedEvent
  | LiquidatedEvent
  | MarginWarningEvent
  | AccountRiskWarningEvent;

// ============================================================================
// 交易状态类型
// ============================================================================

/**
 * 交易状态快照
 *
 * 由 Rust `TradingState` 结构体序列化而来
 * 通过 `get_trading_state()` Wasm 方法获取
 */
export interface TradingState {
  /** 钱包余额 (包含已实现盈亏) */
  balance: number;

  /** 可用余额 (未被仓位占用的保证金) */
  availableBalance: number;

  /** 账户权益 (全仓模式: balance + sum(unrealized_pnl)) */
  accountEquity: number;

  /** 当前杠杆设置 */
  leverage: number;

  /** 当前市场价格 */
  currentPrice: number;

  /** 所有活跃仓位 (多仓位模式) */
  positions: Position[];

  /** 已平仓仓位历史 */
  closedPositions: Position[];

  /** 主仓位 (向后兼容，通常是 BTCUSDT) */
  position: Position | null;

  /** 最新风险评估结果 */
  riskAssessment: LiquidationResult | null;

  /** 待处理事件队列 (消费后自动清空) */
  pendingEvents: EngineEvent[];
}

// ============================================================================
// 开仓/平仓请求和结果类型
// ============================================================================

/**
 * 开仓请求
 *
 * 传递给 Rust `MarketEngine.open_position()` 方法
 */
export interface OpenPositionRequest {
  /** 交易对符号 (如 "BTCUSDT", 默认 "BTCUSDT") */
  symbol?: string;

  /** 仓位方向: "long" 或 "short" */
  side: string;

  /** 仓位大小 (BTC) */
  size: number;

  /** 可选: 指定开仓价格 (默认使用当前市价) */
  price?: number;

  /** 可选: 杠杆倍数 (默认使用引擎当前杠杆) */
  leverage?: number;

  /** 保证金模式 (默认 Cross) */
  marginMode?: MarginMode;
}

/**
 * 开仓结果
 *
 * 由 Rust `MarketEngine.open_position()` 返回
 */
export interface OpenPositionResult {
  /** 是否成功 */
  success: boolean;

  /** 操作消息 */
  message: string;

  /** 成功时返回的仓位信息 */
  position?: Position;

  /** 失败时的错误代码 */
  errorCode?: string;
}

/**
 * 平仓结果
 *
 * 由 Rust `MarketEngine.close_position()` 返回
 */
export interface ClosePositionResult {
  /** 是否成功 */
  success: boolean;

  /** 操作消息 */
  message: string;

  /** 已实现盈亏 */
  realizedPnl: number;

  /** 平仓价格 */
  exitPrice: number;

  /** 平仓后的新余额 */
  newBalance: number;
}

// ============================================================================
// Hook 返回类型
// ============================================================================

/**
 * useTradingState Hook 返回类型
 *
 * 提供交易状态管理和操作方法
 */
export interface UseTradingStateReturn {
  // ========== 状态 ==========

  /** Wasm 是否就绪 */
  wasmReady: boolean;

  /** 交易状态快照 */
  tradingState: TradingState | null;

  /** 当前仓位 (便捷访问) */
  position: Position | null;

  /** 当前风险评估 (便捷访问) */
  riskAssessment: LiquidationResult | null;

  /** 是否有活跃仓位 */
  hasPosition: boolean;

  /** 最后一次事件列表 */
  lastEvents: EngineEvent[];

  // ========== 操作方法 ==========

  /**
   * 每 Tick 调用，更新价格并触发风险检查
   * @param currentPrice - 当前市场价格
   */
  onTick: (currentPrice: number) => void;

  /**
   * 开仓
   * @param side - 仓位方向 ('LONG' | 'SHORT')
   * @param size - 仓位大小 (BTC)
   * @param leverage - 杠杆倍数 (可选，使用当前设置)
   * @param marginMode - 保证金模式 (可选，默认 'cross')
   */
  placeOrder: (
    side: 'LONG' | 'SHORT',
    size: number,
    leverage?: number,
    marginMode?: MarginMode,
  ) => OpenPositionResult | null;

  /**
   * 平仓 (支持按 symbol 或 exitPrice)
   * @param symbolOrPrice - symbol 字符串或 exitPrice 数值
   * @param exitPrice - 当第一个参数为 symbol 时的平仓价格
   */
  closePosition: (
    symbolOrPrice?: string | number,
    exitPrice?: number,
  ) => ClosePositionResult | null;

  /**
   * 设置杠杆倍数 (仅在无持仓时有效)
   * @param leverage - 杠杆倍数 (1-125)
   */
  setLeverage: (leverage: number) => boolean;

  /**
   * 重置账户 (清除仓位，恢复初始余额)
   * @param initialBalance - 可选的初始余额
   */
  resetAccount: (initialBalance?: number) => void;
}

// ============================================================================
// 类型守卫函数
// ============================================================================

/**
 * 检查事件是否为开仓事件
 */
export function isPositionOpenedEvent(
  event: EngineEvent,
): event is PositionOpenedEvent {
  return event.type === 'positionOpened';
}

/**
 * 检查事件是否为平仓事件
 */
export function isPositionClosedEvent(
  event: EngineEvent,
): event is PositionClosedEvent {
  return event.type === 'positionClosed';
}

/**
 * 检查事件是否为强平事件
 */
export function isLiquidatedEvent(
  event: EngineEvent,
): event is LiquidatedEvent {
  return event.type === 'liquidated';
}

/**
 * 检查事件是否为预警事件
 */
export function isMarginWarningEvent(
  event: EngineEvent,
): event is MarginWarningEvent {
  return event.type === 'marginWarning';
}
