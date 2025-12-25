/**
 * useCandleData Hook - K 线数据聚合
 * 将高频 Tick 数据聚合为 K 线数据
 *
 * 支持两种模式：
 * 1. 前端聚合模式 (useRustCandles=false)
 * 2. Rust Wasm 聚合模式 (useRustCandles=true)
 *
 * @module hooks/useCandleData
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Candle, OrderBook, IndicatorData } from '../types/index';
import type {
  WasmAnalysisResult,
  WasmCandleHistory,
  WasmTimeframe,
} from '../types/wasm';

// 从拆分模块导入
import {
  MAX_CANDLE_HISTORY,
  CANDLE_INTERVAL_MS,
  type PendingCandle,
  type PendingIndicators,
  createEmptyPendingIndicators,
  convertWasmCandle,
  buildLiveCandle,
} from './candle/candleUtils';

import { useIndicatorHistory } from './candle/useIndicatorHistory';

// 重新导出类型供外部使用
export type { PendingIndicators } from './candle/candleUtils';

// ============================================
// Hook 类型定义
// ============================================

/**
 * useCandleData Hook 配置参数
 */
export interface UseCandleDataOptions {
  /** 最新的 Tick 数据（来自 Worker） */
  latestTick: OrderBook | null;
  /** 最新的 Rust 分析结果 */
  analysisResult: WasmAnalysisResult | null;
  /** Rust 返回的 K 线历史数据 */
  rustCandleHistory?: WasmCandleHistory | null;
  /** 是否使用 Rust K 线数据 @default false */
  useRustCandles?: boolean;
}

/**
 * useCandleData Hook 返回值
 */
export interface UseCandleDataReturn {
  /** 已完成的 K 线历史 */
  candleHistory: Candle[];
  /** 当前正在形成的实时 K 线 */
  currentLiveCandle: Candle | null;
  /** 指标数据历史 (与 candleHistory 同步) */
  indicatorData: IndicatorData;
  /** 当前实时指标值 */
  currentIndicators: PendingIndicators;
  /** 当前时间周期 (仅 Rust 模式有效) */
  currentTimeframe: WasmTimeframe | null;
}

// ============================================
// Hook 实现
// ============================================

/**
 * useCandleData Hook
 */
