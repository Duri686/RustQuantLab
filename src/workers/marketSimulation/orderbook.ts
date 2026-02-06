/**
 * 持久化订单簿模拟
 *
 * 核心设计: "贪吃蛇" 效果
 * 1. 订单簿在 tick 之间保持状态 (持久化)
 * 2. 价格移动时撮合消耗对手方订单 (吃单)
 * 3. 吃掉的量转化为跟风盘 (流动性流转)
 * 4. 多空力量随 Wyckoff 阶段动态变化 (搏杀)
 * 5. 现有挂单持续微变 + 新单随机注入 (有机呼吸)
 */

import type { OrderBook } from '../../types/index';
import { getState } from './state';
import { SYMBOL, LEVELS } from './constants';
import { round2, fatTailRandom } from './utils';
import { getNextPhase, getPhaseDuration } from './wyckoff';
import type { MarketPhase } from './types';

const MIN_PRICE = 0.01;

/* ============================================================================
   持久化订单簿状态
   ============================================================================ */

/** 买单 [price, qty][], 按 price DESC 排列 */
let bookBids: [number, number][] = [];
/** 卖单 [price, qty][], 按 price ASC 排列 */
let bookAsks: [number, number][] = [];
/** 订单簿是否已初始化 */
let bookReady = false;

/* ============================================================================
   初始化 / 重置
   ============================================================================ */

/**
 * 首次构建订单簿: 围绕 midPrice 生成对称深度
 */
function initBook(midPrice: number): void {
  bookBids = [];
  bookAsks = [];

  let bidOff = 0;
  let askOff = 0;

  for (let i = 0; i < LEVELS; i++) {
    // 紧密 spread: 近端 ~$3-8, 远端逐层加宽
    const step = midPrice * (0.00003 + Math.random() * 0.00005 + i * 0.000015);
    bidOff += step;
    askOff += step;

    // 深层量更大 (模拟真实订单簿)，但增长更平缓
    const depth = 1 + i * 0.15;
    const baseQty = 30 + Math.random() * 40; // 更窄的随机区间 → 更稳定
    bookBids.push([round2(midPrice - bidOff), Math.round(baseQty * depth)]);
    bookAsks.push([round2(midPrice + askOff), Math.round(baseQty * depth)]);
  }

  bookReady = true;
}

/**
 * 重置订单簿 (数据源重启时调用)
 */
export function resetBook(): void {
  bookBids = [];
  bookAsks = [];
  bookReady = false;
}

/* ============================================================================
   辅助: 插入/合并挂单
   ============================================================================ */

/** 价格匹配精度: 小于此差值视为同一 level */
const PRICE_EPS = 0.005;

function mergeBid(price: number, qty: number): void {
  const rp = round2(price);
  const idx = bookBids.findIndex(([p]) => Math.abs(p - rp) < PRICE_EPS);
  if (idx >= 0) {
    bookBids[idx][1] += qty;
  } else {
    bookBids.push([rp, qty]);
  }
}

function mergeAsk(price: number, qty: number): void {
  const rp = round2(price);
  const idx = bookAsks.findIndex(([p]) => Math.abs(p - rp) < PRICE_EPS);
  if (idx >= 0) {
    bookAsks[idx][1] += qty;
  } else {
    bookAsks.push([rp, qty]);
  }
}

/* ============================================================================
   核心: 订单簿演化 (每 tick 调用)
   ============================================================================ */

