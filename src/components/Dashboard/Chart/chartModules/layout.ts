/**
 * 图表 Grid 布局计算模块
 * 核心策略：Main-Chart-First (xx风格)
 *
 * @module chartModules/layout
 */

import { CHART_COLORS } from './constants';
import {
  MOBILE_LAYOUT,
  DESKTOP_LAYOUT,
  getMinSubHeight,
  getLayoutConfig,
  type LayoutConfig,
} from './layoutConstants';

// 重新导出供外部使用
export { getLayoutConfig } from './layoutConstants';
export { buildXAxes, buildYAxes } from './axisConfig';
export type { XAxisOptions, YAxisOptions } from './axisConfig';

// ============================================
// 类型定义
// ============================================

/**
 * Grid 配置类型
 */
export interface GridConfig {
  left: number | string;
  right: number | string;
  top: number | string;
  bottom?: number | string;
  height?: string;
  containLabel: boolean;
  borderColor?: string;
  borderWidth?: number;
  show?: boolean;
}

/**
 * 布局选项参数
 */
export interface LayoutOptions {
  /** 是否为移动端 */
  isMobile: boolean;
  /** 副图数量 */
  subCount: number;
  /** 成交量是否叠加到主图 */
  volumeOverlay?: boolean;
}

/**
 * 布局配置返回类型
 */
export interface LayoutResult {
  grids: GridConfig[];
  /** 分隔线 Y 坐标位置 (百分比数组) */
  dividerPositions: number[];
  /** 布局元数据 */
  meta: {
    mainChartHeight: number;
    subChartHeight: number;
    isMobile: boolean;
  };
}

/**
 * 分隔线配置选项
 */
export interface DividerOptions {
  /** 是否为移动端 */
  isMobile?: boolean;
  /** 分隔线颜色 */
  color?: string;
  /** 分隔线宽度 */
  lineWidth?: number;
}

// ============================================
// Grid 布局计算
// ============================================

/**
 * 计算副图高度和总间距
 */
function calculateSubChartHeights(
  config: LayoutConfig,
  effectiveSubCount: number,
  availableHeight: number,
  isMobile: boolean,
): { perSubHeight: number; totalSubHeight: number; totalGapHeight: number } {
  // 获取配置的副图高度
  const configKey = Math.min(effectiveSubCount, 3);
  let perSubHeight = config.SUB_HEIGHT_CONFIG[configKey];

  // 计算总间距
  const totalGapHeight =
    config.MAIN_SUB_GAP_PCT + (effectiveSubCount - 1) * config.SUB_SUB_GAP_PCT;

  // 副图总高度
  let totalSubHeight = perSubHeight * effectiveSubCount + totalGapHeight;

  // 主图保护逻辑：压缩副图以保证主图最小高度
  const maxSubTotalAllowed = availableHeight - config.MIN_MAIN_HEIGHT_PCT;

  if (totalSubHeight > maxSubTotalAllowed) {
    const subSpaceAfterGap = maxSubTotalAllowed - totalGapHeight;
    const minSubHeight = getMinSubHeight(isMobile);
    perSubHeight = Math.max(
      minSubHeight,
      Math.floor(subSpaceAfterGap / effectiveSubCount),
    );
    totalSubHeight = perSubHeight * effectiveSubCount + totalGapHeight;
  }

  return { perSubHeight, totalSubHeight, totalGapHeight };
}

/**
 * 创建主图 Grid 配置
 */
function createMainGrid(config: LayoutConfig, mainHeight: number): GridConfig {
  return {
    left: config.GRID_LEFT,
    right: config.GRID_RIGHT,
    top: `${config.TOP_PADDING_PCT}%`,
    height: `${mainHeight}%`,
    containLabel: false, // 禁止自适应，确保边距固定
    show: true,
    borderWidth: 0,
  };
}

/**
 * 创建副图 Grid 配置
 */
function createSubGrid(
  config: LayoutConfig,
  top: number,
  height: number,
): GridConfig {
  return {
    left: config.GRID_LEFT,
    right: config.GRID_RIGHT,
    top: `${top}%`,
    height: `${height}%`,
    containLabel: false, // 禁止自适应，确保边距固定
    show: true,
    borderWidth: 0,
  };
}

