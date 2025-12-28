/**
 * @fileoverview Rust Wasm 引擎类型定义
 *
 * 本文件定义了与 Rust `quant_core` Wasm 模块交互的所有 TypeScript 类型。
 * 类型命名遵循 Serde `camelCase` 转换规则，与 Rust 端保持同步。
 *
 * @see core/src/models.rs - Rust 数据结构定义
 * @module types/wasm
 */

/* ============================================================================
   时间周期类型
   ============================================================================ */

/**
 * 支持的 K 线时间周期
 *
 * 与 Rust `Timeframe` 枚举对应
 */
export type WasmTimeframe = '1s' | '1m' | '5m' | '15m' | '1H' | '4H' | '1D';

/**
 * 时间周期常量数组
 */
export const TIMEFRAMES: readonly WasmTimeframe[] = [
  '1s',
  '1m',
  '5m',
  '15m',
  '1H',
  '4H',
  '1D',
] as const;

/* ============================================================================
   输入类型 (发送到 Wasm)
   ============================================================================ */

/**
 * 订单簿数据结构
 *
 * 从交易所 WebSocket 推送的实时行情数据，传递给 Wasm `on_tick` 方法。
 *
 * @example
 * ```typescript
 * const orderBook: WasmOrderBook = {
 *   symbol: 'BTC-USDT',
 *   timestamp: Date.now(),
 *   price: 42000.50,
 *   bids: [[41999.0, 1.5], [41998.0, 2.0]],
 *   asks: [[42001.0, 1.2], [42002.0, 0.8]],
 * };
 * ```
 */
export interface WasmOrderBook {
  /** 交易对符号 (如 "BTC-USDT") */
  symbol: string;

  /** 数据时间戳 (毫秒) */
  timestamp: number;

  /** 当前中间价 */
  price: number;

  /**
   * 买单列表 (按价格降序)
   * 格式: [价格, 数量][]
   */
  bids: [number, number][];

  /**
   * 卖单列表 (按价格升序)
   * 格式: [价格, 数量][]
   */
  asks: [number, number][];

  /**
   * 成交量（可选）
   * 来自 Binance K 线数据的累计成交量
   */
  volume?: number;
}

/* ============================================================================
   K 线数据类型
   ============================================================================ */

/**
 * 单根 K 线数据 (OHLCV)
 *
 * 由 Rust `Candle` 结构体序列化而来
 */
export interface WasmCandle {
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

  /** 该周期内 tick 数量 */
  tickCount: number;
}

/**
 * 指标历史数据 (与 K 线数组长度对齐)
 *
 * 由 Rust 基于该周期 K 线收盘价计算
 */
export interface WasmIndicatorHistory {
  /** MA(7) 历史 */
  ma7: (number | null)[];
  /** MA(25) 历史 */
  ma25: (number | null)[];
  /** MA(99) 历史 */
  ma99: (number | null)[];
  /** EMA(7) 历史 */
  ema7: (number | null)[];
  /** EMA(25) 历史 */
  ema25: (number | null)[];
  /** BOLL 上轨历史 */
  bollUpper: (number | null)[];
  /** BOLL 中轨历史 */
  bollMid: (number | null)[];
  /** BOLL 下轨历史 */
  bollLower: (number | null)[];
  /** MACD DIF 历史 */
  macdDif: (number | null)[];
  /** MACD DEA 历史 */
  macdDea: (number | null)[];
  /** MACD Hist 历史 */
  macdHist: (number | null)[];
  /** RSI(14) 历史 */
  rsi14: (number | null)[];
}

/**
 * K 线历史数据
 *
 * 由 `MarketEngine.get_candles()` 或 `get_active_candles()` 返回
 */
export interface WasmCandleHistory {
  /** 当前时间周期 */
  timeframe: WasmTimeframe;

  /** 已完成的 K 线数组 */
  candles: WasmCandle[];

  /** 当前正在形成的 K 线 (实时) */
  currentCandle: WasmCandle | null;

  /** 基于该周期 K 线收盘价计算的指标历史 */
  indicators: WasmIndicatorHistory;
}

/* ============================================================================
   输出类型 (从 Wasm 返回)
   ============================================================================ */

