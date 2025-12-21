/**
 * 共享引擎初始化 Hook
 * 复用 useTradingEngine 的 Wasm 引擎实例
 */

import { useState, useRef, useEffect } from 'react';
import { wasmLock } from '../wasmLock';
import { getSharedWasmEngine } from '../tradingEngine';
import type { TradingState } from '../../types/trading';
import type { TradingWasmEngine } from './types';

/** 共享引擎 Hook 返回值 */
export interface UseSharedEngineReturn {
  /** Wasm 是否就绪 */
  wasmReady: boolean;
  /** 引擎实例引用 */
  engineRef: React.MutableRefObject<TradingWasmEngine | null>;
  /** 引擎是否可用 */
  engineAlive: React.MutableRefObject<boolean>;
  /** 是否正在处理中 */
  isProcessingRef: React.MutableRefObject<boolean>;
  /** 初始交易状态 */
  initialState: TradingState | null;
}

/**
 * 共享引擎初始化 Hook
 * 轮询等待 useTradingEngine 初始化完成后获取共享引擎
 */
export function useSharedEngine(): UseSharedEngineReturn {
  const [wasmReady, setWasmReady] = useState(false);
  const [initialState, setInitialState] = useState<TradingState | null>(null);
  const engineRef = useRef<TradingWasmEngine | null>(null);
  const engineAlive = useRef(false);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    let aborted = false;
    let checkInterval: ReturnType<typeof setInterval>;

    const checkSharedEngine = () => {
      if (aborted) return;

      // 尝试获取共享引擎
      const sharedEngine = getSharedWasmEngine();
      if (sharedEngine) {
        // 共享引擎已就绪
        engineRef.current = sharedEngine as unknown as TradingWasmEngine;
        engineAlive.current = true;
        setWasmReady(true);

        // 清除轮询
        if (checkInterval) clearInterval(checkInterval);

        // 获取初始状态
        if (wasmLock.acquire()) {
          try {
            const state = engineRef.current.get_trading_state();
            setInitialState(state);
          } catch {
            // 初始状态获取失败不阻塞
          } finally {
            wasmLock.release();
          }
        }
      }
    };

    // 立即检查一次
    checkSharedEngine();

    // 如果没有就绪，轮询检查
    if (!engineRef.current) {
      checkInterval = setInterval(checkSharedEngine, 100);
    }

    return () => {
      aborted = true;
      engineAlive.current = false;
      if (checkInterval) clearInterval(checkInterval);
      engineRef.current = null;
    };
  }, []);

  return {
    wasmReady,
    engineRef,
    engineAlive,
    isProcessingRef,
    initialState,
  };
}
