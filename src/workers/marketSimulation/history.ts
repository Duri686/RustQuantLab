/**
 * 历史 K 线批量生成
 */

import type { HistoryCandle } from '../../types/index';
import { initializeState, getState } from './state';
import { alignTimestamp } from './utils';
import { generateCandleFromState } from './candles';

/**
 * 生成历史 K 线数据
 */
export function generateHistoricalCandles(
  timeframeSeconds: number,
  count: number,
): HistoryCandle[] {
  const startGenTime = performance.now();

  const intervalMs = timeframeSeconds * 1000;
  const now = Date.now();
  const alignedNow = alignTimestamp(now, intervalMs);
  const startTime = alignedNow - count * intervalMs;

  // 初始化状态
  initializeState();
  const state = getState();

  const candles: HistoryCandle[] = [];
  for (let i = 0; i < count; i++) {
    const candleTime = startTime + i * intervalMs;
    const candle = generateCandleFromState(state, candleTime, timeframeSeconds);
    candles.push(candle);
  }

  // 历史数据生成后，状态已保留最后一个价格（在 generateCandleFromState 中更新）
  const lastPrice = state.currentPrice;
  const startPrice = state.basePrice;
  const priceChange = ((lastPrice - startPrice) / startPrice) * 100;

  const genTime = performance.now() - startGenTime;
  // eslint-disable-next-line no-console
  console.info(
    `[MockWorker] 生成 ${count} 根 K 线耗时: ${genTime.toFixed(1)}ms ` +
      `(${((count / genTime) * 1000).toFixed(0)} 根/秒)\n` +
      `  起始价格: $${startPrice.toFixed(2)}, 结束价格: $${lastPrice.toFixed(2)} ` +
      `(变化: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%)`,
  );

  return candles;
}

