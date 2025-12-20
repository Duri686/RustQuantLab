/**
 * MarketEngine 方法包装器
 * 提供类型安全的引擎调用接口，统一错误处理
 *
 * @module hooks/wasm/engineMethods
 */

import type {
  WasmOrderBook,
  WasmAnalysisResult,
  WasmMarketEngine,
  WasmCandleHistory,
  WasmTimeframe,
} from '../../types/wasm';

// ============================================
// 安全调用包装器
// ============================================

/**
 * 安全调用引擎方法，统一错误处理
 * @param engine - 引擎实例
 * @param isAlive - 引擎存活标记
 * @param methodName - 方法名 (用于日志)
 * @param fn - 执行函数
 * @param defaultValue - 错误时返回的默认值
 */
export function safeEngineCall<T>(
  engine: WasmMarketEngine | null,
  isAlive: boolean,
  methodName: string,
  fn: (e: WasmMarketEngine) => T,
  defaultValue: T,
): T {
  if (!isAlive || !engine) {
    console.warn(`[engineMethods] 引擎未就绪，跳过 ${methodName}`);
    return defaultValue;
  }

  try {
    return fn(engine);
  } catch (err) {
    console.error(`[engineMethods] ${methodName} 执行错误:`, err);
    return defaultValue;
  }
}

// ============================================
// 引擎方法封装
// ============================================

/**
 * 处理 Tick 数据
 */
export function processTick(
  engine: WasmMarketEngine | null,
  isAlive: boolean,
  orderBook: WasmOrderBook,
): WasmAnalysisResult | null {
  return safeEngineCall(
    engine,
    isAlive,
    'processTick',
    (e) => e.on_tick(orderBook) as WasmAnalysisResult,
    null,
  );
}

/**
 * 获取当前激活周期的 K 线数据
 */
export function getActiveCandles(
  engine: WasmMarketEngine | null,
  isAlive: boolean,
): WasmCandleHistory | null {
  return safeEngineCall(
    engine,
    isAlive,
    'getActiveCandles',
    (e) => e.get_active_candles() as WasmCandleHistory,
    null,
  );
}

/**
 * 获取指定周期的 K 线数据
 */
export function getCandles(
  engine: WasmMarketEngine | null,
  isAlive: boolean,
  timeframe: WasmTimeframe,
): WasmCandleHistory | null {
  return safeEngineCall(
    engine,
    isAlive,
    'getCandles',
    (e) => e.get_candles(timeframe) as WasmCandleHistory,
    null,
  );
}

/**
 * 获取指定周期的 K 线数量
 */
export function getCandleCount(
  engine: WasmMarketEngine | null,
  isAlive: boolean,
  timeframe: WasmTimeframe,
): number {
  return safeEngineCall(
    engine,
    isAlive,
    'getCandleCount',
    (e) => e.get_candle_count(timeframe),
    0,
  );
}

/**
 * 切换时间周期
 */
export function setTimeframe(
  engine: WasmMarketEngine | null,
  isAlive: boolean,
  timeframe: WasmTimeframe,
): boolean {
  return safeEngineCall(
    engine,
    isAlive,
    'setTimeframe',
    (e) => e.set_timeframe(timeframe),
    false,
  );
}

/**
 * 清空历史数据
 */
export function clearHistory(
  engine: WasmMarketEngine | null,
  isAlive: boolean,
): void {
  safeEngineCall(
    engine,
    isAlive,
    'clearHistory',
    (e) => e.clear_history(),
    undefined,
  );
}

/**
 * 获取历史长度
 */
export function getHistoryLength(
  engine: WasmMarketEngine | null,
  isAlive: boolean,
): number {
  return safeEngineCall(
    engine,
    isAlive,
    'getHistoryLength',
    (e) => e.history_length(),
    0,
  );
}
