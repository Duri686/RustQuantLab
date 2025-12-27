/**
 * RustQuantLab 类型定义
 * 统一管理所有接口和类型
 */

// 导入 Wasm 类型以在本文件内使用
import type {
  WasmTimeframe as _WasmTimeframe,
  WasmCandleHistory as _WasmCandleHistory,
} from './wasm';

// 重新导出 Wasm 类型
export type {
  WasmOrderBook,
  WasmBollResult,
  WasmMacdResult,
  WasmAnalysisResult,
  WasmMarketEngine,
  WasmMarketEngineConstructor,
  WasmModule,
  // K 线相关类型
  WasmTimeframe,
  WasmCandle,
  WasmCandleHistory,
} from './wasm';

// 重导出时间周期常量
export { TIMEFRAMES } from './wasm';

// 重新导出交易类型
export type {
  Position,
  PositionSide,
  RiskLevel,
  LiquidationResult,
  EngineEvent,
  PositionOpenedEvent,
  PositionClosedEvent,
  LiquidatedEvent,
  MarginWarningEvent,
  TradingState as WasmTradingState,
  OpenPositionRequest,
  OpenPositionResult,
  ClosePositionResult,
} from './trading';

export {
  RISK_LEVEL_CONFIG,
  isPositionOpenedEvent,
  isPositionClosedEvent,
  isLiquidatedEvent,
  isMarginWarningEvent,
} from './trading';

/* ============================================
   订单簿相关类型
   ============================================ */

/**
 * 订单簿数据结构
 * 用于模拟交易所 WebSocket 推送的行情数据
 */
export interface OrderBook {
  /** 交易对符号，如 "BTC-USDT" */
  symbol: string;
  /** 数据时间戳（毫秒） */
  timestamp: number;
  /** 当前中间价 */
  price: number;
  /** 买单列表 [价格, 数量]，按价格降序排列（Top 10） */
  bids: [number, number][];
  /** 卖单列表 [价格, 数量]，按价格升序排列（Top 10） */
  asks: [number, number][];
}

/* ============================================
   Worker 通信类型
   ============================================ */

/**
 * Worker 消息类型：启动数据生成
 */
export interface WorkerStartMessage {
  type: 'START';
  payload: {
    interval: number;
    /** 起始价格 (可选，用于从历史数据结束价继续) */
    startPrice?: number;
  };
}

/**
 * Worker 消息类型：停止数据生成
 */
export interface WorkerStopMessage {
  type: 'STOP';
}

/**
 * Worker 消息类型：请求历史 K 线数据
 */
export interface WorkerHistoryRequestMessage {
  type: 'GET_HISTORY';
  payload: {
    /** 时间周期 (秒) */
    timeframeSeconds: number;
    /** 请求的 K 线数量 */
    count: number;
  };
}

/**
 * Worker 接收的消息联合类型
 */
export type WorkerMessage =
  | WorkerStartMessage
  | WorkerStopMessage
  | WorkerHistoryRequestMessage;

/**
 * 历史 K 线数据 (由 Worker 生成)
 * 结构与 Rust Candle 对齐，支持直接加载到引擎
 */
export interface HistoryCandle {
  /** K 线开始时间戳 (毫秒) */
  time: number;
  /** 开盘价 */
  open: number;
  /** 最高价 */
  high: number;
  /** 最低价 */
  low: number;
  /** 收盘价 */
  close: number;
  /** 成交量 */
  volume: number;
  /** 该周期内 tick 数量 (处来初始化为 1) */
  tickCount: number;
}

/**
 * Worker 发送的消息类型：实时数据
 */
export interface WorkerDataMessage {
  type: 'DATA';
  payload: OrderBook;
}

/**
 * Worker 发送的消息类型：历史 K 线数据
 */
export interface WorkerHistoryDataMessage {
  type: 'HISTORY';
  payload: {
    timeframeSeconds: number;
    candles: HistoryCandle[];
  };
}

/**
 * Worker 发送的消息联合类型
 */
export type WorkerOutMessage = WorkerDataMessage | WorkerHistoryDataMessage;

/* ============================================
   Wasm 引擎相关类型
   ============================================ */

/**
 * 布林带结果
 */
export interface BollResult {
  upper: number;
  mid: number;
  lower: number;
}

/**
 * MACD 结果
 */
export interface MacdResult {
  dif: number;
  dea: number;
  hist: number;
}

/**
 * Rust MarketEngine 分析结果
 * 由 Wasm on_tick 方法返回
 */
export interface AnalysisResult {
  /** 买卖价差 */
  spread: number;
  /** 当前历史价格数量 */
  historyLength: number;

  // Simple Moving Averages
  sma5: number | null;
  ma7: number | null;
  ma25: number | null;
  ma99: number | null;

