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
  /** 激活的副图指标列表 (用于识别 RSI 等特殊 Y 轴需求) */
  activeSubIndicators?: string[];
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

  // === 统一的 splitLine 配置，确保网格线贯穿 ===
  const unifiedSplitLine = {
    show: true,
    lineStyle: {
      color: CHART_COLORS.GRID_LINE,
      type: 'dashed' as const,
      width: 1,
    },
  };

  // === 统一的 boundaryGap 配置，确保柱体对齐 ===
  // K线图和柱状图都使用 true，使数据点居中于刻度之间
  const unifiedBoundaryGap = true;

  // 主图 X 轴 (只有无副图时才显示标签)
  axes.push({
    type: 'category' as const,
    data: chartData.times,
    gridIndex: 0,
    boundaryGap: unifiedBoundaryGap,
    axisLine: {
      show: !hasSubIndicator,
      lineStyle: { color: CHART_COLORS.AXIS_LINE },
    },
    axisLabel: hasSubIndicator ? { show: false } : xAxisLabelStyle,
    axisTick: {
      show: !hasSubIndicator,
      lineStyle: { color: CHART_COLORS.AXIS_LINE },
    },
    // 主图 X 轴 axisPointer: 始终开启 axisPointer 并启用 snap
    axisPointer: {
      show: true,
      snap: true,
      label: hasSubIndicator
        ? { show: false }
        : {
            show: true,
            backgroundColor: 'rgba(30, 34, 45, 0.95)',
            color: '#f0f0f0',
            fontSize: isMobile ? 10 : 11,
            fontFamily: 'monospace',
            padding: [4, 8],
            borderRadius: 3,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
          },
    },
    // 垂直网格线 (统一配置，确保贯穿)
    splitLine: unifiedSplitLine,
  });

  // 副图 X 轴：只在最后一个副图显示标签和 axisPointer
  for (let i = 0; i < subCount; i++) {
    const isLastSub = i === subCount - 1;
    axes.push({
      type: 'category' as const,
      data: chartData.times,
      gridIndex: i + 1,
      boundaryGap: unifiedBoundaryGap, // 与主图严格一致
      axisLine: {
        show: isLastSub,
        lineStyle: { color: CHART_COLORS.AXIS_LINE },
      },
      axisLabel: isLastSub ? xAxisLabelStyle : { show: false },
      axisTick: {
        show: isLastSub,
        lineStyle: { color: CHART_COLORS.AXIS_LINE },
      },
      // 副图 X 轴 axisPointer: 始终开启 axisPointer 并启用 snap
      axisPointer: {
        show: true,
        snap: true,
        label: isLastSub
          ? {
              show: true,
              backgroundColor: 'rgba(30, 34, 45, 0.95)',
              color: '#f0f0f0',
              fontSize: isMobile ? 10 : 11,
              fontFamily: 'monospace',
              padding: [4, 8],
              borderRadius: 3,
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
            }
          : {
              show: false,
            },
      },
      // 垂直网格线 (统一配置，确保贯穿)
      splitLine: unifiedSplitLine,
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
    // 主图 Y 轴 axisPointer 配置 - 价格标签样式（参考时间标签风格）
    axisPointer: {
      show: true,
      snap: true,
      label: {
        show: true,
        backgroundColor: '#1e222d', // 深色背景，提高对比度
        color: '#ffffff',
        fontSize: isMobile ? 11 : 12,
        fontFamily: 'monospace',
        fontWeight: 500,
        padding: [6, 10], // 增加内边距，提高可读性
        borderRadius: 4,
        formatter: (params: { value: number }) => formatter(params.value),
      },
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: CHART_COLORS.GRID_LINE,
        type: 'dashed',
        width: 1,
      },
    },
    splitArea: {
      show: false,
    },
  };
}

/**
 * 副图类型枚举
 */
type SubChartType = 'VOL' | 'MACD' | 'RSI' | 'DEFAULT';

/**
 * 生成副图 Y 轴配置
 * @param gridIndex - Grid 索引
 * @param isMobile - 是否为移动端
 * @param subChartType - 副图类型 (RSI 需要固定 0-100 范围)
 */
function buildSubYAxis(
  gridIndex: number,
  isMobile: boolean,
  subChartType: SubChartType = 'DEFAULT',
): object {
  const config = isMobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT;

  // RSI 特殊配置：固定 Y 轴范围 0-100
  const isRSI = subChartType === 'RSI';
  const isVOL = subChartType === 'VOL';
  const rsiAxisConfig = isRSI
    ? {
        min: 0,
        max: 100,
        scale: false, // 禁用自动缩放
        interval: isMobile ? 50 : 25, // 移动端: 0, 50, 100; 桌面端: 0, 25, 50, 75, 100
      }
    : {
        scale: true,
      };

  return {
    type: 'value' as const,
    ...rsiAxisConfig,
    gridIndex,
    position: 'right' as const,
    axisLine: { show: false },
    axisTick: { show: false },
    splitNumber: isRSI ? undefined : isMobile ? 2 : 3,
    axisLabel: {
      color: CHART_COLORS.AXIS_LABEL,
      fontSize: isMobile ? 8 : 9,
      inside: config.Y_AXIS_LABEL_INSIDE,
      verticalAlign: config.Y_AXIS_LABEL_INSIDE ? 'bottom' : 'middle',
      margin: config.Y_AXIS_LABEL_INSIDE ? 1 : 4,
      showMinLabel: true,
      showMaxLabel: !isVOL, // VOL 顶部标签会与主图交叉，禁用
      formatter: isRSI ? (value: number) => `${value}` : formatSubChartValue,
    },
    // 副图 Y 轴 axisPointer 配置 - 与主图统一样式
    axisPointer: {
      show: true,
      snap: true,
      label: {
        show: true,
        backgroundColor: '#1e222d', // 深色背景，提高对比度
        color: '#ffffff',
        fontSize: isMobile ? 11 : 12,
        fontFamily: 'monospace',
        fontWeight: 500,
        padding: [6, 10], // 增加内边距，提高可读性
        borderRadius: 4,
        formatter: (params: { value: number }) =>
          isRSI
            ? `${params.value.toFixed(1)}`
            : formatSubChartValue(params.value),
      },
    },
    splitLine: {
      show: true,
      lineStyle: {
        color: CHART_COLORS.GRID_LINE,
        type: 'dashed',
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
  const { isMobile = true, activeSubIndicators = [] } = options;
  const axes: object[] = [];

  // 主图 Y 轴
  axes.push(buildMainYAxis(priceRange, isMobile));

  // 副图 Y 轴 (根据指标类型应用不同配置)
  for (let i = 0; i < subCount; i++) {
    const subType = (activeSubIndicators[i] as SubChartType) || 'DEFAULT';
    axes.push(buildSubYAxis(i + 1, isMobile, subType));
  }

  return axes;
}
