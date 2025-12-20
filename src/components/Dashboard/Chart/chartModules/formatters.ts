/**
 * 图表数值格式化工具
 * 提供 Y 轴标签的格式化函数
 *
 * @module chartModules/formatters
 */

// ============================================
// 主图价格格式化
// ============================================

/**
 * 格式化主图 Y 轴价格标签 (移动端)
 * 使用 K 后缀简化大数值
 *
 * @example
 * formatPriceMobile(12500) // "12.5K"
 * formatPriceMobile(950)   // "950"
 */
export function formatPriceMobile(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 10000) return (value / 1000).toFixed(0) + 'K';
  if (absValue >= 1000) return (value / 1000).toFixed(1) + 'K';
  return value.toFixed(0);
}

/**
 * 格式化主图 Y 轴价格标签 (桌面端)
 * 带美元符号
 *
 * @example
 * formatPriceDesktop(12500) // "$12500"
 */
export function formatPriceDesktop(value: number): string {
  return `$${value.toFixed(0)}`;
}

/**
 * 获取主图价格格式化器
 * @param isMobile - 是否为移动端
 */
export function getPriceFormatter(
  isMobile: boolean,
): (value: number) => string {
  return isMobile ? formatPriceMobile : formatPriceDesktop;
}

// ============================================
// 副图数值格式化
// ============================================

/**
 * 格式化副图 Y 轴数值标签
 * 自动选择合适的单位 (M/K/原值)
 *
 * @example
 * formatSubChartValue(1500000) // "1.5M"
 * formatSubChartValue(5000)    // "5K"
 * formatSubChartValue(150)     // "150"
 * formatSubChartValue(0.5)     // "0.5"
 */
export function formatSubChartValue(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (absValue >= 1000) return (value / 1000).toFixed(0) + 'K';
  if (absValue >= 100) return value.toFixed(0);
  return value.toFixed(1);
}

// ============================================
// 通用格式化工具
// ============================================

/**
 * 格式化百分比
 * @param value - 0-100 的百分比值
 * @param decimals - 小数位数
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return value.toFixed(decimals) + '%';
}

/**
 * 格式化成交量
 * 自动选择 M/K 单位
 */
export function formatVolume(value: number): string {
  if (value >= 1000000) return (value / 1000000).toFixed(2) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(2) + 'K';
  return value.toFixed(2);
}