/**
 * 布林带 (Bollinger Bands) 计算结果
 *
 * 布林带由三条线组成:
 * - 上轨 (Upper): 中轨 + k × 标准差
 * - 中轨 (Mid): N 周期简单移动平均线
 * - 下轨 (Lower): 中轨 - k × 标准差
 *
 * 默认参数: 20 周期, 2 倍标准差
 */
export interface WasmBollResult {
  /** 上轨值 */
  upper: number;

  /** 中轨值 (MA) */
  mid: number;

  /** 下轨值 */
  lower: number;
}

/**
 * MACD (Moving Average Convergence Divergence) 计算结果
 *
 * MACD 指标由三部分组成:
 * - DIF (差离值): 快线 EMA - 慢线 EMA
 * - DEA (信号线): DIF 的 EMA
 * - Histogram (柱状图): (DIF - DEA) × 2
 *
 * 默认参数: EMA(12), EMA(26), Signal(9)
 */
export interface WasmMacdResult {
  /** DIF 值 (快线 - 慢线) */
  dif: number;

  /** DEA 值 (DIF 的 EMA) */
  dea: number;

  /** 柱状图值 ((DIF - DEA) × 2) */
  hist: number;
}

/**
 * Wasm MarketEngine 分析结果
 *
 * 由 `MarketEngine.on_tick()` 方法返回的完整技术分析结果。
 * 所有 `Option<f64>` 类型在 JS 中表现为 `number | null`。
 *
 * @remarks
 * 字段命名遵循 Serde `rename_all = "camelCase"` 规则:
 * - Rust `sma_5` → JS `sma5`
 * - Rust `vol_ma_5` → JS `volMa5`
 * - Rust `history_length` → JS `historyLength`
 */
export interface WasmAnalysisResult {
  // ========== 基础信息 ==========

  /**
   * 买卖价差 (Best Ask - Best Bid)
   * @unit 价格单位
   */
  spread: number;

  /**
   * 当前价格历史长度
   * 用于判断指标是否有足够数据计算
   */
  historyLength: number;

  // ========== 简单移动平均线 (SMA) ==========

  /**
   * SMA(5) - 5 周期简单移动平均
   * @returns 计算值或 null (数据不足时)
   */
  sma5: number | null;

  /**
   * MA(7) - 7 周期移动平均 (短期趋势)
   * @returns 计算值或 null
   */
  ma7: number | null;

  /**
   * MA(25) - 25 周期移动平均 (中期趋势)
   * @returns 计算值或 null
   */
  ma25: number | null;

  /**
   * MA(99) - 99 周期移动平均 (长期趋势)
   * @returns 计算值或 null
   */
  ma99: number | null;

  // ========== 指数移动平均线 (EMA) ==========

  /**
   * EMA(7) - 7 周期指数移动平均
   * 相比 SMA 对近期价格更敏感
   * @returns 计算值或 null
   */
  ema7: number | null;

  /**
   * EMA(25) - 25 周期指数移动平均
   * @returns 计算值或 null
   */
  ema25: number | null;

  // ========== 技术指标 ==========

  /**
   * 布林带 (Bollinger Bands)
   * 参数: 20 周期, 2 倍标准差
   * @returns BollResult 或 null (数据不足时)
   */
  boll: WasmBollResult | null;

  /**
   * MACD 指标
   * 参数: 快线 12, 慢线 26, 信号线 9
   * @returns MacdResult 或 null (数据不足时)
   */
  macd: WasmMacdResult | null;

  /**
   * RSI(14) - 14 周期相对强弱指数
   * 范围: 0-100
   * - > 70: 超买区域
   * - < 30: 超卖区域
   * @returns RSI 值或 null
   */
  rsi14: number | null;

  // ========== 成交量指标 ==========

  /**
   * 成交量 MA(5) - 5 周期成交量均线
   * @returns 计算值或 null
   */
  volMa5: number | null;
}

/* ============================================================================
   Wasm 模块接口
   ============================================================================ */

/**
 * MarketEngine Wasm 实例接口
 *
 * 定义了 Rust `MarketEngine` 结构体暴露给 JavaScript 的所有方法。
 *
 * @example
 * ```typescript
 * import init, { MarketEngine } from '@/wasm/quant_core';
 *
 * await init();
 * const engine = new MarketEngine();
 *
 * const result = engine.on_tick(orderBookData);
 * console.log(result.ma7, result.rsi14);
 *
 * engine.clear_history();
 * engine.free(); // 释放 Wasm 内存
 * ```
 */