function evolveBook(
  prevPrice: number,
  newPrice: number,
  phase: MarketPhase,
  momentum: number,
): void {
  const delta = newPrice - prevPrice;

  /* ──────────────────────────────────────────
     STEP 1: 撮合消耗 (贪吃蛇核心)
     价格上涨 → 吃掉 best asks (买方侵蚀卖墙)
     价格下跌 → 吃掉 best bids (卖方侵蚀买墙)
     ────────────────────────────────────────── */
  if (delta > 0 && bookAsks.length > 0) {
    let totalEaten = 0;
    while (bookAsks.length > 0 && bookAsks[0][0] <= newPrice) {
      const qty = bookAsks[0][1];
      const eatRate = 0.5 + Math.random() * 0.5; // 吃掉 50-100%
      const eaten = Math.round(qty * eatRate);
      totalEaten += eaten;
      const rest = qty - eaten;
      if (rest <= 1) {
        bookAsks.shift(); // 整层吃完
      } else {
        bookAsks[0][1] = rest; // 部分消耗
        break;
      }
    }
    // 跟风买盘: 被吃掉的卖单转化为 best bid 附近的新买单
    if (totalEaten > 0) {
      const follow = Math.round(totalEaten * (0.3 + Math.random() * 0.4));
      mergeBid(newPrice * (1 - 0.00001 - Math.random() * 0.00003), follow);
    }
  } else if (delta < 0 && bookBids.length > 0) {
    let totalEaten = 0;
    while (bookBids.length > 0 && bookBids[0][0] >= newPrice) {
      const qty = bookBids[0][1];
      const eatRate = 0.5 + Math.random() * 0.5;
      const eaten = Math.round(qty * eatRate);
      totalEaten += eaten;
      const rest = qty - eaten;
      if (rest <= 1) {
        bookBids.shift();
      } else {
        bookBids[0][1] = rest;
        break;
      }
    }
    // 跟风卖盘
    if (totalEaten > 0) {
      const follow = Math.round(totalEaten * (0.3 + Math.random() * 0.4));
      mergeAsk(newPrice * (1 + 0.00001 + Math.random() * 0.00003), follow);
    }
  }

  /* ──────────────────────────────────────────
     STEP 2: 微观变化 (现有挂单有机呼吸)
     - 5% 概率: 量变 (±8%)
     - 0.5% 概率: 完全撤单
     ────────────────────────────────────────── */
  for (let i = bookBids.length - 1; i >= 0; i--) {
    if (Math.random() < 0.05) {
      const ch = bookBids[i][1] * ((Math.random() - 0.48) * 0.16);
      bookBids[i][1] = Math.max(1, Math.round(bookBids[i][1] + ch));
    }
    if (Math.random() < 0.005) bookBids.splice(i, 1);
  }
  for (let i = bookAsks.length - 1; i >= 0; i--) {
    if (Math.random() < 0.05) {
      const ch = bookAsks[i][1] * ((Math.random() - 0.48) * 0.16);
      bookAsks[i][1] = Math.max(1, Math.round(bookAsks[i][1] + ch));
    }
    if (Math.random() < 0.005) bookAsks.splice(i, 1);
  }

  /* ──────────────────────────────────────────
     STEP 3: 新挂单注入
     动量正 → 更多买单; 动量负 → 更多卖单
     ────────────────────────────────────────── */
  const numNew = 1 + Math.floor(Math.random() * 2);
  for (let n = 0; n < numNew; n++) {
    // 动量偏移: momentum > 0 更倾向买单
    const bidBias = 0.5 + momentum * 0.15;
    if (Math.random() < bidBias) {
      // 新买单
      const best = bookBids.length > 0 ? bookBids[0][0] : newPrice * 0.9999;
      const worst = bookBids.length >= LEVELS
        ? bookBids[LEVELS - 1][0]
        : newPrice * 0.95;
      const t = Math.random() ** 2; // 强偏向 best bid (更紧密)
      const p = best - t * (best - worst);
      const dist = Math.max(0, newPrice - p) / newPrice;
      mergeBid(p, Math.round((20 + Math.random() * 30) * (1 + dist * 20)));
    } else {
      // 新卖单
      const best = bookAsks.length > 0 ? bookAsks[0][0] : newPrice * 1.0001;
      const worst = bookAsks.length >= LEVELS
        ? bookAsks[LEVELS - 1][0]
        : newPrice * 1.05;
      const t = Math.random() ** 2;
      const p = best + t * (worst - best);
      const dist = Math.max(0, p - newPrice) / newPrice;
      mergeAsk(p, Math.round((20 + Math.random() * 30) * (1 + dist * 20)));
    }
  }

  /* ──────────────────────────────────────────
     STEP 4: 阶段压力 (多空搏杀)
     MARKUP   → 大买墙 + 薄卖墙 (买方碾压)
     MARKDOWN → 大卖墙 + 薄买墙 (卖方碾压)
     ACCUMULATION → 深层暗买 (大资金吸筹)
     DISTRIBUTION → 深层暗卖 (大资金出货)
     ────────────────────────────────────────── */
  switch (phase) {
    case 'MARKUP':
      // 买方增援: best bid 附近注入大单
      if (Math.random() < 0.2) {
        const p = newPrice * (1 - 0.00003 - Math.random() * 0.00015);
        mergeBid(p, Math.round(60 + Math.random() * 120));
      }
      // 卖墙磨损
      if (bookAsks.length > 2 && Math.random() < 0.12) {
        bookAsks[0][1] = Math.max(1, Math.round(bookAsks[0][1] * 0.7));
      }
      break;

    case 'MARKDOWN':
      // 卖方增援
      if (Math.random() < 0.2) {
        const p = newPrice * (1 + 0.00003 + Math.random() * 0.00015);
        mergeAsk(p, Math.round(60 + Math.random() * 120));
      }
      // 买墙磨损
      if (bookBids.length > 2 && Math.random() < 0.12) {
        bookBids[0][1] = Math.max(1, Math.round(bookBids[0][1] * 0.7));
      }
      break;

    case 'ACCUMULATION':
      // 深层暗买 (第 5-20 层)
      if (Math.random() < 0.15) {
        const idx = Math.min(5 + Math.floor(Math.random() * 15), bookBids.length - 1);
        if (idx >= 0 && bookBids[idx]) {
          bookBids[idx][1] += Math.round(20 + Math.random() * 60);
        }
      }
      break;

    case 'DISTRIBUTION':
      // 深层暗卖
      if (Math.random() < 0.15) {
        const idx = Math.min(5 + Math.floor(Math.random() * 15), bookAsks.length - 1);
        if (idx >= 0 && bookAsks[idx]) {
          bookAsks[idx][1] += Math.round(20 + Math.random() * 60);
        }
      }
      break;
  }

  /* ──────────────────────────────────────────
     STEP 5: 深度维护 (补充不足的层数)
     ────────────────────────────────────────── */
  // 确保 best bid/ask 紧贴 mid-price (spread 控制)
  if (bookBids.length === 0 || (newPrice - bookBids[0][0]) / newPrice > 0.0002) {
    const tightP = newPrice * (1 - 0.00002 - Math.random() * 0.00005);
    mergeBid(tightP, Math.round(25 + Math.random() * 35));
  }
  if (bookAsks.length === 0 || (bookAsks[0][0] - newPrice) / newPrice > 0.0002) {
    const tightP = newPrice * (1 + 0.00002 + Math.random() * 0.00005);
    mergeAsk(tightP, Math.round(25 + Math.random() * 35));
  }

  while (bookBids.length < LEVELS) {
    const lowest = bookBids.length > 0
      ? bookBids[bookBids.length - 1][0]
      : newPrice * 0.9999;
    const p = lowest * (1 - 0.0002 - Math.random() * 0.0005);
    const dist = Math.max(0, newPrice - p) / newPrice;
    mergeBid(p, Math.round((25 + Math.random() * 35) * (1 + dist * 20)));
  }
  while (bookAsks.length < LEVELS) {
    const highest = bookAsks.length > 0
      ? bookAsks[bookAsks.length - 1][0]
      : newPrice * 1.0001;
    const p = highest * (1 + 0.0002 + Math.random() * 0.0005);
    const dist = Math.max(0, p - newPrice) / newPrice;
    mergeAsk(p, Math.round((25 + Math.random() * 35) * (1 + dist * 20)));
  }

  /* ──────────────────────────────────────────
     STEP 6: 清理 & 排序 & 裁剪
     ────────────────────────────────────────── */
  bookBids = bookBids.filter(([p]) => p < newPrice && p > MIN_PRICE);
  bookAsks = bookAsks.filter(([p]) => p > newPrice);

  bookBids.sort((a, b) => b[0] - a[0]);
  bookAsks.sort((a, b) => a[0] - b[0]);

  if (bookBids.length > LEVELS) bookBids.length = LEVELS;
  if (bookAsks.length > LEVELS) bookAsks.length = LEVELS;
}

