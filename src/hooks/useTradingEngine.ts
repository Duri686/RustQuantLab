/**
 * useTradingEngine 重导出模块
 *
 * @deprecated 已迁移至 useWasmEngine，此文件保留向后兼容
 * @see ./useWasmEngine.ts
 */

export { useWasmEngine as useTradingEngine } from './useWasmEngine';
export { getSharedWasmEngine } from './tradingEngine/wasmSingleton';
export type { UseWasmEngineReturn as UseTradingEngineReturn } from './useWasmEngine';
