/**
 * 市场数据处理 Hook
 * 处理高频 Tick 数据，调用 Wasm 引擎进行分析
 */

import { useState, useEffect, useRef } from 'react';
import { wasmLock } from '../wasmLock';
import {
  wasmSingleton,
  initWasmEngine,
  destroyWasmEngine,
} from './wasmSingleton';
import type {
  MarketEngineInstance,
  AnalysisResult,
  WasmCandleHistory,
  OrderBook,
} from '../../types/index';

/** 市场数据处理 Hook 参数 */
export interface UseMarketDataProcessorParams {
  /** 最新 Tick 数据 */
  latestData: OrderBook | null;
  /** 设置分析结果 */
  setAnalysisResult: (result: AnalysisResult | null) => void;
  /** 设置 Rust K 线历史 */
  setRustCandleHistory: (candles: WasmCandleHistory | null) => void;
}

/** 市场数据处理 Hook 返回值 */
export interface UseMarketDataProcessorReturn {
  /** 引擎实例引用 */
  engineRef: React.RefObject<MarketEngineInstance | null>;
  /** 引擎是否可用标志 */
  engineAlive: React.RefObject<boolean>;
  /** 是否正在处理中 */
  isProcessingRef: React.RefObject<boolean>;
  /** 上一个价格 */
  prevPriceRef: React.RefObject<number | null>;
  /** Wasm 是否已初始化完成 */
  isWasmReady: boolean;
  /** 初始化错误 */
  initError: string | null;
}

/** 连续错误阈值 */
const MAX_ERRORS = 5;

/**
 * 市场数据处理 Hook
 * 使用锁机制防止 Wasm 对象的并发/递归访问
 */
export function useMarketDataProcessor({
  latestData,
  setAnalysisResult,
  setRustCandleHistory,
}: UseMarketDataProcessorParams): UseMarketDataProcessorReturn {
  // Engine 实例引用
  const engineRef = useRef<MarketEngineInstance | null>(null);
  const prevPriceRef = useRef<number | null>(null);

  // 标记引擎是否可用（防止 free 后继续调用）
  const engineAlive = useRef<boolean>(false);

  // Wasm 初始化状态 (用于触发 React 重渲染)
  const [isWasmReady, setIsWasmReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // 组件挂载计数 (用于检测 StrictMode 双重挂载)
  const mountCountRef = useRef(0);

  // 防止并发调用锁 (使用时间戳增强)
  const isProcessingRef = useRef(false);
  const lastProcessTimeRef = useRef(0);

  // 连续错误计数
  const errorCountRef = useRef(0);

  /**
   * 初始化 Wasm 模块 (使用单例模式)
   */
  useEffect(() => {
    mountCountRef.current += 1;
    const currentMount = mountCountRef.current;
    let aborted = false;

    const init = async () => {
      try {
        // 使用单例初始化，避免重复创建
        const engine = await initWasmEngine();

        if (aborted) return;

        // 绑定到当前组件的 ref
        engineRef.current = engine;
        engineAlive.current = true;
        setIsWasmReady(true);
      } catch (err) {
        if (!aborted) {
          console.error('Wasm 模块加载失败:', err);
          setInitError(err instanceof Error ? err.message : '未知错误');
        }
      }
    };

    init();

    return () => {
      aborted = true;
      engineAlive.current = false;
      engineRef.current = null;
      console.log(`[Wasm] 组件卸载 (mount #${currentMount}), 引擎保持活跃`);
    };
  }, []);

  /**
   * 处理市场数据（高频 Tick）
   * 使用锁机制防止 Wasm 对象的并发/递归访问
   */
  useEffect(() => {
    // 双重检查：引用存在 + 引擎可用 + 单例存在
    if (!latestData || !engineRef.current || !engineAlive.current) return;
    if (!wasmSingleton.engine) return;

    // 防止并发调用 - Wasm 对象不支持递归访问
    if (isProcessingRef.current) {
      return;
    }

    // 使用共享锁防止与 useTradingState 的并发调用
    if (!wasmLock.acquire()) {
      return;
    }

    // 增加最小调用间隔保护 (10ms)
    const now = Date.now();
    if (now - lastProcessTimeRef.current < 10) {
      wasmLock.release();
      return;
    }

    isProcessingRef.current = true;
    lastProcessTimeRef.current = now;

    try {
      // 额外检查引擎是否仍然有效
      if (!wasmSingleton.engine || engineRef.current !== wasmSingleton.engine) {
        isProcessingRef.current = false;
        wasmLock.release();
        return;
      }

      const result = engineRef.current.on_tick(latestData);
      setAnalysisResult(result);
      prevPriceRef.current = latestData.price;

      // 获取当前时间周期的 K 线数据
      try {
        const candles = engineRef.current.get_active_candles();
        setRustCandleHistory(candles);
      } catch {
        // K 线获取失败不影响主流程
      }

      // 成功后重置错误计数
      errorCountRef.current = 0;
    } catch (err) {
      // 如果引擎已被释放，静默忽略
      if (!engineAlive.current || !wasmSingleton.engine) {
        isProcessingRef.current = false;
        return;
      }

      errorCountRef.current += 1;

      // 只在首次和每 5 次错误时打印日志，减少控制台噪音
      if (errorCountRef.current === 1 || errorCountRef.current % 5 === 0) {
        console.error(
          `MarketEngine.on_tick 错误 (${errorCountRef.current}/${MAX_ERRORS}):`,
          err,
        );
      }

      // 连续错误过多时，尝试重新初始化引擎
      if (errorCountRef.current >= MAX_ERRORS) {
        console.warn('MarketEngine 连续错误过多，尝试重新初始化...');
        engineAlive.current = false;

        // 清理并重新初始化
        destroyWasmEngine();
        setTimeout(async () => {
          try {
            const newEngine = await initWasmEngine();
            engineRef.current = newEngine;
            engineAlive.current = true;
            errorCountRef.current = 0;
            console.log('[Wasm] 引擎重新初始化成功');
          } catch (reinitErr) {
            console.error('[Wasm] 引擎重新初始化失败:', reinitErr);
          }
        }, 100);
      }
    } finally {
      isProcessingRef.current = false;
      wasmLock.release();
    }
  }, [latestData, setAnalysisResult, setRustCandleHistory]);

  return {
    engineRef,
    engineAlive,
    isProcessingRef,
    prevPriceRef,
    isWasmReady,
    initError,
  };
}
