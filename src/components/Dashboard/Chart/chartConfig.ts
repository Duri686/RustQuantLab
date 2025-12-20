/**
 * @fileoverview 图表配置模块 - 重导出入口
 *
 * 此文件已重构为模块化结构，所有实现已移至 ./ChartConfig/ 目录:
 * - constants.ts  : 颜色、常量、工具函数
 * - layout.ts     : Grid/xAxis/yAxis 动态布局
 * - series.ts     : 系列生成器 (K线、MA、MACD、RSI 等)
 * - tooltip.ts    : Tooltip 和图例配置
 * - index.ts      : 主入口，组装最终 option
 *
 * 为保持向后兼容性，此文件重导出所有公开 API。
 */

export {
  // 常量
  CHART_COLORS,
  DEFAULT_VISIBLE_CANDLES,

  // 工具函数
  extractChartData,
  calculatePriceRange,
  calculateDataZoomStart,

  // 布局配置工具
  getLayoutConfig,

  // 主函数
  getChartOption,
  createChartOption,
  createEmptyIndicatorData,
} from './chartModules';

export type { ChartData, ChartOptionConfig } from './chartModules';
