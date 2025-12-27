import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  OrderBook,
  WorkerOutMessage,
  WorkerStartMessage,
  WorkerStopMessage,
  WorkerHistoryRequestMessage,
  HistoryCandle,
} from '../types/index';

/**
 * Mock Market 数据 Hook
 * 管理 Web Worker 生命周期，提供订单簿实时数据
 *
 * @param interval - 数据更新间隔（毫秒），默认 100ms
 * @returns { latestData, isRunning, start, stop }
 */
/** 默认历史 K 线数量 (15 天 * 24 * 60 * 60 = 1296000 根 1s K 线，约 15 天) */
const DEFAULT_HISTORY_COUNT = 1296000;

/** 1s 时间周期 (秒) - 作为基础粒度，Rust 会自动聚合到高周期 */
const TIMEFRAME_1S_SECONDS = 1;

export function useMockMarket(interval: number = 100) {
  const [latestData, setLatestData] = useState<OrderBook | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [historyCandles, setHistoryCandles] = useState<HistoryCandle[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  /**
   * 初始化 Worker
   */
  const initWorker = useCallback(() => {
    if (workerRef.current) {
      return workerRef.current;
    }

    // 使用 Vite 的 Worker 语法
    const worker = new Worker(
      new URL('../workers/mockWorker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const { type } = event.data;

      if (type === 'DATA') {
        setLatestData(event.data.payload);
      } else if (type === 'HISTORY') {
        const t0 = performance.now();
        const candles = event.data.payload.candles;
        console.log(`[Perf] 📦 Worker 历史数据到达: ${candles.length} 根`);
        setHistoryCandles(candles);
        setHistoryLoading(false);
        console.log(
          `[Perf] ✅ React state 更新: ${(performance.now() - t0).toFixed(
            0,
          )}ms`,
        );
      }
    };

    worker.onerror = (error) => {
      console.error('Worker error:', error);
      setIsRunning(false);
    };

    workerRef.current = worker;
    return worker;
  }, []);

  /**
   * 启动数据生成
   * @param startPrice - 可选，起始价格（用于从历史数据结束价继续）
   */
  const start = useCallback(
    (startPrice?: number) => {
      const worker = initWorker();
      const message: WorkerStartMessage = {
        type: 'START',
        payload: { interval, startPrice },
      };
      worker.postMessage(message);
      setIsRunning(true);
    },
    [initWorker, interval],
  );

  /**
   * 停止数据生成
   */
  const stop = useCallback(() => {
    if (workerRef.current) {
      const message: WorkerStopMessage = { type: 'STOP' };
      workerRef.current.postMessage(message);
      setIsRunning(false);
    }
  }, []);

  /**
   * 请求历史 K 线数据
   * @param timeframeSeconds - 时间周期 (秒)，默认 1m = 60
   * @param count - K 线数量，默认 1296000 (15 天 1s K 线)
   */
  const requestHistory = useCallback(
    (
      timeframeSeconds: number = TIMEFRAME_1S_SECONDS,
      count: number = DEFAULT_HISTORY_COUNT,
    ) => {
      console.log(`[Perf] 📤 请求历史数据: ${count} 根 K 线...`);
      const worker = initWorker();
      setHistoryLoading(true);
      const message: WorkerHistoryRequestMessage = {
        type: 'GET_HISTORY',
        payload: { timeframeSeconds, count },
      };
      worker.postMessage(message);
    },
    [initWorker],
  );

  /**
   * 组件卸载时清理 Worker
   */
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  return {
    latestData,
    isRunning,
    start,
    stop,
    /** 历史 K 线数据 */
    historyCandles,
    /** 历史数据加载中 */
    historyLoading,
    /** 请求历史数据 */
    requestHistory,
  };
}
