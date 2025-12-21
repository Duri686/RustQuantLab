/**
 * useTradingEngine Hook
 * 交易引擎主控制器 - 整合 Wasm、Mock 数据和 K 线聚合
 *
 * 职责：
 * 1. 初始化 Wasm MarketEngine
 * 2. 管理 Mock 市场数据流
 * 3. 将 Tick 数据传递给 Wasm 计算
 * 4. 桥接 K 线聚合 + 指标数据
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMockMarket } from '../useMockMarket';
import { useCandleData } from '../useCandleData';
import { wasmSingleton } from './wasmSingleton';
import { useMarketDataProcessor } from './useMarketDataProcessor';
import { useOrderManager } from './useOrderManager';
import type {
  AnalysisResult,
  TradingEngineState,
  WasmTimeframe,
  WasmCandleHistory,
} from '../../types/index';

// 重新导出子模块类型和工具函数
export { getSharedWasmEngine } from './wasmSingleton';
export type {
  UseOrderManagerParams,
  UseOrderManagerReturn,
} from './useOrderManager';
export type {
  UseMarketDataProcessorParams,
  UseMarketDataProcessorReturn,
} from './useMarketDataProcessor';

/**
 * useTradingEngine Hook
 * 交易引擎主控制器
 *
 * @param tickInterval - Tick 数据间隔（毫秒），默认 100ms
 * @returns TradingEngineState - UI 所需的所有数据和控制函数
 */
export function useTradingEngine(
  tickInterval: number = 100,
): TradingEngineState {
  // Mock Market Hook
  const { latestData, isRunning, start, stop } = useMockMarket(tickInterval);

  // Wasm 状态 (由 useMarketDataProcessor 管理)

  // Wasm 分析结果
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );

  // Rust K 线历史数据
  const [rustCandleHistory, setRustCandleHistory] =
    useState<WasmCandleHistory | null>(null);

  // 市场数据处理 Hook
  const {
    engineRef,
    engineAlive,
    isProcessingRef,
    prevPriceRef,
    isWasmReady: wasmReady,
    initError: error,
  } = useMarketDataProcessor({
    latestData,
    setAnalysisResult,
    setRustCandleHistory,
  });

  // 加载状态简化为反向 wasmReady
  const loading = !wasmReady && !error;

  // 订单管理 Hook
  const { availableBalance, orders, submitOrder, closeOrder, addMargin } =
    useOrderManager({
      engineRef,
      engineAlive,
      isProcessingRef,
      currentPrice: latestData?.price ?? null,
      setRustCandleHistory,
    });

  // K 线聚合 Hook - 使用 Rust K 线数据
  const {
    candleHistory,
    currentLiveCandle,
    indicatorData,
    currentIndicators,
    currentTimeframe,
  } = useCandleData({
    latestTick: latestData,
    analysisResult,
    rustCandleHistory,
    useRustCandles: true,
  });

  /**
   * 自动启动数据流
   */
  useEffect(() => {
    if (wasmReady && !isRunning) {
      start();
    }
  }, [wasmReady, isRunning, start]);

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
   * 切换时间周期
   * 调用 Rust 引擎的 set_timeframe 方法
   */
  const setTimeframe = useCallback(
    (timeframe: WasmTimeframe): boolean => {
      if (!engineAlive.current || !engineRef.current || !wasmSingleton.engine) {
        console.warn('[useTradingEngine] 引擎未就绪，无法切换时间周期');
        return false;
      }

      try {
        const success = engineRef.current.set_timeframe(timeframe);
        if (success) {
          console.log(`[useTradingEngine] 时间周期已切换为 ${timeframe}`);

          // 立即获取新周期的 K 线数据
          try {
            const candles = engineRef.current.get_active_candles();
            setRustCandleHistory(candles);
          } catch {
            // K 线获取失败不影响主流程
          }
        } else {
          console.warn(`[useTradingEngine] 切换时间周期失败: ${timeframe}`);
        }
        return success;
      } catch (err) {
        console.error('[useTradingEngine] 切换时间周期失败:', err);
        return false;
      }
    },
    [engineRef, engineAlive],
  );

  /**
   * 价格趋势计算
   */
  const priceTrend = useMemo((): 'up' | 'down' | 'neutral' => {
    if (!latestData || prevPriceRef.current === null) return 'neutral';
    if (latestData.price > prevPriceRef.current) return 'up';
    if (latestData.price < prevPriceRef.current) return 'down';
    return 'neutral';
  }, [latestData, prevPriceRef]);

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
    indicatorData,
    currentIndicators,
    currentTimeframe,
    isRunning,
    wasmReady,
    loading,
    error,
    priceTrend,
    priceColorClass,
    availableBalance,
    orders,
    toggleFeed,
    setTimeframe,
    submitOrder,
    closeOrder,
    addMargin,
  };
}
