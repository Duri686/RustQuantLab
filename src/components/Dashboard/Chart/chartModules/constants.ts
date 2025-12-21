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
  // MACD 柱状图进阶颜色（趋势强弱区分）
  MACD_HIST_UP_STRONG: '#0ECB81', // 上涨动能增强 - 深绿
  MACD_HIST_UP_WEAK: 'rgba(14, 203, 129, 0.5)', // 上涨动能减弱 - 浅绿
  MACD_HIST_DOWN_STRONG: '#F6465D', // 下跌动能增强 - 深红
  MACD_HIST_DOWN_WEAK: 'rgba(246, 70, 93, 0.5)', // 下跌动能减弱 - 浅红

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
  /** 网格线颜色 (币安风格 - 弱化不干扰 K 线) */
  GRID_LINE: 'rgba(255, 255, 255, 0.04)',
  /** 轴标签颜色 */
  AXIS_LABEL: '#888',
  /** 轴线颜色 */
  AXIS_LINE: '#333',
  /** 十字准星颜色 */
  CROSSHAIR: 'rgba(136, 136, 136, 0.8)',
  /** 十字准星标签背景色 */
  CROSSHAIR_LABEL_BG: '#363a45',
  /** 十字准星标签文字色 */
  CROSSHAIR_LABEL_TEXT: '#d1d4dc',
  /** 现价线颜色 (上涨时) */
  PRICE_LINE_UP: '#0ECB81',
  /** 现价线颜色 (下跌时) */
  PRICE_LINE_DOWN: '#F6465D',
  /** 现价标签背景色 (上涨时) */
  PRICE_LABEL_BG_UP: '#0ECB81',
  /** 现价标签背景色 (下跌时) */
  PRICE_LABEL_BG_DOWN: '#F6465D',
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
 * @param extraPrices - 额外的价格数据（如 BOLL 上下轨）
 */
export function calculatePriceRange(
  candles: Candle[],
  extraPrices?: (number | null)[],
): {
  min: number;
  max: number;
} {
  if (candles.length === 0) return { min: 0, max: 100 };

  // 收集所有 K 线价格
  const allPrices = candles.flatMap((c) => [c.high, c.low]);

  // 添加额外价格数据（如 BOLL 上下轨）
  if (extraPrices) {
    extraPrices.forEach((p) => {
      if (p !== null && p !== undefined && !isNaN(p)) {
        allPrices.push(p);
      }
    });
  }

  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  // 增加 padding 到 12%，确保价格线和 BOLL 等有充足“呼吸空间”
  const padding = (max - min) * 0.12 || 1;
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
