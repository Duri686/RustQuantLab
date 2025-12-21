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

import {
  buildDynamicGridLayout,
  buildDividerGraphics,
  buildXAxes,
  buildYAxes,
} from './layout';

import {
  createCandlestickSeries,
  createMASeries,
  createEMASeries,
  createBOLLSeries,
  createMACDSeries,
  createRSISeries,
  createVolumeSeries,
} from './series';

import { getTooltipConfig, buildLegendData, getLegendConfig } from './tooltip';

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
  const { grids, dividerPositions } = buildDynamicGridLayout({
    isMobile,
    subCount,
    volumeOverlay,
  });

  // 生成分隔线 graphic 元素
  const dividerGraphics = buildDividerGraphics(dividerPositions, { isMobile });

  // 生成轴配置 (移动端使用 inside 标签)
  const xAxes = buildXAxes(chartData, subCount, { isMobile });
  const yAxes = buildYAxes(priceRange, subCount, { isMobile });

  // DataZoom 需要绑定所有 X 轴
  const xAxisIndices = hasSubIndicator
    ? Array.from({ length: 1 + subCount }, (_, i) => i)
    : [0];

  // 构建系列数据
  const series: SeriesOption[] = [
    // K 线蜡烛图 (始终存在)
    createCandlestickSeries(chartData.klineData),
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

  // 构建图例
  const legendData = buildLegendData(activeMainIndicators, activeSubIndicators);

  return {
    animation: false,
    animationDuration: 0,
    animationDurationUpdate: 0,
    backgroundColor: CHART_COLORS.BACKGROUND,

    tooltip: getTooltipConfig(),

    legend: getLegendConfig(legendData, isMobile),

    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,

    // 分隔线图形元素
    graphic: dividerGraphics,

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
