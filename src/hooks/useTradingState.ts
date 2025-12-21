/**
 * useTradingState 重导出模块
 *
 * @deprecated 已迁移至 useWasmEngine，此文件保留向后兼容
 * @see ./useWasmEngine.ts
 */

export { useWasmEngine as useTradingState } from './useWasmEngine';
export { useWasmEngine as default } from './useWasmEngine';
export { handleEngineEvents, safeToFixed } from './tradingState/eventHandler';
export type { TradingWasmEngine, ToastHandler } from './tradingState/types';
export type { UseWasmEngineReturn as UseTradingStateReturn } from './useWasmEngine';
