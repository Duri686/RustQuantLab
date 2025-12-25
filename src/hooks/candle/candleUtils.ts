/**
 * K 线数据工具模块
 * 包含常量、类型定义、工具函数
 *
 * @module hooks/candle/candleUtils
 */

import type { Candle, IndicatorData } from '../../types/index';
import type {
  WasmCandle,
  WasmAnalysisResult,
  WasmTimeframe,
} from '../../types/wasm';

// ============================================
// 常量
// ============================================

/** K 线历史最大长度 */
export const MAX_CANDLE_HISTORY = 120;

/** K 线周期（毫秒） */
export const CANDLE_INTERVAL_MS = 1000;

// ============================================
// 类型定义
// ============================================

/**
 * 待处理 K 线（正在聚合中）
 */
export interface PendingCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tickCount: number;
}

/**
 * 待处理的指标数据（当前 K 线周期内累积）
 * 严格对齐 WasmAnalysisResult 字段
 */
export interface PendingIndicators {
  /** SMA(5) */
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

/** 指标字段名称列表 (用于迭代) */
export const INDICATOR_KEYS: (keyof PendingIndicators)[] = [
  'sma5',
  'ma7',
  'ma25',
  'ma99',
  'ema7',
  'ema25',
  'rsi14',
  'bollUpper',
  'bollMid',
  'bollLower',
  'macdDif',
  'macdDea',
  'macdHist',
  'volMa5',
];

// ============================================
// 工厂函数
// ============================================

/**
 * 创建空的指标数据对象
 */
export function createEmptyIndicatorData(): IndicatorData {
  return {
    sma5: [],
    ma7: [],
    ma25: [],
    ma99: [],
    ema7: [],
    ema25: [],
    rsi14: [],
    bollUpper: [],
    bollMid: [],
    bollLower: [],
    macdDif: [],
    macdDea: [],
    macdHist: [],
    volMa5: [],
  };
}

/**
 * 创建空的待处理指标对象
 */
export function createEmptyPendingIndicators(): PendingIndicators {
  return {
    sma5: null,
    ma7: null,
    ma25: null,
    ma99: null,
    ema7: null,
    ema25: null,
    rsi14: null,
    bollUpper: null,
    bollMid: null,
    bollLower: null,
    macdDif: null,
    macdDea: null,
    macdHist: null,
    volMa5: null,
  };
}

// ============================================
// 转换函数
// ============================================

/**
 * 根据时间周期格式化时间显示
 * - 1D: 显示日期 (MM/DD)
 * - 1H/4H: 显示日期+时间 (MM/DD HH:mm)
 * - 其他: 显示时间 (HH:mm:ss)
 */
export function formatCandleTime(
  timestamp: number,
  timeframe?: WasmTimeframe,
): string {
  const date = new Date(timestamp);

  switch (timeframe) {
    case '1D':
      // 日线显示日期: MM/DD
      return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date
        .getDate()
        .toString()
        .padStart(2, '0')}`;
    case '4H':
    case '1H':
      // 小时线显示日期+时间: MM/DD HH:mm
      return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date
        .getDate()
        .toString()
        .padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
    default:
      // 分钟/秒线显示时间: HH:mm:ss
      return date.toLocaleTimeString();
  }
}

/**
 * 将 WasmCandle 转换为前端 Candle 类型
 * @param wc - Wasm K 线数据
 * @param timeframe - 时间周期（用于格式化时间显示）
 */
export function convertWasmCandle(
  wc: WasmCandle,
  timeframe?: WasmTimeframe,
): Candle {
  return {
    time: wc.time,
    timeStr: formatCandleTime(wc.time, timeframe),
    open: wc.open,
    high: wc.high,
    low: wc.low,
    close: wc.close,
    volume: wc.volume,
    // Rust K 线不包含指标数据，由 analysisResult 单独提供
    sma5: null,
    ma7: null,
    ma25: null,
    ma99: null,
  };
}

/**
 * 从 WasmAnalysisResult 提取指标值到 PendingIndicators
 */
export function extractIndicatorsFromAnalysis(
  result: WasmAnalysisResult,
): PendingIndicators {
  return {
    sma5: result.sma5 ?? null,
    ma7: result.ma7 ?? null,
    ma25: result.ma25 ?? null,
    ma99: result.ma99 ?? null,
    ema7: result.ema7 ?? null,
    ema25: result.ema25 ?? null,
    rsi14: result.rsi14 ?? null,
    // 提取嵌套布林带结构
    bollUpper: result.boll?.upper ?? null,
    bollMid: result.boll?.mid ?? null,
    bollLower: result.boll?.lower ?? null,
    // 提取嵌套 MACD 结构
    macdDif: result.macd?.dif ?? null,
    macdDea: result.macd?.dea ?? null,
    macdHist: result.macd?.hist ?? null,
    volMa5: result.volMa5 ?? null,
  };
}

// ============================================
// 数组操作工具
// ============================================

/**
 * 向数组末尾追加值并限制长度
 * @param arr - 原数组
 * @param value - 新值
 * @param maxLength - 最大长度，默认 MAX_CANDLE_HISTORY
 */
export function pushAndLimit<T>(
  arr: T[],
  value: T,
  maxLength: number = MAX_CANDLE_HISTORY,
): T[] {
  const newArr = [...arr, value];
  if (newArr.length > maxLength) {
    return newArr.slice(-maxLength);
  }
  return newArr;
}

/**
 * 基于 PendingIndicators 更新 IndicatorData 历史
 * @param prev - 之前的指标历史
 * @param indicators - 当前周期的指标值
 */
export function appendIndicatorHistory(
  prev: IndicatorData,
  indicators: PendingIndicators,
): IndicatorData {
  return {
    sma5: pushAndLimit(prev.sma5, indicators.sma5),
    ma7: pushAndLimit(prev.ma7, indicators.ma7),
    ma25: pushAndLimit(prev.ma25, indicators.ma25),
    ma99: pushAndLimit(prev.ma99, indicators.ma99),
    ema7: pushAndLimit(prev.ema7, indicators.ema7),
    ema25: pushAndLimit(prev.ema25, indicators.ema25),
    rsi14: pushAndLimit(prev.rsi14, indicators.rsi14),
    bollUpper: pushAndLimit(prev.bollUpper, indicators.bollUpper),
    bollMid: pushAndLimit(prev.bollMid, indicators.bollMid),
    bollLower: pushAndLimit(prev.bollLower, indicators.bollLower),
    macdDif: pushAndLimit(prev.macdDif, indicators.macdDif),
    macdDea: pushAndLimit(prev.macdDea, indicators.macdDea),
    macdHist: pushAndLimit(prev.macdHist, indicators.macdHist),
    volMa5: pushAndLimit(prev.volMa5, indicators.volMa5),
  };
}

/**
 * 构建实时 K 线对象 (用于图表显示未完成的 K 线)
 */
export function buildLiveCandle(
  pending: PendingCandle,
  indicators: PendingIndicators,
): Candle {
  return {
    time: pending.time,
    timeStr: new Date(pending.time).toLocaleTimeString(),
    open: pending.open,
    high: pending.high,
    low: pending.low,
    close: pending.close,
    volume: pending.volume,
    sma5: indicators.sma5,
    ma7: indicators.ma7,
    ma25: indicators.ma25,
    ma99: indicators.ma99,
  };
}
