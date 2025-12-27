/**
 * Chart layout constants
 * 用于确保多窗格堆叠时，各窗格的绘制区域（plot area）一致，方便十字光标/悬浮对齐。
 */

/**
 * 统一右侧价格轴的最小宽度（px）。
 *
 * Lightweight Charts 会在需要显示更长的标签时“超过 minimumWidth”，
 * 因此这里需要给一个足够大的值以覆盖常见的价格/指标格式，避免各窗格宽度漂移。
 */
export const RIGHT_PRICE_SCALE_MIN_WIDTH = 96;


