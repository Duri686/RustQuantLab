/**
 * 指标历史同步 Hook
 * 负责将实时指标数据同步到历史数组
 *
 * @module hooks/candle/useIndicatorHistory
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { IndicatorData } from '../../types/index';
import type { WasmCandleHistory, WasmAnalysisResult } from '../../types/wasm';
import {
  createEmptyIndicatorData,
  createEmptyPendingIndicators,
  appendIndicatorHistory,
  extractIndicatorsFromAnalysis,
  type PendingIndicators,
} from './candleUtils';

// ============================================
// 类型定义
// ============================================

export interface UseIndicatorHistoryOptions {
  /** 是否使用 Rust K 线模式 */
  useRustCandles: boolean;
  /** Rust K 线历史数据 (Rust 模式下使用) */
  rustCandleHistory: WasmCandleHistory | null | undefined;
  /** 最新的分析结果 */
  analysisResult: WasmAnalysisResult | null;
}

export interface UseIndicatorHistoryReturn {
  /** 指标数据历史 */
  indicatorData: IndicatorData;
  /** 当前实时指标值 */
  currentIndicators: PendingIndicators;
  /** 手动追加一条指标记录 (前端聚合模式用) */
  appendIndicators: () => void;
  /** 重置指标历史 */
  resetIndicators: () => void;
}

// ============================================
// Hook 实现
// ============================================

/**
 * useIndicatorHistory - 指标历史管理 Hook
 *
 * 职责:
 * 1. 维护指标历史数组 (与 K 线历史同步)
 * 2. 跟踪当前周期的实时指标值
 * 3. 支持前端聚合模式和 Rust 模式
 */
export function useIndicatorHistory(
  options: UseIndicatorHistoryOptions,
): UseIndicatorHistoryReturn {
  const { useRustCandles, rustCandleHistory, analysisResult } = options;

  // ========== 状态 ==========

  /** 指标数据历史 */
  const [indicatorData, setIndicatorData] = useState<IndicatorData>(
    createEmptyIndicatorData,
  );

  /** 当前周期内的指标数据 (使用最新值) */
  const pendingIndicatorsRef = useRef<PendingIndicators>(
    createEmptyPendingIndicators(),
  );

  /** Rust 模式: 追踪 K 线数量变化 */
  const lastRustLenRef = useRef<number>(0);

  // ========== 更新实时指标 ==========

  /**
   * 当收到新的分析结果时，更新 pending 指标
   */
  useEffect(() => {
    if (!analysisResult) return;
    pendingIndicatorsRef.current =
      extractIndicatorsFromAnalysis(analysisResult);
  }, [analysisResult]);

  // ========== Rust 模式: 同步指标历史 ==========

  useEffect(() => {
    if (!useRustCandles) return;

    const rustLen = rustCandleHistory?.candles.length ?? 0;

    // 周期切换或重置：清空并对齐长度引用
    if (rustLen < lastRustLenRef.current) {
      setIndicatorData(createEmptyIndicatorData());
      lastRustLenRef.current = rustLen;
      return;
    }

    // 新增 K 线时，追加指标历史
    if (rustLen > lastRustLenRef.current) {
      const indicators = pendingIndicatorsRef.current;
      setIndicatorData((prev) => appendIndicatorHistory(prev, indicators));
      lastRustLenRef.current = rustLen;
    }
  }, [useRustCandles, rustCandleHistory]);

  // ========== 前端聚合模式: 手动追加 ==========

  /**
   * 手动追加当前指标到历史
   * 由 useCandleData 在定时器回调中调用
   */
  const appendIndicators = useCallback(() => {
    const indicators = pendingIndicatorsRef.current;
    setIndicatorData((prev) => appendIndicatorHistory(prev, indicators));
    // 重置 pending 指标
    pendingIndicatorsRef.current = createEmptyPendingIndicators();
  }, []);

  /**
   * 重置指标历史
   */
  const resetIndicators = useCallback(() => {
    setIndicatorData(createEmptyIndicatorData());
    pendingIndicatorsRef.current = createEmptyPendingIndicators();
    lastRustLenRef.current = 0;
  }, []);

  // ========== 返回 ==========

  return {
    indicatorData,
    currentIndicators: pendingIndicatorsRef.current,
    appendIndicators,
    resetIndicators,
  };
}