  // Exponential Moving Averages
  ema7: number | null;
  ema25: number | null;

  // Bollinger Bands
  boll: BollResult | null;

  // MACD
  macd: MacdResult | null;

  // RSI
  rsi14: number | null;

  // Volume MA
  volMa5: number | null;
}

/**
 * 当前实时指标值 (单个数值，用于当前 K 线)
 */
export interface CurrentIndicators {
  sma5: number | null;
  ma7: number | null;
  ma25: number | null;
  ma99: number | null;
  ema7: number | null;
  ema25: number | null;
  rsi14: number | null;
  bollUpper: number | null;
  bollMid: number | null;
  bollLower: number | null;
  macdDif: number | null;
  macdDea: number | null;
  macdHist: number | null;
  volMa5: number | null;
}

/**
 * 指标数据历史 (与 K 线数组同步)
 * 严格对齐 WasmAnalysisResult 字段命名 (camelCase)
 */
export interface IndicatorData {
  /** SMA(5) 历史 */
  sma5: (number | null)[];
  ma7: (number | null)[];
  ma25: (number | null)[];
  ma99: (number | null)[];
  ema7: (number | null)[];
  ema25: (number | null)[];
  rsi14: (number | null)[];
  /** 布林带上轨历史 (从 boll.upper 提取) */
  bollUpper: (number | null)[];
  /** 布林带中轨历史 (从 boll.mid 提取) */
  bollMid: (number | null)[];
  /** 布林带下轨历史 (从 boll.lower 提取) */
  bollLower: (number | null)[];
  /** MACD DIF 历史 (从 macd.dif 提取) */
  macdDif: (number | null)[];
  /** MACD DEA 历史 (从 macd.dea 提取) */
  macdDea: (number | null)[];
  /** MACD 柱状图历史 (从 macd.hist 提取) */
  macdHist: (number | null)[];
  volMa5: (number | null)[];
}

/**
 * MarketEngine Wasm 实例类型
 */
export interface MarketEngineInstance {
  on_tick: (data: OrderBook) => AnalysisResult;
  history_length: () => number;
  clear_history: () => void;
  free: () => void;

  // K 线相关方法
  set_timeframe: (timeframe: _WasmTimeframe) => boolean;
  get_timeframe: () => _WasmTimeframe;
  get_candles: (timeframe: _WasmTimeframe) => _WasmCandleHistory;
  get_active_candles: () => _WasmCandleHistory;
  get_candle_count: (timeframe: _WasmTimeframe) => number;
  /** 加载历史 K 线数据到指定时间周期 */
  load_history_candles: (
    timeframe: _WasmTimeframe,
    candles: HistoryCandle[],
  ) => number;
  /** 加载 1s K 线并自动聚合到所有高周期 (1m/5m/15m/1H/4H/1D) */
  load_history_1m_and_aggregate: (
    candles: HistoryCandle[],
  ) => [string, number][];

  // 模拟交易方法
  submit_order: (order: SimOrder) => SimOrderResult;
}

/**
 * MarketEngine 构造函数类型
 */
export interface MarketEngineConstructor {
  new (): MarketEngineInstance;
}

// WasmModule 已从 ./wasm 导出

/* ============================================
   K 线图表相关类型
   ============================================ */

/**
 * K 线蜡烛图数据结构
 * 由 Tick 数据每秒聚合生成
 * 均线字段严格对齐 Rust Wasm 输出 (弃用 ma5/ma10/ma20/ma30)
 */
export interface Candle {
  /** 时间戳（秒级精度） */
  time: number;
  /** 时间显示字符串 */
  timeStr: string;
  /** 开盘价 */
  open: number;
  /** 最高价 */
  high: number;
  /** 最低价 */
  low: number;
  /** 收盘价 */
  close: number;
  /** 成交量 */
  volume: number;
  /** SMA(5) 均线值 - 新 Rust 字段 */
  sma5: number | null;
  /** MA(7) 均线值 */
  ma7: number | null;
  /** MA(25) 均线值 */
  ma25: number | null;
  /** MA(99) 均线值 */
  ma99: number | null;
}

/* ============================================
   Trading Engine Hook 返回类型
   ============================================ */

/**
 * useTradingEngine Hook 返回的数据结构
 */
