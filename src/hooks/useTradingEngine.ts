/**
 * useTradingEngine 重导出模块
 * 保持向后兼容，实际实现已迁移至 ./tradingEngine/
 */

export { useTradingEngine, getSharedWasmEngine } from './tradingEngine';
export type {
  UseOrderManagerParams,
  UseOrderManagerReturn,
  UseMarketDataProcessorParams,
  UseMarketDataProcessorReturn,
} from './tradingEngine';
