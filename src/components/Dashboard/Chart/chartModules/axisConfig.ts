/**
 * 图表坐标轴配置生成器
 * 负责 X 轴和 Y 轴的配置生成
 *
 * @module chartModules/axisConfig
 */

import { CHART_COLORS, type ChartData } from './constants';
import { MOBILE_LAYOUT, DESKTOP_LAYOUT } from './layoutConstants';
import { getPriceFormatter, formatSubChartValue } from './formatters';

// ============================================
// 类型定义
// ============================================

export interface XAxisOptions {
  /** 是否为移动端 */
  isMobile?: boolean;
}

export interface YAxisOptions {
  /** 是否为移动端 */
  isMobile?: boolean;
}

// ============================================
// X 轴配置生成
// ============================================

/**
 * 生成 X 轴配置数组
 * 币安风格：只在最底部的图表显示 X 轴标签
 *
 * @param chartData - 图表数据
 * @param subCount - 副图数量
 * @param options - X 轴配置选项
 */
export function buildXAxes(
  chartData: ChartData,
  subCount: number,
  options: XAxisOptions = {},
): object[] {
  const { isMobile = true } = options;
  const hasSubIndicator = subCount > 0;
  const axes: object[] = [];

  // X 轴标签样式
  const xAxisLabelStyle = {
    color: CHART_COLORS.AXIS_LABEL,
    fontSize: isMobile ? 9 : 10,
    interval: 'auto' as const,
    ...(isMobile && { rotate: 0, hideOverlap: true }),
  };

  // 主图 X 轴 (只有无副图时才显示标签)
  axes.push({
    type: 'category' as const,
    data: chartData.times,
    gridIndex: 0,
    axisLine: {
      show: !hasSubIndicator,
      lineStyle: { color: CHART_COLORS.AXIS_LINE },
    },
    axisLabel: hasSubIndicator ? { show: false } : xAxisLabelStyle,
    axisTick: {
      show: !hasSubIndicator,
      lineStyle: { color: CHART_COLORS.AXIS_LINE },
    },
    splitLine: { show: false },
  });

  // 副图 X 轴：只在最后一个副图显示标签
  for (let i = 0; i < subCount; i++) {
    const isLastSub = i === subCount - 1;
    axes.push({
      type: 'category' as const,
      data: chartData.times,
      gridIndex: i + 1,
      axisLine: {
        show: isLastSub,
        lineStyle: { color: CHART_COLORS.AXIS_LINE },
      },
      axisLabel: isLastSub ? xAxisLabelStyle : { show: false },
      axisTick: {
        show: isLastSub,
        lineStyle: { color: CHART_COLORS.AXIS_LINE },
      },
      splitLine: { show: false },
    });
  }

  return axes;
}

// ============================================
// Y 轴配置生成
// ============================================

/**
 * 生成主图 Y 轴配置
 */
function buildMainYAxis(
  priceRange: { min: number; max: number },
  isMobile: boolean,
): object {
  const config = isMobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT;
  const formatter = getPriceFormatter(isMobile);

  return {
    type: 'value' as const,
    scale: true,
    min: priceRange.min,
    max: priceRange.max,
    gridIndex: 0,
    position: 'right' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: CHART_COLORS.AXIS_LABEL,
      fontSize: config.Y_AXIS_FONT_SIZE,
      inside: config.Y_AXIS_LABEL_INSIDE,
      verticalAlign: config.Y_AXIS_LABEL_INSIDE ? 'bottom' : 'middle',
      margin: config.Y_AXIS_LABEL_INSIDE ? 2 : 8,
      showMinLabel: true,
      showMaxLabel: true,
      formatter,
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: CHART_COLORS.GRID_LINE,
        type: 'solid',
        width: 1,
      },
    },
    splitArea: {
      show: !isMobile,
      areaStyle: {
        color: ['rgba(255, 255, 255, 0.02)', 'transparent'],
      },
    },
  };
}

/**
 * 生成副图 Y 轴配置
 */
function buildSubYAxis(gridIndex: number, isMobile: boolean): object {
  const config = isMobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT;

  return {
    type: 'value' as const,
    scale: true,
    gridIndex,
    position: 'right' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    splitNumber: isMobile ? 2 : 3,
    axisLabel: {
      color: CHART_COLORS.AXIS_LABEL,
      fontSize: isMobile ? 8 : 9,
      inside: config.Y_AXIS_LABEL_INSIDE,
      verticalAlign: config.Y_AXIS_LABEL_INSIDE ? 'bottom' : 'middle',
      margin: config.Y_AXIS_LABEL_INSIDE ? 1 : 4,
      showMinLabel: true,
      showMaxLabel: true,
      formatter: formatSubChartValue,
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: CHART_COLORS.GRID_LINE,
        opacity: 0.5,
      },
    },
  };
}

/**
 * 生成 Y 轴配置数组
 * 币安风格：移动端使用内置标签节省水平空间
 *
 * @param priceRange - 价格范围
 * @param subCount - 副图数量
 * @param options - Y 轴配置选项
 */
export function buildYAxes(
  priceRange: { min: number; max: number },
  subCount: number,
  options: YAxisOptions = {},
): object[] {
  const { isMobile = true } = options;
  const axes: object[] = [];

  // 主图 Y 轴
  axes.push(buildMainYAxis(priceRange, isMobile));

  // 副图 Y 轴
  for (let i = 0; i < subCount; i++) {
    axes.push(buildSubYAxis(i + 1, isMobile));
  }

  return axes;
}