/**
 * 动态计算 Grid 布局 (Main-Chart-First 策略)
 *
 * 核心原则：
 * 1. 主图优先：移动端至少 60%，桌面端至少 50%
 * 2. 副图压缩：副图数量增加时，压缩副图而非主图
 * 3. xx风格：紧凑的间距，最大化图表可视区域
 */
export function buildDynamicGridLayout(options: LayoutOptions): LayoutResult;
/** @deprecated 使用 LayoutOptions 参数代替 */
export function buildDynamicGridLayout(subCount: number): LayoutResult;
export function buildDynamicGridLayout(
  optionsOrSubCount: LayoutOptions | number,
): LayoutResult {
  // 兼容旧 API
  const options: LayoutOptions =
    typeof optionsOrSubCount === 'number'
      ? { isMobile: true, subCount: optionsOrSubCount }
      : optionsOrSubCount;

  const { isMobile, subCount, volumeOverlay = false } = options;
  const config = isMobile ? MOBILE_LAYOUT : DESKTOP_LAYOUT;

  const grids: GridConfig[] = [];
  const dividerPositions: number[] = [];

  // 计算可用空间
  const availableHeight =
    100 - config.TOP_PADDING_PCT - config.BOTTOM_PADDING_PCT;

  // 实际副图数量
  const effectiveSubCount = volumeOverlay
    ? Math.max(0, subCount - 1)
    : subCount;

  // 无副图：主图占满
  if (effectiveSubCount === 0) {
    grids.push({
      left: config.GRID_LEFT,
      right: config.GRID_RIGHT,
      top: `${config.TOP_PADDING_PCT}%`,
      bottom: `${config.BOTTOM_PADDING_PCT}%`,
      containLabel: false, // 禁止自适应，确保边距固定
      show: true,
      borderWidth: 0,
    });

    return {
      grids,
      dividerPositions,
      meta: {
        mainChartHeight: availableHeight,
        subChartHeight: 0,
        isMobile,
      },
    };
  }

  // 计算副图高度
  const { perSubHeight, totalSubHeight } = calculateSubChartHeights(
    config,
    effectiveSubCount,
    availableHeight,
    isMobile,
  );

  // 主图高度
  const mainHeight = availableHeight - totalSubHeight;

  // 主图 Grid
  grids.push(createMainGrid(config, mainHeight));

  // 副图 Grid
  let currentTop =
    config.TOP_PADDING_PCT + mainHeight + config.MAIN_SUB_GAP_PCT;

  for (let i = 0; i < effectiveSubCount; i++) {
    // 记录分隔线位置
    const gapBefore =
      i === 0 ? config.MAIN_SUB_GAP_PCT : config.SUB_SUB_GAP_PCT;
    dividerPositions.push(currentTop - gapBefore / 2);

    grids.push(createSubGrid(config, currentTop, perSubHeight));
    currentTop += perSubHeight + config.SUB_SUB_GAP_PCT;
  }

  return {
    grids,
    dividerPositions,
    meta: {
      mainChartHeight: mainHeight,
      subChartHeight: perSubHeight,
      isMobile,
    },
  };
}

// ============================================
// 分隔线 Graphic
// ============================================

/**
 * 生成分隔线 Graphic 元素 (xx风格)
 */
export function buildDividerGraphics(
  dividerPositions: number[],
  options: DividerOptions = {},
): object[] {
  const {
    isMobile = true,
    color = CHART_COLORS.DIVIDER,
    lineWidth = 1,
  } = options;

  const rightMargin = isMobile
    ? MOBILE_LAYOUT.GRID_RIGHT
    : DESKTOP_LAYOUT.GRID_RIGHT;

  return dividerPositions.map((yPercent) => ({
    type: 'line',
    left: 0,
    right: rightMargin,
    top: `${yPercent}%`,
    shape: {
      x1: 0,
      y1: 0,
      x2: '100%',
      y2: 0,
    },
    style: {
      stroke: color,
      lineWidth,
    },
    silent: true,
    z: 100,
  }));
}
