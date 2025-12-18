import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useMockMarket } from './useMockMarket';
import { useCandleData } from './useCandleData';
import type {
  AnalysisResult,
  MarketEngineInstance,
  WasmModule,
  TradingEngineState,
} from '../types/index';

/**
 * useTradingEngine Hook
 * 交易引擎主控制器 - 整合 Wasm、Mock 数据和 K 线聚合
 *
 * 职责：
 * 1. 初始化 Wasm MarketEngine
 * 2. 管理 Mock 市场数据流
 * 3. 将 Tick 数据传递给 Wasm 计算
 * 4. 桥接 K 线聚合
 *
 * @param tickInterval - Tick 数据间隔（毫秒），默认 100ms
 * @returns TradingEngineState - UI 所需的所有数据和控制函数
 */
export function useTradingEngine(
  tickInterval: number = 100,
): TradingEngineState {
  // Mock Market Hook
  const { latestData, isRunning, start, stop } = useMockMarket(tickInterval);

  // Wasm 状态
  const [wasmReady, setWasmReady] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Engine 实例引用
  const engineRef = useRef<MarketEngineInstance | null>(null);
  const prevPriceRef = useRef<number | null>(null);

  // Wasm 分析结果
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );

  // K 线聚合 Hook
  const { candleHistory, currentLiveCandle } = useCandleData(latestData);

  /**
   * 初始化 Wasm 模块
   */
  useEffect(() => {
    let aborted = false;
    let localEngine: MarketEngineInstance | null = null;

    const initWasm = async () => {
      try {
        const wasm = await import('../../core/pkg/quant_core');
        if (typeof wasm.default === 'function') {
          await wasm.default();
        }
        if (aborted) return;

        const wasmMod = wasm as unknown as WasmModule;
        localEngine = new wasmMod.MarketEngine();
        engineRef.current = localEngine;
        console.log('MarketEngine 初始化成功');

        setWasmReady(true);
        setLoading(false);
      } catch (err) {
        if (!aborted) {
          console.error('Wasm 模块加载失败:', err);
          setError(err instanceof Error ? err.message : '未知错误');
          setLoading(false);
        }
      }
    };

    initWasm();

    return () => {
      aborted = true;
      engineRef.current = null;
      if (localEngine) {
        const engineToFree = localEngine;
        setTimeout(() => {
          try {
            engineToFree.free();
          } catch {
            // 忽略已释放的引擎
          }
        }, 0);
      }
    };
  }, []);

  /**
   * 自动启动数据流
   */
  const hasAutoStarted = useRef(false);
  useEffect(() => {
    if (wasmReady && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      start();
    }
  }, [wasmReady, start]);

  /**
   * 处理市场数据（高频 Tick）
   */
  useEffect(() => {
    if (!latestData || !engineRef.current) return;

    try {
      const result = engineRef.current.on_tick(latestData);
      setAnalysisResult(result);
      prevPriceRef.current = latestData.price;
    } catch (err) {
      console.error('MarketEngine.on_tick 错误:', err);
    }
  }, [latestData]);

  /**
   * 切换数据流开关
   */
  const toggleFeed = useCallback(() => {
    if (isRunning) {
      stop();
    } else {
      start();
    }
  }, [isRunning, start, stop]);

  /**
   * 价格趋势计算
   */
  const priceTrend = useMemo((): 'up' | 'down' | 'neutral' => {
    if (!latestData || prevPriceRef.current === null) return 'neutral';
    if (latestData.price > prevPriceRef.current) return 'up';
    if (latestData.price < prevPriceRef.current) return 'down';
    return 'neutral';
  }, [latestData]);

  /**
   * 价格颜色映射
   */
  const priceColorClass = useMemo(() => {
    if (priceTrend === 'up') return 'text-[#00f090]';
    if (priceTrend === 'down') return 'text-[#ff3b30]';
    return 'text-white';
  }, [priceTrend]);

  return {
    latestData,
    analysisResult,
    candleHistory,
    currentLiveCandle,
    isRunning,
    wasmReady,
    loading,
    error,
    priceTrend,
    priceColorClass,
    toggleFeed,
  };
}