export function useCandleData(
  options: UseCandleDataOptions,
): UseCandleDataReturn {
  const {
    latestTick,
    analysisResult,
    rustCandleHistory,
    useRustCandles = false,
  } = options;

  // ========== 前端聚合模式状态 ==========

  /** K 线历史数组 */
  const [candleHistory, setCandleHistory] = useState<Candle[]>([]);

  /** 当前正在聚合的 K 线 */
  const pendingCandleRef = useRef<PendingCandle | null>(null);

  /** 当前周期内的指标数据 */
  const pendingIndicatorsRef = useRef<PendingIndicators>(
    createEmptyPendingIndicators(),
  );

  /** 定时器 ID */
  const timerRef = useRef<number | null>(null);

  // ========== 使用指标历史 Hook ==========

  const { indicatorData, currentIndicators, appendIndicators } =
    useIndicatorHistory({
      useRustCandles,
      rustCandleHistory,
      analysisResult,
    });

  // 同步 pendingIndicatorsRef (供 buildLiveCandle 使用)
  useEffect(() => {
    if (analysisResult) {
      pendingIndicatorsRef.current = currentIndicators;
    }
  }, [analysisResult, currentIndicators]);

  // ========== 定时器回调: 完成 K 线 ==========

  /**
   * 完成当前 K 线，推入历史
   */
  const finalizePendingCandle = useCallback(() => {
    const pending = pendingCandleRef.current;
    const indicators = pendingIndicatorsRef.current;

    if (!pending || pending.tickCount === 0) return null;

    // 构建最终 K 线
    const finalCandle: Candle = {
      time: pending.time,
      timeStr: new Date(pending.time).toLocaleTimeString(),
      open: pending.open,
      high: pending.high,
      low: pending.low,
      close: pending.close,
      volume: pending.volume,
      sma5: indicators.sma5,
      ma7: indicators.ma7,
      ma25: indicators.ma25,
      ma99: indicators.ma99,
    };

    return finalCandle;
  }, []);

  /**
   * 定时器回调：每秒将 pending K 线推入历史
   */
  const onIntervalTick = useCallback(() => {
    const finalCandle = finalizePendingCandle();

    if (finalCandle) {
      // 更新 K 线历史
      setCandleHistory((prev) => {
        const newHistory = [...prev, finalCandle];
        return newHistory.length > MAX_CANDLE_HISTORY
          ? newHistory.slice(-MAX_CANDLE_HISTORY)
          : newHistory;
      });

      // 追加指标历史
      appendIndicators();

      // 重置 pending K 线
      pendingCandleRef.current = {
        time: Date.now(),
        open: finalCandle.close,
        high: finalCandle.close,
        low: finalCandle.close,
        close: finalCandle.close,
        volume: 0,
        tickCount: 0,
      };
    }
  }, [finalizePendingCandle, appendIndicators]);

  // ========== 定时器管理 ==========

  useEffect(() => {
    if (useRustCandles) return; // Rust 模式不使用本地定时器

    timerRef.current = window.setInterval(onIntervalTick, CANDLE_INTERVAL_MS);

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [onIntervalTick, useRustCandles]);

  // ========== 处理 Tick 数据 ==========

  useEffect(() => {
    if (!latestTick || useRustCandles) return;

    const price = latestTick.price;
    const now = Date.now();

    // 估算成交量
    const bidVol = latestTick.bids[0]?.[1] ?? 0;
    const askVol = latestTick.asks[0]?.[1] ?? 0;
    const tickVolume = (bidVol + askVol) / 2;

    if (!pendingCandleRef.current) {
      // 初始化第一根 pending K 线
      pendingCandleRef.current = {
        time: now,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: tickVolume,
        tickCount: 1,
      };
    } else {
      // 更新 pending K 线
      const pending = pendingCandleRef.current;
      pending.high = Math.max(pending.high, price);
      pending.low = Math.min(pending.low, price);
      pending.close = price;
      pending.volume += tickVolume;
      pending.tickCount += 1;
    }
  }, [latestTick, useRustCandles]);

  // ========== Rust 模式: K 线转换 ==========

  /** 将 Rust K 线历史转换为前端格式 */
  const rustConvertedCandles = useMemo((): Candle[] => {
    if (!useRustCandles || !rustCandleHistory) return [];
    const tf = rustCandleHistory.timeframe;
    return rustCandleHistory.candles.map((c) => convertWasmCandle(c, tf));
  }, [useRustCandles, rustCandleHistory]);

  /** Rust 模式下的当前实时 K 线 */
  const rustCurrentCandle = useMemo((): Candle | null => {
    if (!useRustCandles || !rustCandleHistory?.currentCandle) return null;
    return convertWasmCandle(
      rustCandleHistory.currentCandle,
      rustCandleHistory.timeframe,
    );
  }, [useRustCandles, rustCandleHistory]);

  /** 当前时间周期 */
  const currentTimeframe = useMemo((): WasmTimeframe | null => {
    if (!useRustCandles || !rustCandleHistory) return null;
    return rustCandleHistory.timeframe;
  }, [useRustCandles, rustCandleHistory]);

  // ========== 构建实时 K 线 ==========

  const currentLiveCandle: Candle | null = useMemo(() => {
    const pending = pendingCandleRef.current;
    if (!pending || pending.tickCount === 0) return null;
    return buildLiveCandle(pending, pendingIndicatorsRef.current);
  }, [latestTick]); // 依赖 latestTick 触发更新

  // ========== Rust 模式: 指标数据 ==========

  const finalIndicatorData = useMemo((): IndicatorData => {
    if (!useRustCandles || !rustCandleHistory?.indicators) {
      return indicatorData;
    }

    // 直接使用 Rust 计算的指标历史
    const rustIndicators = rustCandleHistory.indicators;
    return {
      sma5: [],
      ma7: rustIndicators.ma7,
      ma25: rustIndicators.ma25,
      ma99: rustIndicators.ma99,
      ema7: rustIndicators.ema7,
      ema25: rustIndicators.ema25,
      rsi14: rustIndicators.rsi14,
      bollUpper: rustIndicators.bollUpper,
      bollMid: rustIndicators.bollMid,
      bollLower: rustIndicators.bollLower,
      macdDif: rustIndicators.macdDif,
      macdDea: rustIndicators.macdDea,
      macdHist: rustIndicators.macdHist,
      volMa5: [],
    };
  }, [useRustCandles, rustCandleHistory, indicatorData]);

  // ========== 返回值 ==========

  return {
    candleHistory: useRustCandles ? rustConvertedCandles : candleHistory,
    currentLiveCandle: useRustCandles ? rustCurrentCandle : currentLiveCandle,
    indicatorData: finalIndicatorData,
    currentIndicators,
    currentTimeframe,
  };
}