export interface TradingEngineState {
  /** 最新的市场数据 */
  latestData: OrderBook | null;
  /** Wasm 分析结果 */
  analysisResult: AnalysisResult | null;
  /** K 线历史数据 */
  candleHistory: Candle[];
  /** 当前正在形成的 K 线 */
  currentLiveCandle: Candle | null;
  /** 指标数据历史 (与 candleHistory 同步) */
  indicatorData: IndicatorData;
  /** 当前实时指标值 (用于 currentLiveCandle) */
  currentIndicators: CurrentIndicators;
  /** 当前时间周期 */
  currentTimeframe: _WasmTimeframe | null;
  /** 数据流是否运行中 */
  isRunning: boolean;
  /** Wasm 是否就绪 */
  wasmReady: boolean;
  /** 加载中状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 价格趋势 */
  priceTrend: 'up' | 'down' | 'neutral';
  /** 价格颜色 CSS 类 */
  priceColorClass: string;
  /** 可用余额 (USDT) */
  availableBalance: number;
  /** 订单记录列表 */
  orders: OrderRecord[];
  /** 切换数据流开关 */
  toggleFeed: () => void;
  /** 切换时间周期 */
  setTimeframe?: (timeframe: _WasmTimeframe) => boolean;
  /** 提交模拟订单 */
  submitOrder?: (order: {
    side: 'buy' | 'sell';
    price: number;
    size: number;
    leverage: number;
    marginMode: MarginMode;
  }) => SimOrderResult | null;
  /** 平仓操作 */
  closeOrder?: (orderId: string, currentPrice: number) => boolean;
  /** 追加保证金（仅逐仓模式） */
  addMargin?: (orderId: string, amount: number) => boolean;
}

/* ============================================
   组件 Props 类型
   ============================================ */

/**
 * Header 组件 Props
 */
export interface HeaderProps {
  /** 数据流是否运行中 */
  isRunning: boolean;
  /** 切换数据流回调 */
  onToggle: () => void;
  /** 当前价格 */
  price?: number;
  /** 交易对符号 */
  symbol?: string;
  /** 价格趋势 */
  priceTrend?: 'up' | 'down' | 'neutral';
  /** 价格颜色类 */
  priceColorClass?: string;
}

/**
 * StatsPanel 组件 Props
 */
export interface StatsPanelProps {
  /** 最新市场数据 */
  latestData: OrderBook | null;
  /** Wasm 分析结果 */
  analysisResult: AnalysisResult | null;
  /** 价格颜色类 */
  priceColorClass: string;
}

/**
 * OrderBook 组件 Props
 */
export interface OrderBookProps {
  /** 买单列表 */
  bids: [number, number][];
  /** 卖单列表 */
  asks: [number, number][];
  /** 当前价格 */
  price?: number;
  /** 价格趋势 */
  priceTrend?: 'up' | 'down' | 'neutral';
  /** 价格颜色类 */
  priceColorClass?: string;
  /** 时间戳 */
  timestamp?: number;
}

/* ============================================
   模拟交易相关类型
   ============================================ */

/**
 * 模拟订单方向
 */
export type SimOrderSide = 'buy' | 'sell';

/**
 * 模拟订单输入
 * 传递给 Rust MarketEngine.submit_order
 */
export interface SimOrder {
  /** 订单方向 */
  side: 'Buy' | 'Sell';
  /** 委托价格 */
  price: number;
  /** 委托数量 */
  size: number;
  /** 杠杆倍数 */
  leverage: number;
}

/**
 * 模拟订单执行结果
 * 从 Rust MarketEngine.submit_order 返回
 */
export interface SimOrderResult {
  /** 是否成功执行 */
  success: boolean;
  /** 执行价格 */
  executedPrice: number;
  /** 价格影响（正数涨/负数跌） */
  priceImpact: number;
  /** 执行成交量 */
  executedVolume: number;
  /** 订单方向 */
  side: string;
  /** 消息/错误信息 */
  message: string;
}

/** 保证金模式 */
export type MarginMode = 'cross' | 'isolated';

/**
 * 订单记录（前端维护）
 */
export interface OrderRecord {
  /** 订单 ID */
  id: string;
  /** 订单方向 */
  side: 'buy' | 'sell';
  /** 委托价格 */
  price: number;
  /** 委托数量 */
  size: number;
  /** 杠杆倍数 */
  leverage: number;
  /** 执行价格 */
  executedPrice: number;
  /** 保证金 */
  margin: number;
  /** 保证金模式 */
  marginMode: MarginMode;
  /** 价格影响 */
  priceImpact: number;
  /** 时间戳 */
  timestamp: number;
  /** 盈亏 (实时计算) */
  pnl?: number;
  /** 是否已平仓 */
  closed?: boolean;
  /** 平仓价格 */
  closePrice?: number;
  /** 平仓时间 */
  closeTimestamp?: number;
  /** 实现盈亏 (平仓后固定) */
  realizedPnl?: number;
  /** 爆仓价格 (逐仓模式) */
  liquidationPrice: number;
  /** 是否爆仓 */
  liquidated?: boolean;
}
