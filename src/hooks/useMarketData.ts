/**
 * 统一市场数据 Hook
 *
 * 提供可切换的数据源：
 * - mock: 本地模拟数据 (用于开发/演示)
 * - binance: Binance 实时数据 (用于生产)
 *
 * 两种数据源返回相同的接口，确保与下游 Hook 兼容
 */

import { useMemo, useEffect, useRef, useCallback } from 'react';
import { useMockMarket } from './useMockMarket';
import { useBinanceMarket, type TradeRecord } from './useBinanceMarket';
import type { OrderBook, HistoryCandle } from '../types/index';
import type { BinanceTicker24h, BinancePremiumIndex } from '../services/binance/types';

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
  /** 交易对 (如 BTCUSDT, ETHUSDT) */
  symbol?: string;
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
  /** 24h Ticker 统计 (仅 Binance) */
  ticker24h?: BinanceTicker24h | null;
  /** 最近成交记录 (仅 Binance) */
  recentTrades?: TradeRecord[];
  /** Taker 买入比例 (仅 Binance) */
  takerBuyRatio?: number | null;
  /** 合约标记价格 / 资金费率 (仅 Binance) */
  premiumIndex?: BinancePremiumIndex | null;
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
  
  const { source = 'mock', tickInterval = 100, historyCount = 1500, symbol = 'BTCUSDT' } = options;

  // 追踪上一次的数据源
  const prevSourceRef = useRef<DataSource>(source);

  // ========== Mock 数据源 ==========
  const mockData = useMockMarket(tickInterval);

  // ========== Binance 数据源 ==========
  const binanceData = useBinanceMarket({
    tickInterval,
    historyCount,
    symbol,
    market: 'futures',
  });

  // ========== 统一的历史数据请求封装 ==========
  // 说明：
  // - Binance：直接沿用其内部实现（数量由 historyCount 控制，单位为根数）
  // - Mock：为了兼容 Rust 需要 1s 粒度，这里将 historyCount 视为“分钟数”，转换为秒数传递
  const unifiedRequestHistory = useCallback(() => {
    if (source === 'binance') {
      binanceData.requestHistory();
      return;
    }
    // mock 数据源：按分钟 -> 秒（1s 粒度）
    const seconds = Math.max(1, historyCount) * 60;
    mockData.requestHistory(1, seconds);
  }, [
    source,
    binanceData.requestHistory,
    mockData.requestHistory,
    historyCount,
  ]);

  // ========== 数据源切换时，强制停止旧数据流 ==========
  useEffect(() => {
    if (prevSourceRef.current !== source) {
      // 强制停止旧数据源
      if (prevSourceRef.current === 'mock') {
        mockData.terminate();
      }
      if (prevSourceRef.current === 'binance') {
        binanceData.stop();
      }

      prevSourceRef.current = source;
    }
  }, [source, mockData, binanceData]);

  // ========== 持续监控：确保只有一个数据源在运行 ==========
  useEffect(() => {
    if (source === 'binance' && mockData.isRunning) {
      mockData.terminate();
    }
    if (source === 'mock' && binanceData.isRunning) {
      binanceData.stop();
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
        requestHistory: unifiedRequestHistory,
        dataSource: 'binance',
        connectionStatus: binanceData.connectionStatus,
        error: binanceData.error,
        ticker24h: binanceData.ticker24h,
        recentTrades: binanceData.recentTrades,
        takerBuyRatio: binanceData.takerBuyRatio,
        premiumIndex: binanceData.premiumIndex,
      };
    }

    // 默认使用 mock 数据
    return {
      latestData: mockData.latestData,
      isRunning: mockData.isRunning,
      // 使用 options.symbol 启动 mock
      start: (startPrice?: number) => mockData.start(symbol, startPrice),
      stop: mockData.stop,
      historyCandles: mockData.historyCandles,
      historyLoading: mockData.historyLoading,
      requestHistory: unifiedRequestHistory,
      dataSource: 'mock',
    };
  }, [source, mockData, binanceData, unifiedRequestHistory]);

  return result;
}

// ============================================================================
// 导出
// ============================================================================

export { useMockMarket } from './useMockMarket';
export { useBinanceMarket } from './useBinanceMarket';
