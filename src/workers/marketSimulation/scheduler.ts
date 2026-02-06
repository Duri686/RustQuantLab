/**
 * 实时数据调度器
 */

import type { WorkerDataMessage } from '../../types/index';
import type { PostMessageFn } from './types';
import {
  getState,
  initializeState,
  getTimeoutId,
  setTimeoutId,
  getIsRunning,
  setIsRunning,
} from './state';
import { generateOrderBook, resetBook } from './orderbook';

/**
 * 计算下次更新延迟
 */
function getNextDelay(): number {
  const state = getState();

  // 根据市场阶段调整更新频率
  let baseDelay = 500;
  let variance = 500;

  switch (state.phase) {
    case 'MARKDOWN':
      // 下跌时更新更快（恐慌）
      baseDelay = 200;
      variance = 300;
      break;
    case 'MARKUP':
      // 拉升末期加速
      if (state.phaseProgress > 0.7) {
        baseDelay = 300;
        variance = 400;
      }
      break;
  }

  // 操纵事件时加速
  if (state.currentEvent !== 'NONE') {
    baseDelay = 100;
    variance = 150;
  }

  return baseDelay + Math.random() * variance;
}

/**
 * 调度下一次 tick
 */
function scheduleNextTick(postMessage: PostMessageFn): void {
  if (!getIsRunning()) return;

  const delay = getNextDelay();
  const timeoutId = setTimeout(() => {
    if (!getIsRunning()) return;

    const data = generateOrderBook();
    const msg: WorkerDataMessage = {
      type: 'DATA',
      payload: data,
    };
    postMessage(msg);

    scheduleNextTick(postMessage);
  }, delay);

  setTimeoutId(timeoutId);
}

/**
 * 启动数据生成
 */
export function startGeneration(
  _interval: number,
  startPrice: number | undefined,
  postMessage: PostMessageFn,
): void {
  stopGeneration();
  resetBook();

  initializeState(startPrice);
  setIsRunning(true);

  // 立即发送第一条数据
  const initialData = generateOrderBook();
  const message: WorkerDataMessage = {
    type: 'DATA',
    payload: initialData,
  };
  postMessage(message);

  scheduleNextTick(postMessage);
}

/**
 * 停止数据生成
 */
export function stopGeneration(): void {
  setIsRunning(false);
  const timeoutId = getTimeoutId();
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    setTimeoutId(null);
  }
}

