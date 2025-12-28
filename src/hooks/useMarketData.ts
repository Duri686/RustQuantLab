/**
 * 统一市场数据 Hook
 * 
 * 提供可切换的数据源：
 * - mock: 本地模拟数据 (用于开发/演示)
 * - binance: Binance 实时数据 (用于生产)
 * 
 * 两种数据源返回相同的接口，确保与下游 Hook 兼容
 */

import { useMemo, useEffect, useRef } from 'react';
import { useMockMarket } from './useMockMarket';
import { useBinanceMarket } from './useBinanceMarket';
import type { OrderBook, HistoryCandle } from '../types/index';

// ============================================================================
// 类型定义
// ============================================================================

/** 数据源类型 */
export type DataSource = 'mock' | 'binance';

export interface UseMarketDataOptions {
  /** 数据源 */
  source?: DataSource;
  /** 数据更新间隔 (ms) */
  tickInterval?: number;
  /** Binance 历史 K 线数量 */
  historyCount?: number;
}

export interface UseMarketDataReturn {
  /** 最新订单簿数据 */
  latestData: OrderBook | null;
  /** 数据流是否运行中 */
  isRunning: boolean;
  /** 启动数据流 */
  start: (startPrice?: number) => void;
  /** 停止数据流 */
  stop: () => void;
  /** 历史 K 线数据 */
  historyCandles: HistoryCandle[];
  /** 历史数据加载中 */
  historyLoading: boolean;
  /** 请求历史数据 */
  requestHistory: () => void;
  /** 当前数据源 */
  dataSource: DataSource;
  /** 连接状态 (仅 Binance) */
  connectionStatus?: string;
  /** 错误信息 */
  error?: string | null;
}

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 统一市场数据 Hook
 * 
 * @param options - 配置选项
 * @returns 市场数据和控制方法
 * 
 * @example
 * ```tsx
 * // 使用模拟数据
 * const { latestData, start, stop } = useMarketData({ source: 'mock' });
 * 
 * // 使用 Binance 实时数据
 * const { latestData, start, stop } = useMarketData({ source: 'binance' });
 * ```
 */
export function useMarketData(
  options: UseMarketDataOptions = {},
): UseMarketDataReturn {
  const {
    source = 'mock',
    tickInterval = 100,
    historyCount = 1500,
  } = options;

  // 追踪上一次的数据源
  const prevSourceRef = useRef<DataSource>(source);

  // ========== Mock 数据源 ==========
  const mockData = useMockMarket(tickInterval);
  
  // ========== Binance 数据源 ==========
  const binanceData = useBinanceMarket({
    tickInterval,
    historyCount,
  });

  // ========== 数据源切换时，强制停止旧数据流 ==========
  useEffect(() => {
    if (prevSourceRef.current !== source) {
      console.log(`[useMarketData] 🔄 数据源切换: ${prevSourceRef.current} -> ${source}`);
      
      // 强制停止旧数据源
      if (prevSourceRef.current === 'mock') {
        console.log('[useMarketData] ⏹️ 停止 MOCK 数据源');
        // 多次调用 stop 确保完全停止
        mockData.stop();
        // 延迟再次停止，确保 Worker 完全清理
        setTimeout(() => {
          if (mockData.isRunning) {
            console.warn('[useMarketData] ⚠️ MOCK 仍在运行，再次停止');
            mockData.stop();
          }
        }, 200);
      }
      if (prevSourceRef.current === 'binance') {
        console.log('[useMarketData] ⏹️ 停止 Binance 数据源');
        binanceData.stop();
      }
      
      prevSourceRef.current = source;
    }
  }, [source, mockData, binanceData]);

  // ========== 持续监控：确保只有一个数据源在运行 ==========
  useEffect(() => {
    // 如果当前是 binance 模式，确保 mock 完全停止
    if (source === 'binance') {
      if (mockData.isRunning) {
        console.warn('[useMarketData] ⚠️ LIVE 模式下检测到 MOCK 数据仍在运行，强制停止');
        console.warn('[useMarketData] 🔍 当前数据源:', source, 'MOCK运行状态:', mockData.isRunning, 'Binance运行状态:', binanceData.isRunning);
        mockData.stop();
      }
      // 额外检查：确保返回的是 Binance 数据
      if (mockData.latestData && binanceData.latestData) {
        console.warn('[useMarketData] ⚠️ 检测到两个数据源都有数据，当前应使用 Binance 数据');
        console.warn('[useMarketData] 🔍 MOCK数据:', mockData.latestData, 'Binance数据:', binanceData.latestData);
      }
    }
    // 如果当前是 mock 模式，确保 binance 完全停止
    if (source === 'mock') {
      if (binanceData.isRunning) {
        console.warn('[useMarketData] ⚠️ MOCK 模式下检测到 Binance 数据仍在运行，强制停止');
        binanceData.stop();
      }
    }
  }, [source, mockData.isRunning, binanceData.isRunning, mockData, binanceData]);

  // ========== 根据数据源选择返回值 ==========
  const result = useMemo((): UseMarketDataReturn => {
    if (source === 'binance') {
      return {
        latestData: binanceData.latestData,
        isRunning: binanceData.isRunning,
        start: binanceData.start,
        stop: binanceData.stop,
        historyCandles: binanceData.historyCandles,
        historyLoading: binanceData.historyLoading,
        requestHistory: binanceData.requestHistory,
        dataSource: 'binance',
        connectionStatus: binanceData.connectionStatus,
        error: binanceData.error,
      };
    }

    // 默认使用 mock 数据
    return {
      latestData: mockData.latestData,
      isRunning: mockData.isRunning,
      start: mockData.start,
      stop: mockData.stop,
      historyCandles: mockData.historyCandles,
      historyLoading: mockData.historyLoading,
      requestHistory: mockData.requestHistory,
      dataSource: 'mock',
    };
  }, [source, mockData, binanceData]);

  return result;
}

// ============================================================================
// 导出
// ============================================================================

export { useMockMarket } from './useMockMarket';
export { useBinanceMarket } from './useBinanceMarket';

