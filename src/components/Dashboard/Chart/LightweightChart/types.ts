/**
 * Lightweight Charts 多窗格图表类型定义
 */

import type { IChartApi, ISeriesApi } from 'lightweight-charts';

/** 窗格类型 */
export type PaneType = 'price' | 'volume' | 'macd' | 'rsi';

/** 窗格配置 */
export interface PaneConfig {
  type: PaneType;
  height: number;
  minHeight?: number;
  visible: boolean;
}

/** 图表实例信息 */
export interface ChartInstance {
  chart: IChartApi;
  type: PaneType;
  series: Map<string, ISeriesApi<'Candlestick' | 'Line' | 'Histogram'>>;
}

