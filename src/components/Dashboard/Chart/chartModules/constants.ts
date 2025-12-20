/**
 * K 线图表常量配置
 * 包含颜色、样式、默认值等静态配置
 */

import type { Candle } from '../../../../types/index';

/**
 * K 线图表颜色配置 (TradingView/Binance 风格)
 */
export const CHART_COLORS = {
  /** 上涨颜色 - Neon Green */
  UP: '#0ECB81',
  /** 下跌颜色 - Neon Red */
  DOWN: '#F6465D',

  // MA 颜色
  MA7: '#F6C343',
  MA25: '#A371F7',
  MA99: '#61C3EA',

  // EMA 颜色
  EMA7: '#FF9F43',
  EMA25: '#54A0FF',

  // BOLL 颜色
  BOLL_UPPER: '#FF6B6B',
  BOLL_MID: '#FFA502',
  BOLL_LOWER: '#2ED573',
  BOLL_BAND: 'rgba(255, 165, 2, 0.08)',

  // MACD 颜色
  MACD_DIF: '#F6C343',
  MACD_DEA: '#61C3EA',
  MACD_HIST_UP: '#0ECB81',
  MACD_HIST_DOWN: '#F6465D',

  // RSI 颜色
  RSI: '#A371F7',
  RSI_OVERBOUGHT: 'rgba(246, 70, 93, 0.5)',
  RSI_OVERSOLD: 'rgba(14, 203, 129, 0.5)',
  RSI_NEUTRAL_ZONE: 'rgba(255, 255, 255, 0.03)',

  // 分隔线颜色
  DIVIDER: 'rgba(255, 255, 255, 0.1)',

  // VOL 颜色 (使用 UP/DOWN)

  /** 背景色 */
  BACKGROUND: 'transparent',
  /** 网格线颜色 */
  GRID_LINE: 'rgba(255, 255, 255, 0.06)',
  /** 轴标签颜色 */
  AXIS_LABEL: '#888',
  /** 轴线颜色 */
  AXIS_LINE: '#333',
  /** 十字准星颜色 */
  CROSSHAIR: 'rgba(255, 255, 255, 0.3)',
} as const;

/** 默认显示的 K 线数量 */
export const DEFAULT_VISIBLE_CANDLES = 60;

/**
 * 指标名称与颜色的映射表
 */
export const INDICATOR_COLOR_MAP: Record<string, string> = {
  MA7: CHART_COLORS.MA7,
  MA25: CHART_COLORS.MA25,
  MA99: CHART_COLORS.MA99,
  EMA7: CHART_COLORS.EMA7,
  EMA25: CHART_COLORS.EMA25,
  'BOLL-Upper': CHART_COLORS.BOLL_UPPER,
  'BOLL-Mid': CHART_COLORS.BOLL_MID,
  'BOLL-Lower': CHART_COLORS.BOLL_LOWER,
  'MACD-DIF': CHART_COLORS.MACD_DIF,
  'MACD-DEA': CHART_COLORS.MACD_DEA,
  RSI: CHART_COLORS.RSI,
};

/**
 * 提取的图表数据结构
 * 均线字段已移至 IndicatorData，此处仅保留 K 线 OHLCV 和成交量
 */
export interface ChartData {
  times: string[];
  klineData: number[][];
  volumeData: Array<{
    value: number;
    itemStyle: { color: string; opacity: number };
  }>;
}

/**
 * 从 K 线数据中提取图表所需的 OHLCV 数据格式
 * 注意: 均线数据现在由 IndicatorData 单独提供
 * @param candles - K 线数据数组
 */
export function extractChartData(candles: Candle[]): ChartData {
  return {
    times: candles.map((c) => c.timeStr),
    // ECharts candlestick 数据格式: [open, close, low, high]
    klineData: candles.map((c) => [c.open, c.close, c.low, c.high]),
    volumeData: candles.map((c) => ({
      value: c.volume,
      itemStyle: {
        color: c.close >= c.open ? CHART_COLORS.UP : CHART_COLORS.DOWN,
        opacity: 0.7,
      },
    })),
  };
}

/**
 * 计算价格范围（自适应 Y 轴）
 * @param candles - K 线数据数组
 */
export function calculatePriceRange(candles: Candle[]): {
  min: number;
  max: number;
} {
  if (candles.length === 0) return { min: 0, max: 100 };
  const allPrices = candles.flatMap((c) => [c.high, c.low]);
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const padding = (max - min) * 0.05 || 1;
  return { min: min - padding, max: max + padding };
}

/**
 * 计算 dataZoom 的初始 start 值
 * @param totalCandles - 总 K 线数量
 */
export function calculateDataZoomStart(totalCandles: number): number {
  if (totalCandles <= DEFAULT_VISIBLE_CANDLES) return 0;
  return Math.max(0, 100 - (DEFAULT_VISIBLE_CANDLES / totalCandles) * 100);
}