/* ============================================================================
   公共 API
   ============================================================================ */

/**
 * 生成订单簿数据 (每 tick 调用)
 */
export function generateOrderBook(): OrderBook {
  const state = getState();
  const prevPrice = state.currentPrice;

  // --- 价格更新 ---
  const dtScale = Math.sqrt(1 / 60);
  let baseVol = 0.0005 * dtScale * state.volatilityMultiplier;
  let drift = 0;

  switch (state.phase) {
    case 'MARKUP':
      drift = 0.0003 * dtScale * (1 + state.phaseProgress);
      break;
    case 'MARKDOWN':
      drift = -0.0008 * dtScale * (1 + state.phaseProgress * 0.5);
      baseVol *= 1.3;
      break;
    default:
      drift = (Math.random() - 0.5) * 0.0001 * dtScale;
  }

  const random = fatTailRandom() * baseVol;
  const changePercent = drift + random + state.momentum * 0.0001;
  state.currentPrice = prevPrice * (1 + changePercent);

  if (state.currentPrice < MIN_PRICE) {
    state.currentPrice = Math.max(MIN_PRICE, prevPrice * 0.99);
  }

  state.momentum = state.momentum * 0.98 + changePercent * 50;
  state.momentum = Math.max(-1, Math.min(1, state.momentum));

  // --- 阶段更新 ---
  state.phaseCounter++;
  if (state.phaseCounter >= state.phaseDuration * 60) {
    state.phase = getNextPhase(state.phase);
    state.phaseCounter = 0;
    state.phaseDuration = getPhaseDuration(state.phase, 60);
  }

  const currentPrice = Math.max(state.currentPrice, MIN_PRICE);

  // --- 订单簿: 首次初始化 or 增量演化 ---
  if (!bookReady) {
    initBook(currentPrice);
  } else {
    evolveBook(prevPrice, currentPrice, state.phase, state.momentum);
  }

  // 输出快照 (浅拷贝，避免外部修改内部状态)
  return {
    symbol: SYMBOL,
    timestamp: Date.now(),
    price: round2(currentPrice),
    bids: bookBids.map(([p, q]) => [p, q] as [number, number]),
    asks: bookAsks.map(([p, q]) => [p, q] as [number, number]),
  };
}

