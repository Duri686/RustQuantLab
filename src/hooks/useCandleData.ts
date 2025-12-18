import { useState, useRef, useEffect, useCallback } from 'react';
import type { Candle, OrderBook } from '../types/index';

/**
 * 计算简单移动平均线 (SMA)
 * @param data - 收盘价数组
 * @param period - 周期
 * @returns SMA 值，数据不足时返回 null
 */
function calculateSMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

/**
 * 待处理 K 线（正在聚合中）
 */
interface PendingCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tickCount: number;
}

/** K 线历史最大长度 */
const MAX_CANDLE_HISTORY = 120;
/** MA 周期配置 */
const MA_PERIODS = [5, 10, 20, 30] as const;
/** K 线周期（毫秒） */
const CANDLE_INTERVAL_MS = 1000;

/**
 * useCandleData Hook
 * 将高频 Tick 数据聚合为 1 秒 K 线数据
 *
 * @param latestTick - 最新的 Tick 数据（来自 Worker/Rust）
 * @returns { candleHistory, currentLiveCandle } - K 线历史 + 当前实时 K 线
 */
export function useCandleData(latestTick: OrderBook | null) {
  // K 线历史数组
  const [candleHistory, setCandleHistory] = useState<Candle[]>([]);

  // 当前正在聚合的 K 线 (ref 避免频繁触发渲染)
  const pendingCandleRef = useRef<PendingCandle | null>(null);

  // 收盘价历史，用于计算 MA
  const closePricesRef = useRef<number[]>([]);

  // 定时器 ID
  const timerRef = useRef<number | null>(null);

  // 上一次 K 线完成的时间戳
  const lastCandleTimeRef = useRef<number>(0);

  /**
   * 完成当前 K 线，推入历史
   */
  const finalizePendingCandle = useCallback(() => {
    const pending = pendingCandleRef.current;
    if (!pending || pending.tickCount === 0) return null;

    // 更新收盘价历史
    closePricesRef.current.push(pending.close);
    if (closePricesRef.current.length > MAX_CANDLE_HISTORY) {
      closePricesRef.current.shift();
    }

    // 计算所有 MA 周期
    const ma5 = calculateSMA(closePricesRef.current, MA_PERIODS[0]);
    const ma10 = calculateSMA(closePricesRef.current, MA_PERIODS[1]);
    const ma20 = calculateSMA(closePricesRef.current, MA_PERIODS[2]);
    const ma30 = calculateSMA(closePricesRef.current, MA_PERIODS[3]);

    const finalCandle: Candle = {
      time: pending.time,
      timeStr: new Date(pending.time).toLocaleTimeString(),
      open: pending.open,
      high: pending.high,
      low: pending.low,
      close: pending.close,
      volume: pending.volume,
      ma5,
      ma10,
      ma20,
      ma30,
    };

    return finalCandle;
  }, []);

  /**
   * 定时器回调：每秒将 pending K 线推入历史
   */
  const onIntervalTick = useCallback(() => {
    const finalized = finalizePendingCandle();

    if (finalized) {
      setCandleHistory((prev) => {
        const newHistory = [...prev, finalized];
        // 限制历史长度
        if (newHistory.length > MAX_CANDLE_HISTORY) {
          return newHistory.slice(-MAX_CANDLE_HISTORY);
        }
        return newHistory;
      });

      // 重置 pending K 线，Open = 上一根 Close
      pendingCandleRef.current = {
        time: Date.now(),
        open: finalized.close,
        high: finalized.close,
        low: finalized.close,
        close: finalized.close,
        volume: 0,
        tickCount: 0,
      };
      lastCandleTimeRef.current = finalized.time;
    }
  }, [finalizePendingCandle]);

  /**
   * 启动定时器
   */
  useEffect(() => {
    // 启动 1 秒定时器
    timerRef.current = window.setInterval(onIntervalTick, CANDLE_INTERVAL_MS);

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [onIntervalTick]);

  /**
   * 处理新 Tick 数据
   */
  useEffect(() => {
    if (!latestTick) return;

    const price = latestTick.price;
    const now = Date.now();

    // 估算成交量：买卖盘最优档位的平均量
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
      // 更新 pending K 线的 High/Low/Close/Volume
      const pending = pendingCandleRef.current;
      pending.high = Math.max(pending.high, price);
      pending.low = Math.min(pending.low, price);
      pending.close = price;
      pending.volume += tickVolume;
      pending.tickCount += 1;
    }
  }, [latestTick]);

  /**
   * 构建当前实时 K 线（用于图表显示未完成的 K 线）
   */
  const currentLiveCandle: Candle | null = (() => {
    const pending = pendingCandleRef.current;
    if (!pending || pending.tickCount === 0) return null;

    // 临时计算 MA（包含当前未完成的 close）
    const tempClosePrices = [...closePricesRef.current, pending.close];
    const ma5 = calculateSMA(tempClosePrices, MA_PERIODS[0]);
    const ma10 = calculateSMA(tempClosePrices, MA_PERIODS[1]);
    const ma20 = calculateSMA(tempClosePrices, MA_PERIODS[2]);
    const ma30 = calculateSMA(tempClosePrices, MA_PERIODS[3]);

    return {
      time: pending.time,
      timeStr: new Date(pending.time).toLocaleTimeString(),
      open: pending.open,
      high: pending.high,
      low: pending.low,
      close: pending.close,
      volume: pending.volume,
      ma5,
      ma10,
      ma20,
      ma30,
    };
  })();

  return {
    /** 已完成的 K 线历史 */
    candleHistory,
    /** 当前正在形成的实时 K 线 */
    currentLiveCandle,
  };
}
