/**
 * RustQuantLab 类型定义
 * 统一管理所有接口和类型
 */

/* ============================================
   订单簿相关类型
   ============================================ */

/**
 * 订单簿数据结构
 * 用于模拟交易所 WebSocket 推送的行情数据
 */
export interface OrderBook {
  /** 交易对符号，如 "BBB-AAA" */
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
  };
}

/**
 * Worker 消息类型：停止数据生成
 */
export interface WorkerStopMessage {
  type: 'STOP';
}

/**
 * Worker 接收的消息联合类型
 */
export type WorkerMessage = WorkerStartMessage | WorkerStopMessage;

/**
 * Worker 发送的消息类型
 */
export interface WorkerDataMessage {
  type: 'DATA';
  payload: OrderBook;
}

/* ============================================
   Wasm 引擎相关类型
   ============================================ */

/**
 * Rust MarketEngine 分析结果
 * 由 Wasm on_tick 方法返回
 */
export interface AnalysisResult {
  /** 买卖价差 (Ask[0] - Bid[0]) */
  spread: number;
  /** 5 周期简单移动平均线，数据不足时为 null */
  sma5: number | null;
  /** 当前历史价格数量 */
  historyLength: number;
}

/**
 * MarketEngine Wasm 实例类型
 */
export interface MarketEngineInstance {
  on_tick: (data: OrderBook) => AnalysisResult;
  history_length: () => number;
  clear_history: () => void;
  free: () => void;
}

/**
 * MarketEngine 构造函数类型
 */
export interface MarketEngineConstructor {
  new (): MarketEngineInstance;
}

/**
 * Wasm 模块类型
 */
export interface WasmModule {
  MarketEngine: MarketEngineConstructor;
}

/* ============================================
   K 线图表相关类型
   ============================================ */

/**
 * K 线蜡烛图数据结构
 * 由 Tick 数据每秒聚合生成
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
  /** MA5 均线值 */
  ma5: number | null;
  /** MA10 均线值 */
  ma10: number | null;
  /** MA20 均线值 */
  ma20: number | null;
  /** MA30 均线值 */
  ma30: number | null;
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
  /** 切换数据流开关 */
  toggleFeed: () => void;
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
  /** K 线数量 */
  candleCount: number;
  /** 是否运行中 */
  isRunning: boolean;
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
