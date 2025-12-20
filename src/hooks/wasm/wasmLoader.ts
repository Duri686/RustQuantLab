/**
 * Wasm 模块加载器
 * 负责异步初始化 Wasm 模块和 MarketEngine 实例
 *
 * @module hooks/wasm/wasmLoader
 */

import type { WasmMarketEngine } from '../../types/wasm';

// ============================================
// 类型定义
// ============================================

export interface WasmLoadResult {
  engine: WasmMarketEngine;
  success: true;
}

export interface WasmLoadError {
  error: string;
  success: false;
}

export type WasmInitResult = WasmLoadResult | WasmLoadError;

// ============================================
// 加载函数
// ============================================

/**
 * 异步加载并初始化 Wasm 模块
 * @returns Promise<WasmInitResult>
 */
export async function loadWasmEngine(): Promise<WasmInitResult> {
  try {
    // 动态导入 Wasm 模块 (基于 wasm-pack 生成的 pkg 目录)
    const wasmModule = await import('../../../core/pkg/quant_core');

    // 调用 init 函数 (wasm-bindgen 生成)
    if (typeof wasmModule.default === 'function') {
      await wasmModule.default();
    }

    // 实例化 MarketEngine
    const engine = new wasmModule.MarketEngine() as WasmMarketEngine;

    console.log('[wasmLoader] Wasm 引擎初始化成功');

    return { engine, success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[wasmLoader] Wasm 初始化失败:', errorMessage);

    return { error: errorMessage, success: false };
  }
}

/**
 * 安全释放引擎资源
 * @param engine - MarketEngine 实例
 */
export function releaseEngine(engine: WasmMarketEngine | null): void {
  if (!engine) return;

  try {
    engine.free();
    console.log('[wasmLoader] Wasm 引擎资源已释放');
  } catch (err) {
    console.warn('[wasmLoader] 释放引擎资源时出错:', err);
  }
}
