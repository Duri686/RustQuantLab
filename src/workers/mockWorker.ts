/**
 * Mock Market Data Worker
 * 模拟交易所 WebSocket 推送的订单簿数据
 * 使用随机游走算法生成逼真的价格变动
 */

import type {
  OrderBook,
  WorkerMessage,
  WorkerDataMessage,
  WorkerHistoryDataMessage,
  HistoryCandle,
} from '../types/index';

// 配置常量
const SYMBOL = 'BTC-USDT';
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
 * @param startPrice - 可选起始价格，用于从历史数据继续
 */
function startGeneration(_interval: number, startPrice?: number): void {
  stopGeneration();

  // 重置状态（如果提供了起始价格则使用，否则用默认值）
  if (startPrice !== undefined && startPrice > 0) {
    currentPrice = startPrice;
  } else {
    currentPrice = BASE_PRICE;
  }
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

// ============================================
// 历史 K 线生成算法
// ============================================

/**
 * 将时间戳对齐到指定周期的起始点
 * @param timestamp - 时间戳 (毫秒)
 * @param intervalMs - 周期时长 (毫秒)
 */
function alignTimestamp(timestamp: number, intervalMs: number): number {
  return Math.floor(timestamp / intervalMs) * intervalMs;
}

// ============================================================================
// 市场状态机类型定义
// ============================================================================

/** 市场阶段 */
type MarketPhase = 'BULL_RUN' | 'BEAR_RUN' | 'CONSOLIDATION';

/** 市场情绪 */
type MarketSentiment = 'PANIC' | 'FOMO' | 'CALM' | 'EUPHORIA' | 'CAPITULATION';

/** 量价模式 */
type VolumePattern =
  | 'SHRINK_UP' // 缩量上涨 - 健康上涨，惜售
  | 'SHRINK_DOWN' // 缩量下跌 - 动能衰竭
  | 'EXPAND_UP' // 放量上涨 - FOMO突破
  | 'EXPAND_DOWN' // 放量下跌 - 恐慌抛售
  | 'SHRINK_FLAT'; // 缩量横盘 - 观望

/** 市场状态 */
interface MarketState {
  phase: MarketPhase;
  sentiment: MarketSentiment;
  phaseProgress: number; // 当前阶段进度 0-1
  phaseDuration: number; // 阶段持续 K 线数
  phaseCounter: number; // 阶段计数器
  momentum: number; // 动量 -1 到 1
  avgVolume: number; // 平均成交量基准
  currentPrice: number; // 当前价格（用于均值回归）
  basePrice: number; // 基准价格（均值回归目标）
}

/**
 * 生成历史 K 线数据
 *
 * 算法特点：
 * 1. 市场阶段状态机：单边上涨、单边下跌、横盘震荡
 * 2. 情绪模拟：恐慌(Panic)、FOMO、平静(Calm)、狂热(Euphoria)、投降(Capitulation)
 * 3. 量价关系：缩量上涨、缩量下跌、放量上涨、放量下跌、缩量横盘
 * 4. 真实 K 线形态：长上影、长下影、十字星、大阳线、大阴线
 *
 * @param timeframeSeconds - 时间周期 (秒)
 * @param count - K 线数量
 * @returns 历史 K 线数组 (时间升序)
 */
function generateHistoricalCandles(
  timeframeSeconds: number,
  count: number,
): HistoryCandle[] {
  const intervalMs = timeframeSeconds * 1000;
  const now = Date.now();
  const alignedNow = alignTimestamp(now, intervalMs);
  const startTime = alignedNow - count * intervalMs;

  const candles: HistoryCandle[] = [];
  let price = BASE_PRICE;

  // 初始化市场状态
  const state: MarketState = {
    phase: 'CONSOLIDATION',
    sentiment: 'CALM',
    phaseProgress: 0,
    phaseDuration: 60 + Math.floor(Math.random() * 120), // 60-180 根 K 线
    phaseCounter: 0,
    momentum: 0,
    avgVolume: 2000,
    currentPrice: BASE_PRICE,
    basePrice: BASE_PRICE,
  };

  for (let i = 0; i < count; i++) {
    const candleTime = startTime + i * intervalMs;

    // 更新市场状态
    updateMarketState(state, price);

    // 更新当前价格到状态
    state.currentPrice = price;

    // 根据市场状态生成 K 线
    const candle = generateCandleFromState(state, price, candleTime);
    candles.push(candle);

    // 下一根 K 线的开盘价 = 当前收盘价
    price = candle.close;
  }

  // 同步全局价格状态
  if (candles.length > 0) {
    currentPrice = candles[candles.length - 1].close;
  }

  return candles;
}

/**
 * 更新市场状态机
 */
function updateMarketState(state: MarketState, _price: number): void {
  state.phaseCounter++;
  state.phaseProgress = state.phaseCounter / state.phaseDuration;

  // 阶段结束，切换到新阶段
  if (state.phaseCounter >= state.phaseDuration) {
    transitionPhase(state);
  }

  // 随机情绪事件（5% 概率触发极端情绪）
  if (Math.random() < 0.05) {
    triggerSentimentEvent(state);
  }

  // 情绪自然衰减回归平静
  if (state.sentiment !== 'CALM' && Math.random() < 0.1) {
    state.sentiment = 'CALM';
  }

  // 更新动量（平滑过渡）
  const targetMomentum = getTargetMomentum(state);
  state.momentum = state.momentum * 0.9 + targetMomentum * 0.1;
}

/**
 * 阶段转换逻辑
 */
function transitionPhase(state: MarketState): void {
  const rand = Math.random();
  const prevPhase = state.phase;

  // 基于当前阶段的转换概率
  if (prevPhase === 'CONSOLIDATION') {
    // 横盘后：40% 上涨，40% 下跌，20% 继续横盘
    if (rand < 0.4) state.phase = 'BULL_RUN';
    else if (rand < 0.8) state.phase = 'BEAR_RUN';
    else state.phase = 'CONSOLIDATION';
  } else if (prevPhase === 'BULL_RUN') {
    // 上涨后：30% 继续涨，40% 横盘，30% 下跌
    if (rand < 0.3) state.phase = 'BULL_RUN';
    else if (rand < 0.7) state.phase = 'CONSOLIDATION';
    else state.phase = 'BEAR_RUN';
  } else {
    // 下跌后：30% 继续跌，40% 横盘，30% 上涨
    if (rand < 0.3) state.phase = 'BEAR_RUN';
    else if (rand < 0.7) state.phase = 'CONSOLIDATION';
    else state.phase = 'BULL_RUN';
  }

  // 重置阶段计数器
  state.phaseCounter = 0;
  state.phaseDuration = getPhaseDuration(state.phase);
}

/**
 * 获取阶段持续时间
 */
function getPhaseDuration(phase: MarketPhase): number {
  switch (phase) {
    case 'BULL_RUN':
      return 30 + Math.floor(Math.random() * 90); // 30-120 根
    case 'BEAR_RUN':
      return 20 + Math.floor(Math.random() * 60); // 20-80 根（熊市通常更短更急）
    case 'CONSOLIDATION':
      return 60 + Math.floor(Math.random() * 120); // 60-180 根
  }
}

/**
 * 触发情绪事件
 */
function triggerSentimentEvent(state: MarketState): void {
  const rand = Math.random();

  if (state.phase === 'BULL_RUN') {
    // 牛市中：可能触发 FOMO 或 狂热
    state.sentiment = rand < 0.6 ? 'FOMO' : 'EUPHORIA';
  } else if (state.phase === 'BEAR_RUN') {
    // 熊市中：可能触发 恐慌 或 投降
    state.sentiment = rand < 0.6 ? 'PANIC' : 'CAPITULATION';
  } else {
    // 横盘中：偶尔小恐慌或小FOMO
    state.sentiment = rand < 0.5 ? 'PANIC' : 'FOMO';
  }
}

/**
 * 获取目标动量
 */
function getTargetMomentum(state: MarketState): number {
  let base = 0;

  // 基于阶段的基础动量
  switch (state.phase) {
    case 'BULL_RUN':
      base = 0.3 + Math.random() * 0.4; // 0.3-0.7
      break;
    case 'BEAR_RUN':
      base = -0.3 - Math.random() * 0.4; // -0.3 到 -0.7
      break;
    case 'CONSOLIDATION':
      base = (Math.random() - 0.5) * 0.2; // -0.1 到 0.1
      break;
  }

  // 情绪修正
  switch (state.sentiment) {
    case 'FOMO':
      base += 0.3;
      break;
    case 'EUPHORIA':
      base += 0.5;
      break;
    case 'PANIC':
      base -= 0.3;
      break;
    case 'CAPITULATION':
      base -= 0.5;
      break;
  }

  return Math.max(-1, Math.min(1, base));
}

/**
 * 根据市场状态生成 K 线
 */
function generateCandleFromState(
  state: MarketState,
  openPrice: number,
  time: number,
): HistoryCandle {
  // 确定量价模式
  const volumePattern = determineVolumePattern(state);

  // 计算价格变动
  const { changePercent, volatility } = calculatePriceChange(
    state,
    volumePattern,
  );

  const open = openPrice;
  const close = open * (1 + changePercent);

  // 生成 K 线形态
  const { high, low } = generateCandleShape(
    open,
    close,
    volatility,
    state.sentiment,
  );

  // 生成成交量
  const volume = generateVolume(state, volumePattern, Math.abs(changePercent));

  return {
    time,
    open: Math.round(open * 100) / 100,
    high: Math.round(high * 100) / 100,
    low: Math.round(low * 100) / 100,
    close: Math.round(close * 100) / 100,
    volume: Math.round(volume * 100) / 100,
    tickCount: 1,
  };
}

/**
 * 确定量价模式
 */
function determineVolumePattern(state: MarketState): VolumePattern {
  const { phase, sentiment, phaseProgress } = state;

  // 极端情绪时的量价模式
  if (sentiment === 'PANIC' || sentiment === 'CAPITULATION') {
    return 'EXPAND_DOWN'; // 恐慌放量下跌
  }
  if (sentiment === 'FOMO' || sentiment === 'EUPHORIA') {
    return 'EXPAND_UP'; // FOMO放量上涨
  }

  // 基于阶段和进度的量价模式
  if (phase === 'BULL_RUN') {
    // 牛市初期：放量启动，中期：缩量上涨（健康），末期：放量冲顶
    if (phaseProgress < 0.2) return 'EXPAND_UP';
    if (phaseProgress < 0.8) return 'SHRINK_UP';
    return 'EXPAND_UP';
  }

  if (phase === 'BEAR_RUN') {
    // 熊市初期：放量下跌，中期：缩量阴跌，末期：放量恐慌
    if (phaseProgress < 0.2) return 'EXPAND_DOWN';
    if (phaseProgress < 0.8) return 'SHRINK_DOWN';
    return 'EXPAND_DOWN';
  }

  // 横盘：缩量震荡
  return 'SHRINK_FLAT';
}

/**
 * 计算价格变动
 */
function calculatePriceChange(
  state: MarketState,
  pattern: VolumePattern,
): { changePercent: number; volatility: number } {
  const { momentum, sentiment, currentPrice, basePrice } = state;

  // 基础波动率（降低到 0.1%，更符合 1m K 线）
  let volatility = 0.001;

  // 根据情绪调整波动率
  switch (sentiment) {
    case 'PANIC':
    case 'CAPITULATION':
      volatility *= 2.5; // 恐慌时波动放大
      break;
    case 'FOMO':
    case 'EUPHORIA':
      volatility *= 2; // FOMO 时波动放大
      break;
  }

  // 根据量价模式调整
  if (pattern === 'SHRINK_FLAT') {
    volatility *= 0.5; // 横盘时波动减小
  }

  // 计算变动：动量 + 随机
  const randomComponent = (Math.random() - 0.5) * 2 * volatility;
  const momentumComponent = momentum * volatility * 0.3;
  let changePercent = randomComponent + momentumComponent;

  // 均值回归：价格偏离基准越远，回归力越强
  const deviation = (currentPrice - basePrice) / basePrice; // 偏离百分比
  const maxDeviation = 0.5; // 最大允许偏离 50%
  if (Math.abs(deviation) > 0.1) {
    // 偏离超过 10% 时开始回归
    const reversionStrength =
      Math.min(Math.abs(deviation) / maxDeviation, 1) * 0.002;
    changePercent -= deviation > 0 ? reversionStrength : -reversionStrength;
  }

  // 极端情绪时强制方向（但受均值回归限制）
  if (sentiment === 'PANIC' || sentiment === 'CAPITULATION') {
    changePercent = -Math.abs(changePercent) - volatility * 0.3;
  } else if (sentiment === 'FOMO' || sentiment === 'EUPHORIA') {
    changePercent = Math.abs(changePercent) + volatility * 0.3;
  }

  // 限制单根 K 线最大变动幅度
  const maxChange = 0.02; // 单根最大 2%
  changePercent = Math.max(-maxChange, Math.min(maxChange, changePercent));

  return { changePercent, volatility };
}

/**
 * 生成 K 线形态（上下影线）
 */
function generateCandleShape(
  open: number,
  close: number,
  volatility: number,
  sentiment: MarketSentiment,
): { high: number; low: number } {
  const body = Math.abs(close - open);
  const minShadow = open * volatility * 0.2;
  const baseRange = Math.max(body, minShadow);

  let upperShadowRatio = 0.3 + Math.random() * 0.7; // 上影线比例
  let lowerShadowRatio = 0.3 + Math.random() * 0.7; // 下影线比例

  // 根据情绪调整影线形态
  if (sentiment === 'PANIC') {
    // 恐慌：长上影（冲高回落）或长下影后继续跌
    upperShadowRatio *= 1.5;
    lowerShadowRatio *= 0.5;
  } else if (sentiment === 'FOMO') {
    // FOMO：长下影（探底回升）
    lowerShadowRatio *= 1.5;
    upperShadowRatio *= 0.5;
  } else if (sentiment === 'CAPITULATION') {
    // 投降：极长下影（恐慌抛售后反弹）
    lowerShadowRatio *= 2;
  }

  const high =
    Math.max(open, close) + baseRange * upperShadowRatio * Math.random();
  const low =
    Math.min(open, close) - baseRange * lowerShadowRatio * Math.random();

  return { high, low };
}

/**
 * 生成成交量
 */
function generateVolume(
  state: MarketState,
  pattern: VolumePattern,
  priceChangePercent: number,
): number {
  let baseVolume = state.avgVolume;
  let multiplier = 1;

  // 根据量价模式调整
  switch (pattern) {
    case 'EXPAND_UP':
    case 'EXPAND_DOWN':
      multiplier = 2 + Math.random() * 3; // 放量：2-5 倍
      break;
    case 'SHRINK_UP':
    case 'SHRINK_DOWN':
      multiplier = 0.3 + Math.random() * 0.4; // 缩量：0.3-0.7 倍
      break;
    case 'SHRINK_FLAT':
      multiplier = 0.2 + Math.random() * 0.3; // 横盘缩量：0.2-0.5 倍
      break;
  }

  // 极端情绪时成交量爆发
  if (
    state.sentiment === 'PANIC' ||
    state.sentiment === 'CAPITULATION' ||
    state.sentiment === 'EUPHORIA'
  ) {
    multiplier *= 1.5 + Math.random();
  }

  // 价格变动幅度影响成交量
  const priceImpact = 1 + Math.pow(priceChangePercent / 0.003, 1.2);

  // 随机大单（3% 概率）
  const bigOrder = Math.random() < 0.03 ? 3 + Math.random() * 5 : 1;

  return (
    baseVolume *
    multiplier *
    priceImpact *
    bigOrder *
    (0.8 + Math.random() * 0.4)
  );
}

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

// 监听主线程消息
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  switch (type) {
    case 'START': {
      const { interval, startPrice } = event.data.payload;
      // 传递起始价格到 startGeneration，确保实时数据从历史最后价格继续
      startGeneration(interval, startPrice);
      break;
    }
    case 'STOP': {
      stopGeneration();
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
