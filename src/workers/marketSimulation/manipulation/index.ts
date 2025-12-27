/**
 * 市场操纵模块统一导出
 */

export { shouldTriggerEvent, initializeEvent } from './events';
export { generateBartCandle } from './bart';
export { generateManipulationCandle } from './manipulationCandles';
export {
  initializeMicroTrend,
  generateMicroTrendCandle,
  isMicroTrendComplete,
  calculateEventDuration,
} from './microTrend';

