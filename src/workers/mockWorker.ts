/**
 * Mock Market Data Worker - 消息路由入口
 *
 * 核心模拟原则:
 * 1. 情绪速度不对称性 - 下跌如电梯，上涨如爬楼梯
 * 2. 杠杆清算与插针 - Scam Wicks, Cascade Liquidations
 * 3. 市场操纵特征 - Bart Pattern, Fakeouts, Stop Hunts
 * 4. 技术指标响应 - 80% 遵循，20% 破坏
 * 5. 成交量-波动率解耦 - 无量空涨、放量滞涨
 * 6. 分形噪声 - 厚尾分布、跳空
 *
 * @see ./marketSimulation/ 具体实现模块
 */

import type {
  WorkerMessage,
  WorkerHistoryDataMessage,
} from '../types/index';

import {
  startGeneration,
  stopGeneration,
  generateHistoricalCandles,
} from './marketSimulation';

// ============================================================================
// 消息处理函数
// ============================================================================

/**
 * 处理历史数据请求
 */
function handleHistoryRequest(timeframeSeconds: number, count: number): void {
  const candles = generateHistoricalCandles(timeframeSeconds, count);
  const message: WorkerHistoryDataMessage = {
    type: 'HISTORY',
    payload: {
      timeframeSeconds,
      candles,
    },
  };
  self.postMessage(message);
}

/**
 * 处理启动请求
 */
function handleStart(interval: number, startPrice?: number): void {
  startGeneration(interval, startPrice, (msg) => self.postMessage(msg));
}

/**
 * 处理停止请求
 */
function handleStop(): void {
  stopGeneration();
}

// ============================================================================
// Worker 消息入口
// ============================================================================

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  switch (type) {
    case 'START': {
      const { interval, startPrice } = event.data.payload;
      handleStart(interval, startPrice);
      break;
    }
    case 'STOP': {
      handleStop();
      break;
    }
    case 'GET_HISTORY': {
      const { timeframeSeconds, count } = event.data.payload;
      handleHistoryRequest(timeframeSeconds, count);
      break;
    }
    default:
      console.warn('Unknown message type:', type);
  }
};
