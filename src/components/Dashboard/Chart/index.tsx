/**
 * K 线图表组件入口
 * 使用 TradingView Lightweight Charts 实现的多窗格图表系统
 */

// 导出新的多窗格版本
export { default } from './LightweightChart';
export type { LightweightChartHandle as KLineChartHandle } from './LightweightChart';

// 也导出旧版本以便对比（可选）
// export { default as KLineChartLegacy } from './KLineChartLightweight';
