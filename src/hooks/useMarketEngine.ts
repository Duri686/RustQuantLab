/**
 * useMarketEngine - Rust Wasm 引擎桥接 Hook
 *
 * 作为 React UI 与 Rust MarketEngine 之间的桥梁，
 * 提供类型安全的 Wasm 调用接口。
 *
 * @module hooks/useMarketEngine
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type MutableRefObject,
} from 'react';
import type {
  WasmOrderBook,
  WasmAnalysisResult,
  WasmMarketEngine,
  WasmCandleHistory,
  WasmTimeframe,
} from '../types/wasm';

import { loadWasmEngine, releaseEngine } from './wasm/wasmLoader';
import * as Engine from './wasm/engineMethods';

// ============================================
// 类型定义
// ============================================

/**
 * useMarketEngine Hook 返回值类型
 */
export interface UseMarketEngineReturn {
  /** Wasm 模块是否已加载并就绪 */
  isReady: boolean;
  /** 加载中状态 */
  isLoading: boolean;
  /** 初始化错误信息 */
  error: string | null;
  /** 最新的分析结果 */
  latestAnalysis: WasmAnalysisResult | null;
  /** 当前激活的时间周期 */
  currentTimeframe: WasmTimeframe;
  /** 当前时间周期的 K 线历史数据 */
  candleHistory: WasmCandleHistory | null;
  /** 处理单次 Tick 数据 */
  processTick: (orderBook: WasmOrderBook) => void;
  /** 清空引擎历史数据 */
  clearHistory: () => void;
  /** 获取当前历史长度 */
  getHistoryLength: () => number;
  /** 切换时间周期 */
  setTimeframe: (timeframe: WasmTimeframe) => boolean;
  /** 获取指定时间周期的 K 线数据 */
  getCandles: (timeframe: WasmTimeframe) => WasmCandleHistory | null;
  /** 获取当前激活时间周期的 K 线数据 */
  getActiveCandles: () => WasmCandleHistory | null;
  /** 获取指定时间周期的 K 线数量 */
  getCandleCount: (timeframe: WasmTimeframe) => number;
  /** MarketEngine 实例引用 (高级用法) */
  engineRef: MutableRefObject<WasmMarketEngine | null>;
}

// ============================================
// Hook 实现
// ============================================

/**
 * useMarketEngine - Rust Wasm MarketEngine 桥接 Hook
 */
export function useMarketEngine(): UseMarketEngineReturn {
  // ========== 状态 ==========
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestAnalysis, setLatestAnalysis] =
    useState<WasmAnalysisResult | null>(null);
  const [currentTimeframe, setCurrentTimeframe] = useState<WasmTimeframe>('1m');
  const [candleHistory, setCandleHistory] = useState<WasmCandleHistory | null>(
    null,
  );

  // ========== Refs ==========
  const engineRef = useRef<WasmMarketEngine | null>(null);
  const isAliveRef = useRef(false);

  // ========== 初始化 ==========
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const result = await loadWasmEngine();

      if (!isMounted) return;

      if (result.success) {
        engineRef.current = result.engine;
        isAliveRef.current = true;
        setIsReady(true);
      } else {
        setError(result.error);
      }
      setIsLoading(false);
    };

    init();

    return () => {
      isMounted = false;
      if (isAliveRef.current) {
        releaseEngine(engineRef.current);
        engineRef.current = null;
        isAliveRef.current = false;
      }
    };
  }, []);

  // ========== 方法 ==========

  const processTick = useCallback((orderBook: WasmOrderBook): void => {
    const result = Engine.processTick(
      engineRef.current,
      isAliveRef.current,
      orderBook,
    );
    if (result) {
      setLatestAnalysis(result);
      const candles = Engine.getActiveCandles(
        engineRef.current,
        isAliveRef.current,
      );
      setCandleHistory(candles);
    }
  }, []);

  const clearHistory = useCallback((): void => {
    Engine.clearHistory(engineRef.current, isAliveRef.current);
    setLatestAnalysis(null);
  }, []);

  const getHistoryLength = useCallback((): number => {
    return Engine.getHistoryLength(engineRef.current, isAliveRef.current);
  }, []);

  const setTimeframe = useCallback((timeframe: WasmTimeframe): boolean => {
    const success = Engine.setTimeframe(
      engineRef.current,
      isAliveRef.current,
      timeframe,
    );
    if (success) {
      setCurrentTimeframe(timeframe);
      const candles = Engine.getActiveCandles(
        engineRef.current,
        isAliveRef.current,
      );
      setCandleHistory(candles);
    }
    return success;
  }, []);

  const getCandles = useCallback(
    (timeframe: WasmTimeframe): WasmCandleHistory | null => {
      return Engine.getCandles(
        engineRef.current,
        isAliveRef.current,
        timeframe,
      );
    },
    [],
  );

  const getActiveCandles = useCallback((): WasmCandleHistory | null => {
    return Engine.getActiveCandles(engineRef.current, isAliveRef.current);
  }, []);

  const getCandleCount = useCallback((timeframe: WasmTimeframe): number => {
    return Engine.getCandleCount(
      engineRef.current,
      isAliveRef.current,
      timeframe,
    );
  }, []);

  // ========== 返回 ==========
  return {
    isReady,
    isLoading,
    error,
    latestAnalysis,
    currentTimeframe,
    candleHistory,
    processTick,
    clearHistory,
    getHistoryLength,
    setTimeframe,
    getCandles,
    getActiveCandles,
    getCandleCount,
    engineRef,
  };
}

export default useMarketEngine;
