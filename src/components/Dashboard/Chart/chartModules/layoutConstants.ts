/**
 * 图表布局常量配置
 * 移动端/桌面端响应式布局参数
 *
 * @module chartModules/layoutConstants
 */

// ============================================
// 布局配置类型
// ============================================

export interface LayoutConfig {
  /** 顶部留白 (图例区域) */
  TOP_PADDING_PCT: number;
  /** 底部留白 (X 轴标签) */
  BOTTOM_PADDING_PCT: number;
  /** 主图与副图间距 */
  MAIN_SUB_GAP_PCT: number;
  /** 副图之间间距 */
  SUB_SUB_GAP_PCT: number;
  /** 主图最小高度 */
  MIN_MAIN_HEIGHT_PCT: number;
  /** 副图高度配置 (按副图数量索引) */
  SUB_HEIGHT_CONFIG: Record<number, number>;
  /** Y 轴标签内置 */
  Y_AXIS_LABEL_INSIDE: boolean;
  /** Y 轴标签字体大小 */
  Y_AXIS_FONT_SIZE: number;
  /** Grid 右侧边距 */
  GRID_RIGHT: number;
}

// ============================================
// 移动端布局配置 (xx风格 - 主图优先)
// ============================================

export const MOBILE_LAYOUT: LayoutConfig = {
  TOP_PADDING_PCT: 6, // 给 legend 留出安全距离
  BOTTOM_PADDING_PCT: 4,
  MAIN_SUB_GAP_PCT: 2,
  SUB_SUB_GAP_PCT: 1.5,
  MIN_MAIN_HEIGHT_PCT: 60,
  SUB_HEIGHT_CONFIG: {
    0: 0, // 无副图
    1: 20, // 单副图: 主图 75%, 副图 20%
    2: 12, // 双副图: 主图 70%, 每个副图 12%
    3: 10, // 三副图: 主图 60%, 每个副图 10%
  },
  Y_AXIS_LABEL_INSIDE: true,
  Y_AXIS_FONT_SIZE: 10,
  GRID_RIGHT: 5,
};

// ============================================
// 桌面端布局配置 (标准布局)
// ============================================

export const DESKTOP_LAYOUT: LayoutConfig = {
  TOP_PADDING_PCT: 7, // 给 legend 留出安全距离
  BOTTOM_PADDING_PCT: 5,
  MAIN_SUB_GAP_PCT: 3,
  SUB_SUB_GAP_PCT: 2,
  MIN_MAIN_HEIGHT_PCT: 50,
  SUB_HEIGHT_CONFIG: {
    0: 0,
    1: 18,
    2: 14,
    3: 11,
  },
  Y_AXIS_LABEL_INSIDE: false,
  Y_AXIS_FONT_SIZE: 11,
  GRID_RIGHT: 55,
};

// ============================================
// 工具函数
// ============================================

/**
 * 根据设备类型获取布局配置
 * @param isMobile - 是否为移动端
 */
export function getLayoutConfig(isMobile: boolean): LayoutConfig {
  return isMobile ? { ...MOBILE_LAYOUT } : { ...DESKTOP_LAYOUT };
}

/**
 * 计算副图最小高度
 * @param isMobile - 是否为移动端
 */
export function getMinSubHeight(isMobile: boolean): number {
  return isMobile ? 6 : 8;
}
