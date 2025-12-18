/**
 * Mock Market Data Worker
 * 模拟交易所 WebSocket 推送的订单簿数据
 * 使用随机游走算法生成逼真的价格变动
 */

import type {
  OrderBook,
  WorkerMessage,
  WorkerDataMessage,
} from '../types/index';

// 配置常量
const SYMBOL = 'BBB-AAA';
const BASE_PRICE = 40000.0;
const PRICE_CHANGE_PERCENT = 0.005; // 每次变动幅度 ±0.5%
const LEVELS = 50; // 订单簿深度（50 层买卖单）
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 100;
const PRICE_STEP = 0.01; // 价格精度

// 状态变量
let currentPrice = BASE_PRICE;
let timeoutId: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

/**
 * 波动率状态 - 用于生成自然的市场节奏
 * - burstMode: 是否处于"爆发"模式（高频更新）
 * - burstTicksRemaining: 爆发模式剩余 tick 数
 */
let burstMode = false;
let burstTicksRemaining = 0;

/**
 * 随机游走算法：生成下一个价格
 * 价格变动在 ±0.5% 范围内随机波动
 */
function getNextPrice(price: number): number {
  const changePercent = (Math.random() - 0.5) * 2 * PRICE_CHANGE_PERCENT;
  const newPrice = price * (1 + changePercent);
  // 保留两位小数
  return Math.round(newPrice * 100) / 100;
}

/**
 * 生成随机数量
 * @param depth - 深度层级（0 = 最佳价格，越深流动性越大）
 */
function getRandomQuantity(depth: number = 0): number {
  // 深层订单通常有更大的流动性（大户挂单）
  const depthMultiplier = 1 + depth * 0.15;
  const baseQty =
    Math.floor(Math.random() * (MAX_QUANTITY - MIN_QUANTITY + 1)) +
    MIN_QUANTITY;
  return Math.round(baseQty * depthMultiplier);
}

/**
 * 生成订单簿数据
 * 算法：使用累积价差生成逼真的订单簿层级
 */
function generateOrderBook(): OrderBook {
  // 应用随机游走更新价格
  currentPrice = getNextPrice(currentPrice);

  const bids: [number, number][] = [];
  const asks: [number, number][] = [];

  // 累积价差变量，用于生成递增/递减的价格层级
  let bidCumulativeSpread = 0;
  let askCumulativeSpread = 0;

  // 生成买单（价格低于当前价，逐层递减）
  for (let i = 0; i < LEVELS; i++) {
    // 每层价差在 0.01 ~ 0.5 之间随机
    const spread = PRICE_STEP + Math.random() * 0.49;
    bidCumulativeSpread += spread;
    const bidPrice = currentPrice - bidCumulativeSpread;
    bids.push([Math.round(bidPrice * 100) / 100, getRandomQuantity(i)]);
  }

  // 生成卖单（价格高于当前价，逐层递增）
  for (let i = 0; i < LEVELS; i++) {
    // 每层价差在 0.01 ~ 0.5 之间随机
    const spread = PRICE_STEP + Math.random() * 0.49;
    askCumulativeSpread += spread;
    const askPrice = currentPrice + askCumulativeSpread;
    asks.push([Math.round(askPrice * 100) / 100, getRandomQuantity(i)]);
  }

  // 买单按价格降序排列（最高买价在前）
  bids.sort((a, b) => b[0] - a[0]);
  // 卖单按价格升序排列（最低卖价在前）
  asks.sort((a, b) => a[0] - b[0]);

  return {
    symbol: SYMBOL,
    timestamp: Date.now(),
    price: currentPrice,
    bids,
    asks,
  };
}

/**
 * 计算下一次 tick 的延迟时间（毫秒）
 * 模拟真实市场的「心跳」节奏：
 * - 普通模式：500ms ~ 1500ms（平静市场）
 * - 爆发模式：50ms ~ 200ms（剧烈波动）
 */
function getNextDelay(): number {
  // 20% 概率触发爆发模式（如果不在爆发中）
  if (!burstMode && Math.random() > 0.8) {
    burstMode = true;
    burstTicksRemaining = Math.floor(Math.random() * 8) + 3; // 3~10 次快速 tick
  }

  if (burstMode) {
    burstTicksRemaining--;
    if (burstTicksRemaining <= 0) {
      burstMode = false;
    }
    // 爆发模式：50ms ~ 200ms
    return Math.random() * 150 + 50;
  }

  // 普通模式：500ms ~ 1500ms
  return Math.random() * 1000 + 500;
}

/**
 * 递归调度下一次 tick
 * 使用 setTimeout 替代 setInterval 实现自然节奏
 */
function scheduleNextTick(): void {
  if (!isRunning) return;

  const delay = getNextDelay();
  timeoutId = setTimeout(() => {
    if (!isRunning) return;

    const data = generateOrderBook();
    const msg: WorkerDataMessage = {
      type: 'DATA',
      payload: data,
    };
    self.postMessage(msg);

    // 递归调度
    scheduleNextTick();
  }, delay);
}

/**
 * 开始生成数据
 * @param _interval - 保留参数（兼容旧 API），实际使用动态延迟
 */
function startGeneration(_interval: number): void {
  stopGeneration();

  // 重置状态
  currentPrice = BASE_PRICE;
  burstMode = false;
  burstTicksRemaining = 0;
  isRunning = true;

  // 立即发送第一条数据
  const initialData = generateOrderBook();
  const message: WorkerDataMessage = {
    type: 'DATA',
    payload: initialData,
  };
  self.postMessage(message);

  // 启动有机化循环
  scheduleNextTick();
}

/**
 * 停止生成数据
 */
function stopGeneration(): void {
  isRunning = false;
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}

// 监听主线程消息
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  switch (type) {
    case 'START': {
      const { interval } = event.data.payload;
      startGeneration(interval);
      break;
    }
    case 'STOP': {
      stopGeneration();
      break;
    }
    default:
      console.warn('Unknown message type:', type);
  }
};
