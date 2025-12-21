/**
 * 图表配置主入口
 * 组装所有子模块，导出完整的 ECharts 配置
 */

import type { EChartsOption, SeriesOption } from 'echarts';
import type { IndicatorData } from '../../../../types/index';

// 导入子模块
import {
  CHART_COLORS,
  DEFAULT_VISIBLE_CANDLES,
  extractChartData,
  calculatePriceRange,
  calculateDataZoomStart,
} from './constants';
import type { ChartData } from './constants';

import { buildDynamicGridLayout, buildXAxes, buildYAxes } from './layout';

import {
  createCandlestickSeries,
  createMASeries,
  createEMASeries,
  createBOLLSeries,
  createMACDSeries,
  createRSISeries,
  createVolumeSeries,
} from './series';
import type { PriceLineConfig } from './series';
export type { PriceLineConfig };

import { getTooltipConfig, buildSubChartTitles } from './tooltip';

// 重新导出常用的工具函数和类型
export {
  CHART_COLORS,
  DEFAULT_VISIBLE_CANDLES,
  extractChartData,
  calculatePriceRange,
  calculateDataZoomStart,
};
export type { ChartData };

// 导出布局相关类型 (供外部高级定制使用)
export type { LayoutOptions, LayoutResult } from './layout';
export { getLayoutConfig } from './layout';

/**
 * 创建空的指标数据对象 (用于空值保护)
 * 严格对齐 IndicatorData 接口
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
 * 图表配置选项
 */
export interface ChartOptionConfig {
  /** 是否为移动端 (默认 true，启用xx风格布局) */
  isMobile?: boolean;
  /** 成交量叠加到主图 (节省空间，暂未实现) */
  volumeOverlay?: boolean;
  /** 当前价格 (用于现价线) */
  currentPrice?: number;
  /** 当日开盘价 (用于判断涨跌颜色) */
  openPrice?: number;
}

/**
 * 生成完整的 ECharts 配置对象
 * @param chartData - 提取后的基础图表数据 (K 线 + 成交量)
 * @param indicatorData - Rust 计算的指标数据历史 (可为 null/undefined)
 * @param priceRange - 价格范围
 * @param dataZoomStart - dataZoom 起始位置
 * @param activeMainIndicators - 激活的主图指标列表 (如 ['MA', 'BOLL'])
 * @param activeSubIndicators - 激活的副图指标 (如 'MACD', 'RSI', 'VOL', 或空字符串)
 * @param config - 图表配置选项 (可选，包含 isMobile 等)
 */
export function getChartOption(
  chartData: ChartData,
  indicatorData: IndicatorData | undefined | null,
  priceRange: { min: number; max: number },
  dataZoomStart: number,
  activeMainIndicators: string[],
  activeSubIndicators: string[],
  config: ChartOptionConfig = {},
): EChartsOption {
  // 默认启用移动端布局 (主图优先策略)
  const { isMobile = true, volumeOverlay = false } = config;

  // 空值保护：如果 indicatorData 未提供，使用空数据
  const safeIndicatorData = indicatorData ?? createEmptyIndicatorData();

  const subCount = activeSubIndicators.length;
  const hasSubIndicator = subCount > 0;

  // Grid 布局：Main-Chart-First 策略 (xx风格)
  const { grids } = buildDynamicGridLayout({
    isMobile,
    subCount,
    volumeOverlay,
  });

  // 分隔线已移除（间距为 0，不需要分隔线）

  // 生成轴配置 (移动端使用 inside 标签)
  const xAxes = buildXAxes(chartData, subCount, { isMobile });
  const yAxes = buildYAxes(priceRange, subCount, {
    isMobile,
    activeSubIndicators,
  });

  // DataZoom 需要绑定所有 X 轴
  const xAxisIndices = hasSubIndicator
    ? Array.from({ length: 1 + subCount }, (_, i) => i)
    : [0];

  // 现价线配置
  const { currentPrice, openPrice } = config;
  const priceLineConfig: PriceLineConfig | undefined =
    currentPrice !== undefined && openPrice !== undefined
      ? { currentPrice, openPrice }
      : undefined;

  // 构建系列数据
  const series: SeriesOption[] = [
    // K 线蜡烛图 (始终存在) + 现价线
    createCandlestickSeries(chartData.klineData, priceLineConfig),
  ];

  // 添加主图指标
  if (activeMainIndicators.includes('MA')) {
    series.push(...createMASeries(safeIndicatorData));
  }
  if (activeMainIndicators.includes('EMA')) {
    series.push(...createEMASeries(safeIndicatorData));
  }
  if (activeMainIndicators.includes('BOLL')) {
    series.push(...createBOLLSeries(safeIndicatorData));
  }

  // 添加副图指标
  if (hasSubIndicator) {
    activeSubIndicators.forEach((sub, idx) => {
      const subGridIndex = idx + 1;
      switch (sub) {
        case 'MACD':
          series.push(...createMACDSeries(safeIndicatorData, subGridIndex));
          break;
        case 'RSI':
          series.push(...createRSISeries(safeIndicatorData, subGridIndex));
          break;
        case 'VOL':
          series.push(...createVolumeSeries(chartData, subGridIndex));
          break;
      }
    });
  }

  return {
    animation: false,
    animationDuration: 0,
    animationDurationUpdate: 0,
    backgroundColor: CHART_COLORS.BACKGROUND,

    tooltip: getTooltipConfig(),

    // 全局 axisPointer 配置：负责多 Grid 间的垂直线联动，不干扰各自的 Y 轴水平线
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      triggerOn: 'mousemove|click',
      snap: true,
      lineStyle: {
        color: CHART_COLORS.CROSSHAIR,
        type: 'dashed',
        width: 1,
      },
      // 不设置全局 label，避免覆盖各轴的独立配置
    },

    // legend 已移除，改用头部实时数据显示

    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,

    // 副图标题 (实时数据显示)
    title: buildSubChartTitles(
      chartData,
      safeIndicatorData,
      activeSubIndicators,
      grids,
      isMobile,
    ),

    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: xAxisIndices,
        start: dataZoomStart,
        end: 100,
        minValueSpan: 10,
        zoomOnMouseWheel: true,
        moveOnMouseMove: false,
        moveOnMouseWheel: false,
      },
    ],

    series,
  };
}

/**
 * @deprecated 请使用 getChartOption 替代
 * 已弃用，仅保留签名以防止编译错误
 */
export function createChartOption(
  chartData: ChartData,
  priceRange: { min: number; max: number },
  dataZoomStart: number,
): EChartsOption {
  // 使用空的 indicatorData
  return getChartOption(
    chartData,
    createEmptyIndicatorData(),
    priceRange,
    dataZoomStart,
    ['MA'],
    ['VOL'],
  );
}
