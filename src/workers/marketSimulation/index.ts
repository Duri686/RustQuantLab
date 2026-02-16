/**
 * 市场模拟模块统一导出
 */

// 类型导出
export type {
  MarketPhase,
  ManipulationEvent,
  VolumeMode,
  BartStage,
  TechnicalIndicators,
  MarketState,
  CandleResult,
  PostMessageFn,
} from './types';

// 常量导出
export { getRandomBasePrice, LEVELS, PRICE_PRECISION } from './constants';

// 状态管理
export {
  getState,
  getStateOrNull,
  initializeState,
  setState,
  resetState,
} from './state';

// 工具函数
export {
  alignTimestamp,
  round2,
  fatTailRandom,
  calculateMA,
  calculateStdDev,
  updateIndicators,
} from './utils';

// Wyckoff 模块
export { getNextPhase, getPhaseDuration, updatePhase } from './wyckoff';

// 操纵模块
export {
  shouldTriggerEvent,
  initializeEvent,
  generateBartCandle,
  generateManipulationCandle,
} from './manipulation';

// K 线生成
export {
  generateShadows,
  applyTechnicalResponse,
  generateVolume,
  updateVolatilityAndVolumeMode,
  generateNormalCandle,
  generateCandleFromState,
} from './candles';

// 输出模块
export { generateHistoricalCandles } from './history';
export { generateOrderBook, resetBook } from './orderbook';
export { startGeneration, stopGeneration } from './scheduler';

