/**
 * @fileoverview 统一的 Wasm 引擎 Hook
 *
 * 整合市场数据处理 + 交易状态管理，React 只做 UI 搬运工，
 * 所有数据计算和交易逻辑在 Rust 引擎中完成。
 *
 * ## 核心功能
 * - WASM 单例初始化
 * - 高频 Tick 数据处理（Rust 计算）
 * - 交易状态管理（Rust 引擎）
 * - K 线聚合 + 指标数据（Rust 计算）
 *
 * @module hooks/useWasmEngine
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useMockMarket } from './useMockMarket';
import { useCandleData } from './useCandleData';
import { useToast } from '../components/Toast';
import {
  wasmSingleton,
  initWasmEngine,
  destroyWasmEngine,
  getWasmMemoryUsage,
} from './tradingEngine/wasmSingleton';
import {
  useTradingActions,
  type UseTradingActionsReturn,
} from './tradingEngine/useTradingActions';
import { handleEngineEvents } from './tradingState/eventHandler';
import type {
  AnalysisResult,
  OrderBook,
  Candle,
  IndicatorData,
  MarketEngineInstance,
  HistoryCandle,
} from '../types/index';
import type { WasmTimeframe, WasmCandleHistory } from '../types/wasm';
import type {
  TradingState,
  Position,
  LiquidationResult,
  EngineEvent,
  PendingOrder,
} from '../types/trading';
import type { TradingWasmEngine } from './tradingState/types';
import type { PendingIndicators } from './candle/candleUtils';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * useWasmEngine Hook 返回类型
 */
export interface UseWasmEngineReturn {
  // ========== 初始化状态 ==========
  /** Wasm 是否就绪 */
  wasmReady: boolean;
  /** 加载中状态 */
  loading: boolean;
  /** 初始化错误 */
  error: string | null;

  // ========== 市场数据 (Rust 计算) ==========
  /** 最新 Tick 数据 */
  latestData: OrderBook | null;
  /** Rust 分析结果 */
  analysisResult: AnalysisResult | null;
  /** K 线历史数据 */
  candleHistory: Candle[];
  /** 当前正在形成的 K 线 */
  currentLiveCandle: Candle | null;
  /** 指标数据历史 */
  indicatorData: IndicatorData;
  /** 当前实时指标值 */
  currentIndicators: PendingIndicators;
  /** 当前时间周期 */
  currentTimeframe: WasmTimeframe | null;
  /** 历史 K 线数据 (由 Worker 生成) */
  historyCandles: HistoryCandle[];
  /** 历史数据是否就绪 */
  historyReady: boolean;

  // ========== 数据流控制 ==========
  /** 数据流是否运行中 */
  isRunning: boolean;
  /** 价格趋势 */
  priceTrend: 'up' | 'down' | 'neutral';
  /** 价格颜色 CSS 类 */
  priceColorClass: string;
  /** 切换数据流开关 */
  toggleFeed: () => void;
  /** 切换时间周期 */
  setTimeframe: (timeframe: WasmTimeframe) => boolean;

  // ========== 交易状态 (Rust 管理) ==========
  /** 交易状态快照 */
  tradingState: TradingState | null;
  /** 当前仓位 (便捷访问) */
  position: Position | null;
  /** 当前风险评估 (便捷访问) */
  riskAssessment: LiquidationResult | null;
  /** 是否有活跃仓位 */
  hasPosition: boolean;
  /** 活跃挂单列表 */
  pendingOrders: PendingOrder[];
  /** 最后一次事件列表 */
  lastEvents: EngineEvent[];

  // ========== 交易操作 (调用 Rust) ==========
  /** 开仓 */
  placeOrder: UseTradingActionsReturn['placeOrder'];
  /** 平仓 */
  closePosition: UseTradingActionsReturn['closePosition'];
  /** 设置杠杆 */
  setLeverage: UseTradingActionsReturn['setLeverage'];
  /** 重置账户 */
  resetAccount: UseTradingActionsReturn['resetAccount'];
  /** 取消挂单 */
  cancelOrder: UseTradingActionsReturn['cancelOrder'];
  /** 增加保证金 (逐仓模式) */
  addMargin: UseTradingActionsReturn['addMargin'];
}

// ============================================================================
// 常量
// ============================================================================

/** 连续错误阈值 */
const MAX_ERRORS = 5;

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 统一的 Wasm 引擎 Hook
 *
 * @param tickInterval - Tick 数据间隔（毫秒），默认 100ms
 * @returns UseWasmEngineReturn
 */
