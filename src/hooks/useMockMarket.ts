import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  OrderBook,
  WorkerDataMessage,
  WorkerStartMessage,
  WorkerStopMessage,
} from '../types/index';

/**
 * Mock Market 数据 Hook
 * 管理 Web Worker 生命周期，提供订单簿实时数据
 *
 * @param interval - 数据更新间隔（毫秒），默认 100ms
 * @returns { latestData, isRunning, start, stop }
 */
export function useMockMarket(interval: number = 100) {
  const [latestData, setLatestData] = useState<OrderBook | null>(null);
  const [isRunning, setIsRunning] = useState(false);
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

    worker.onmessage = (event: MessageEvent<WorkerDataMessage>) => {
      if (event.data.type === 'DATA') {
        setLatestData(event.data.payload);
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
   */
  const start = useCallback(() => {
    const worker = initWorker();
    const message: WorkerStartMessage = {
      type: 'START',
      payload: { interval },
    };
    worker.postMessage(message);
    setIsRunning(true);
  }, [initWorker, interval]);

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
  };
}