export interface WasmMarketEngine {
  /**
   * 处理单次 Tick 数据更新
   *
   * 接收订单簿数据，更新内部历史，计算所有技术指标。
   * 同时更新所有时间周期的 K 线数据。
   *
   * @param data - 订单簿数据
   * @returns 包含所有指标的分析结果
   * @throws 解析失败时抛出错误
   */
  on_tick(data: WasmOrderBook): WasmAnalysisResult;

  /**
   * 获取当前价格历史长度
   * @returns 历史数据点数量
   */
  history_length(): number;

  /**
   * 清空所有历史数据
   * 用于重置引擎状态
   */
  clear_history(): void;

  // ========== K 线相关方法 ==========

  /**
   * 设置当前激活的时间周期
   *
   * @param timeframe - 时间周期字符串 ('1s', '1m', '5m', '15m', '1H', '4H', '1D')
   * @returns 是否设置成功
   */
  set_timeframe(timeframe: WasmTimeframe): boolean;

  /**
   * 获取当前激活的时间周期
   * @returns 时间周期字符串
   */
  get_timeframe(): WasmTimeframe;

  /**
   * 获取指定时间周期的 K 线历史
   *
   * @param timeframe - 时间周期字符串
   * @returns K 线历史数据
   * @throws 无效时间周期时抛出错误
   */
  get_candles(timeframe: WasmTimeframe): WasmCandleHistory;

  /**
   * 获取当前激活时间周期的 K 线历史
   * @returns K 线历史数据
   */
  get_active_candles(): WasmCandleHistory;

  /**
   * 获取指定时间周期的 K 线数量
   *
   * @param timeframe - 时间周期字符串
   * @returns K 线数量
   */
  get_candle_count(timeframe: WasmTimeframe): number;

  // ========== 模拟交易方法 ==========

  /**
   * 提交模拟订单
   *
   * 处理买入/卖出订单，模拟市场影响：
   * - 买单：价格上涨 + 成交量增加
   * - 卖单：价格下跌 + 成交量增加
   *
   * @param order - 模拟订单数据
   * @returns 订单执行结果
   * @throws 解析失败时抛出错误
   */
  submit_order(order: WasmSimOrder): WasmSimOrderResult;

  /**
   * 释放 Wasm 内存
   * 在不再使用引擎时调用，防止内存泄漏
   */
  free(): void;
}

/**
 * MarketEngine 构造函数类型
 */
export interface WasmMarketEngineConstructor {
  new (): WasmMarketEngine;
}

/**
 * Wasm 模块导出类型
 *
 * 定义了 `wasm-pack` 生成的 ES 模块的完整导出。
 */
export interface WasmModule {
  /** MarketEngine 类 */
  MarketEngine: WasmMarketEngineConstructor;
}

/* ============================================================================
   类型别名 (向后兼容)
   ============================================================================ */

/**
 * @deprecated 请使用 WasmOrderBook
 */
export type OrderBookInput = WasmOrderBook;

/**
 * @deprecated 请使用 WasmAnalysisResult
 */
export type AnalysisResultOutput = WasmAnalysisResult;

/**
 * @deprecated 请使用 WasmBollResult
 */
export type BollResultOutput = WasmBollResult;

/**
 * @deprecated 请使用 WasmMacdResult
 */
export type MacdResultOutput = WasmMacdResult;

/* ============================================================================
   模拟订单类型
   ============================================================================ */

/**
 * 模拟订单输入
 *
 * 传递给 `MarketEngine.submit_order()` 方法
 */
export interface WasmSimOrder {
  /** 订单方向: 'Buy' 或 'Sell' */
  side: 'Buy' | 'Sell';

  /** 委托价格 (USDT) */
  price: number;

  /** 委托数量 (BTC) */
  size: number;

  /** 杠杆倍数 */
  leverage: number;
}

/**
 * 模拟订单执行结果
 *
 * 由 `MarketEngine.submit_order()` 方法返回
 */
export interface WasmSimOrderResult {
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
