/**
 * Wasm 单例管理模块
 * 负责 MarketEngine 的全局初始化、获取和释放
 * 防止 React StrictMode / HMR 重复初始化
 */

import type { MarketEngineInstance, WasmModule } from '../../types/index';

// ============================================================================
// 模块级别单例 - 防止 React StrictMode / HMR 重复初始化
// ============================================================================

interface WasmSingleton {
  engine: MarketEngineInstance | null;
  initPromise: Promise<MarketEngineInstance> | null;
  isInitializing: boolean;
  instanceCount: number;
}

/** 全局 Wasm 单例状态 */
export const wasmSingleton: WasmSingleton = {
  engine: null,
  initPromise: null,
  isInitializing: false,
  instanceCount: 0,
};

/**
 * 初始化 Wasm 引擎 (单例模式)
 * 确保全局只有一个 MarketEngine 实例
 */
export async function initWasmEngine(): Promise<MarketEngineInstance> {
  // 如果已有引擎，直接返回
  if (wasmSingleton.engine) {
    return wasmSingleton.engine;
  }

  // 如果正在初始化，等待现有 Promise
  if (wasmSingleton.initPromise) {
    return wasmSingleton.initPromise;
  }

  // 开始初始化
  wasmSingleton.isInitializing = true;
  wasmSingleton.initPromise = (async () => {
    try {
      const wasm = await import('../../../core/pkg/quant_core');
      if (typeof wasm.default === 'function') {
        await wasm.default();
      }

      const wasmMod = wasm as unknown as WasmModule;
      const engine = new wasmMod.MarketEngine();

      wasmSingleton.engine = engine;
      wasmSingleton.instanceCount += 1;
      console.log(
        `[Wasm] MarketEngine 初始化成功 (instance #${wasmSingleton.instanceCount})`,
      );

      return engine;
    } catch (err) {
      wasmSingleton.initPromise = null;
      throw err;
    } finally {
      wasmSingleton.isInitializing = false;
    }
  })();

  return wasmSingleton.initPromise;
}

/**
 * 获取共享的 Wasm 引擎实例 (供其他 hook 使用)
 */
export function getSharedWasmEngine(): MarketEngineInstance | null {
  return wasmSingleton.engine;
}

/**
 * 释放 Wasm 引擎 (仅在 HMR 或页面卸载时调用)
 */
export function destroyWasmEngine(): void {
  if (wasmSingleton.engine) {
    try {
      wasmSingleton.engine.free();
      console.log('[Wasm] MarketEngine 已释放');
    } catch {
      // 忽略已释放的引擎
    }
    wasmSingleton.engine = null;
    wasmSingleton.initPromise = null;
  }
}

// HMR 热更新时清理引擎，防止内存泄漏
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[HMR] 模块卸载，释放 Wasm 引擎');
    destroyWasmEngine();
  });
}