export function useWasmEngine(tickInterval: number = 100): UseWasmEngineReturn {
  // ========== Toast ==========
  const toast = useToast();

  // ========== Mock 市场数据 ==========
  const {
    latestData,
    isRunning,
    start,
    stop,
    historyCandles,
    historyLoading,
    requestHistory,
  } = useMockMarket(tickInterval);

  // ========== Wasm 初始化状态 ==========
  const [wasmReady, setWasmReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = !wasmReady && !error;

  // ========== 引擎引用 ==========
  const engineRef = useRef<MarketEngineInstance | null>(null);
  const engineAlive = useRef(false);
  const isProcessingRef = useRef(false);
  const prevPriceRef = useRef<number | null>(null);
  const errorCountRef = useRef(0);
  const lastProcessTimeRef = useRef(0);
  /** 历史数据是否已加载到 Rust 引擎 */
  const historyLoadedRef = useRef(false);

  // ========== 分析结果 ==========
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [rustCandleHistory, setRustCandleHistory] =
    useState<WasmCandleHistory | null>(null);

  // ========== 交易状态 ==========
  const [tradingState, setTradingState] = useState<TradingState | null>(null);
  const [lastEvents, setLastEvents] = useState<EngineEvent[]>([]);

  // ========== Wasm 初始化 ==========
  useEffect(() => {
    let aborted = false;
    const t0 = performance.now();

    const init = async () => {
      try {
        console.log('[Perf] ⏱️ 开始 WASM 初始化...');
        const engine = await initWasmEngine();
        console.log(
          `[Perf] ✅ WASM 初始化完成: ${(performance.now() - t0).toFixed(0)}ms`,
        );

        if (aborted) return;

        engineRef.current = engine;
        engineAlive.current = true;
        setWasmReady(true);

        // 获取初始交易状态
        try {
          const state = (
            engine as unknown as TradingWasmEngine
          ).get_trading_state();
          setTradingState(state);
        } catch {
          // 初始状态获取失败不阻塞
        }
      } catch (err) {
        if (!aborted) {
          console.error('[useWasmEngine] Wasm 初始化失败:', err);
          setError(err instanceof Error ? err.message : '未知错误');
        }
      }
    };

    init();

    return () => {
      aborted = true;
      engineAlive.current = false;
      engineRef.current = null;
      console.log('[useWasmEngine] 组件卸载，引擎保持活跃');
    };
  }, []);

  // ========== 处理 Tick 数据 (整合市场分析 + 交易状态更新) ==========
  useEffect(() => {
    if (!latestData || !engineRef.current || !engineAlive.current) return;
    if (!wasmSingleton.engine) return;

    // 防止并发调用
    if (isProcessingRef.current) return;

    // 最小调用间隔保护 (10ms)
    const now = Date.now();
    if (now - lastProcessTimeRef.current < 10) return;

    isProcessingRef.current = true;
    lastProcessTimeRef.current = now;

    try {
      // 检查引擎是否仍然有效
      if (!wasmSingleton.engine || engineRef.current !== wasmSingleton.engine) {
        return;
      }

      // 1. 调用 Rust on_tick 处理市场数据
      const result = engineRef.current.on_tick(latestData);
      setAnalysisResult(result);
      prevPriceRef.current = latestData.price;

      // 2. 获取 K 线数据
      try {
        const candles = engineRef.current.get_active_candles();
        setRustCandleHistory(candles);
      } catch {
        // K 线获取失败不影响主流程
      }

      // 3. 同步交易状态 (Rust 内部已处理价格更新和风险检查)
      try {
        const state = (
          engineRef.current as unknown as TradingWasmEngine
        ).get_trading_state();
        setTradingState(state);

        // 处理事件
        if (state.pendingEvents && state.pendingEvents.length > 0) {
          handleEngineEvents(state.pendingEvents, toast);
          setLastEvents(state.pendingEvents);
        }
      } catch {
        // 交易状态获取失败不影响主流程
      }

      // 重置错误计数
      errorCountRef.current = 0;
    } catch (err) {
      // 如果引擎已被释放，静默忽略
      if (!engineAlive.current || !wasmSingleton.engine) {
        return;
      }

      errorCountRef.current += 1;

      if (errorCountRef.current === 1 || errorCountRef.current % 5 === 0) {
        console.error(
          `[useWasmEngine] on_tick 错误 (${errorCountRef.current}/${MAX_ERRORS}):`,
          err,
        );
      }

      // 连续错误过多时，尝试重新初始化引擎
      if (errorCountRef.current >= MAX_ERRORS) {
        console.warn('[useWasmEngine] 连续错误过多，尝试重新初始化...');
        engineAlive.current = false;

        destroyWasmEngine();
        setTimeout(async () => {
          try {
            const newEngine = await initWasmEngine();
            engineRef.current = newEngine;
            engineAlive.current = true;
            errorCountRef.current = 0;
            console.log('[useWasmEngine] 引擎重新初始化成功');
          } catch (reinitErr) {
            console.error('[useWasmEngine] 引擎重新初始化失败:', reinitErr);
          }
        }, 100);
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [latestData, toast]);

  // ========== 自动请求历史数据 ==========
  useEffect(() => {
    if (wasmReady && !historyLoadedRef.current && historyCandles.length === 0) {
      // 先请求历史数据，等加载完成后再启动实时数据
      requestHistory();
    }
  }, [wasmReady, requestHistory, historyCandles.length]);

  // ========== 加载历史数据到 Rust 引擎，然后启动实时数据 ==========
  useEffect(() => {
    // 条件：引擎就绪 + 历史数据已生成 + 未加载过
    if (
      !engineAlive.current ||
      !engineRef.current ||
      historyCandles.length === 0 ||
      historyLoadedRef.current
    ) {
      return;
    }

    try {
      const startTime = performance.now();

      // 加载 1m K 线并自动聚合到所有高周期 (5m/15m/1H/4H/1D)
      const results =
        engineRef.current.load_history_1m_and_aggregate(historyCandles);
      historyLoadedRef.current = true;

      const loadTime = performance.now() - startTime;

      // 获取历史数据的最后收盘价，作为实时数据的起点
      const lastPrice = historyCandles[historyCandles.length - 1].close;

      // 打印各周期加载情况
      const summary = results
        .map(([tf, count]) => `${tf}: ${count}`)
        .join(', ');

      // 获取真实 WASM 内存使用
      const wasmMemory = getWasmMemoryUsage();
      const memoryInfo = wasmMemory
        ? `${wasmMemory.megabytes} MB (${wasmMemory.pages} pages)`
        : '无法获取';

      console.log(
        `[useWasmEngine] 历史数据已加载: ${summary}, 起始价: $${lastPrice.toFixed(
          2,
        )}\n` +
          `  ⏱️ Rust 处理耗时: ${loadTime.toFixed(1)}ms (${(
            (historyCandles.length / loadTime) *
            1000
          ).toFixed(0)} 根/秒)\n` +
          `  📦 WASM 线性内存: ${memoryInfo}`,
      );

      // 切换到 1H 时间周期，触发 K 线数据刷新
      engineRef.current.set_timeframe('1H');
      const candles = engineRef.current.get_active_candles();
      setRustCandleHistory(candles);

      // 历史数据加载完成后，启动实时数据流（传入起始价格确保衔接）
      if (!isRunning) {
        start(lastPrice);
      }
    } catch (err) {
      console.error('[useWasmEngine] 加载历史数据失败:', err);
    }
  }, [historyCandles, isRunning, start]);

  // ========== K 线聚合 Hook ==========
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

  // ========== 便捷访问 ==========
  const position: Position | null = tradingState?.position ?? null;
  const riskAssessment: LiquidationResult | null =
    tradingState?.riskAssessment ?? null;
  const hasPosition = position !== null;
  const pendingOrders: PendingOrder[] = tradingState?.pendingOrders ?? [];

  // ========== 历史数据状态 ==========
  const historyReady = historyCandles.length > 0 && !historyLoading;

  // ========== 价格趋势 ==========
  const priceTrend = useMemo((): 'up' | 'down' | 'neutral' => {
    if (!latestData || prevPriceRef.current === null) return 'neutral';
    if (latestData.price > prevPriceRef.current) return 'up';
    if (latestData.price < prevPriceRef.current) return 'down';
    return 'neutral';
  }, [latestData]);

  const priceColorClass = useMemo(() => {
    if (priceTrend === 'up') return 'text-[#00f090]';
    if (priceTrend === 'down') return 'text-[#ff3b30]';
    return 'text-white';
  }, [priceTrend]);

  // ========== 控制方法 ==========

  /** 切换数据流 */
  const toggleFeed = useCallback(() => {
    if (isRunning) {
      stop();
    } else {
      start();
    }
  }, [isRunning, start, stop]);

  /** 切换时间周期 */
  const setTimeframe = useCallback((timeframe: WasmTimeframe): boolean => {
    if (!engineAlive.current || !engineRef.current) {
      console.warn('[useWasmEngine] 引擎未就绪，无法切换时间周期');
      return false;
    }

    try {
      const success = engineRef.current.set_timeframe(timeframe);
      if (success) {
        console.log(`[useWasmEngine] 时间周期已切换为 ${timeframe}`);

        // 立即获取新周期的 K 线数据
        try {
          const candles = engineRef.current.get_active_candles();
          setRustCandleHistory(candles);
        } catch {
          // K 线获取失败不影响主流程
        }
      }
      return success;
    } catch (err) {
      console.error('[useWasmEngine] 切换时间周期失败:', err);
      return false;
    }
  }, []);

  // ========== 交易操作 Hook ==========
  const tradingActions = useTradingActions({
    engineRef,
    engineAlive,
    isProcessingRef,
    toast,
    onStateUpdate: setTradingState,
    onEventsUpdate: setLastEvents,
  });

  // ========== 返回 ==========
  return {
    // 初始化状态
    wasmReady,
    loading,
    error,

    // 市场数据
    latestData,
    analysisResult,
    candleHistory,
    currentLiveCandle,
    indicatorData,
    currentIndicators,
    currentTimeframe,
    historyCandles,
    historyReady,

    // 数据流控制
    isRunning,
    priceTrend,
    priceColorClass,
    toggleFeed,
    setTimeframe,

    // 交易状态
    tradingState,
    position,
    riskAssessment,
    hasPosition,
    pendingOrders,
    lastEvents,

    // 交易操作
    ...tradingActions,
  };
}

// ========== 导出工具函数 ==========
export { getSharedWasmEngine } from './tradingEngine/wasmSingleton';
export { handleEngineEvents, safeToFixed } from './tradingState/eventHandler';
export type { TradingWasmEngine, ToastHandler } from './tradingState/types';
