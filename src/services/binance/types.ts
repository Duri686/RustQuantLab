/**
 * Binance API 类型定义
 * 
 * 支持现货 (api.binance.com) 和合约 (fapi.binance.com)
 */

// ============================================================================
// REST API 响应类型
// ============================================================================

/**
 * Binance K 线原始数据格式
 * [开盘时间, 开, 高, 低, 收, 成交量, 收盘时间, 成交额, 成交笔数, 主动买入成交量, 主动买入成交额, 忽略]
 */
export type BinanceKlineRaw = [
  number,  // 0: 开盘时间 (毫秒)
  string,  // 1: 开盘价
  string,  // 2: 最高价
  string,  // 3: 最低价
  string,  // 4: 收盘价
  string,  // 5: 成交量
  number,  // 6: 收盘时间 (毫秒)
  string,  // 7: 成交额
  number,  // 8: 成交笔数
  string,  // 9: 主动买入成交量
  string,  // 10: 主动买入成交额
  string,  // 11: 忽略
];

/**
 * 解析后的 K 线数据
 */
export interface BinanceKline {
  /** 开盘时间 (毫秒) */
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
  /** 收盘时间 (毫秒) */
  closeTime: number;
  /** 成交额 (USDT) */
  quoteVolume: number;
  /** 成交笔数 */
  trades: number;
  /** 主动买入成交量 */
  takerBuyVolume: number;
  /** 主动买入成交额 (USDT) */
  takerBuyQuoteVolume: number;
}

/**
 * 订单簿深度数据
 */
export interface BinanceDepth {
  lastUpdateId: number;
  bids: [string, string][]; // [价格, 数量]
  asks: [string, string][];
}

/**
 * 24 小时价格统计
 */
export interface BinanceTicker24h {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openPrice: string;
  count: number;
}

/**
 * 合约标记价格 / 资金费率数据 (来自 /fapi/v1/premiumIndex)
 */
export interface BinancePremiumIndex {
  symbol: string;
  /** 标记价格 */
  markPrice: string;
  /** 指数价格 */
  indexPrice: string;
  /** 预估结算价格 */
  estimatedSettlePrice: string;
  /** 最近一次资金费率 */
  lastFundingRate: string;
  /** 下次资金费率结算时间 (ms) */
  nextFundingTime: number;
  /** 下次倒数资金费率 */
  interestRate: string;
  /** 数据时间 */
  time: number;
}

// ============================================================================
// WebSocket 消息类型
// ============================================================================

/**
 * K 线 WebSocket 消息
 */
export interface BinanceWsKlineMsg {
  e: 'kline';      // 事件类型
  E: number;       // 事件时间
  s: string;       // 交易对
  k: {
    t: number;     // K 线开始时间
    T: number;     // K 线结束时间
    s: string;     // 交易对
    i: string;     // 时间周期
    f: number;     // 第一笔成交 ID
    L: number;     // 最后一笔成交 ID
    o: string;     // 开盘价
    c: string;     // 收盘价
    h: string;     // 最高价
    l: string;     // 最低价
    v: string;     // 成交量
    n: number;     // 成交笔数
    x: boolean;    // K 线是否完结
    q: string;     // 成交额
    V: string;     // 主动买入成交量
    Q: string;     // 主动买入成交额
    B: string;     // 忽略
  };
}

/**
 * 逐笔交易 WebSocket 消息
 */
export interface BinanceWsTradeMsg {
  e: 'trade';      // 事件类型
  E: number;       // 事件时间
  s: string;       // 交易对
  t: number;       // 交易 ID
  p: string;       // 价格
  q: string;       // 数量
  T: number;       // 成交时间
  m: boolean;      // 是否是买方主动成交
}

/**
 * 深度更新 WebSocket 消息 (增量)
 */
export interface BinanceWsDepthMsg {
  e: 'depthUpdate';
  E: number;
  s: string;
  U: number;       // 第一个更新 ID
  u: number;       // 最后一个更新 ID
  b: [string, string][]; // Bids
  a: [string, string][]; // Asks
}

/**
 * Mini Ticker WebSocket 消息
 */
export interface BinanceWsMiniTickerMsg {
  e: '24hrMiniTicker';
  E: number;
  s: string;
  c: string;       // 最新价
  o: string;       // 24h 开盘价
  h: string;       // 24h 最高价
  l: string;       // 24h 最低价
  v: string;       // 成交量
  q: string;       // 成交额
}

// ============================================================================
// 服务配置类型
// ============================================================================

/**
 * K 线时间周期
 */
export type BinanceInterval = 
  | '1s' | '1m' | '3m' | '5m' | '15m' | '30m' 
  | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' 
  | '1d' | '3d' | '1w' | '1M';

/**
 * 市场类型
 */
export type MarketType = 'spot' | 'futures';

/**
 * API 配置
 */
export interface BinanceConfig {
  /** 市场类型 */
  market: MarketType;
  /** 交易对 */
  symbol: string;
  /** K 线周期 */
  interval: BinanceInterval;
}

/**
 * 连接状态
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

