/**
 * useTradingState 重导出模块
 * 保持向后兼容，实际实现已迁移至 ./tradingState/
 */

export { useTradingState, useTradingState as default } from './tradingState';
export {
  handleEngineEvents,
  safeToFixed,
  useSharedEngine,
} from './tradingState';
export type {
  TradingWasmEngine,
  ToastHandler,
  UseSharedEngineReturn,
} from './tradingState';
