/**
 * 实时订单簿生成
 */

import type { OrderBook } from '../../types/index';
import { getState } from './state';
import { SYMBOL, LEVELS } from './constants';
import { round2, fatTailRandom } from './utils';
import { getNextPhase, getPhaseDuration } from './wyckoff';

/** 最小价格限制，防止负数或过小的价格 */
const MIN_PRICE = 0.01;

/**
 * 生成订单簿数据
 */
export function generateOrderBook(): OrderBook {
  const state = getState();

  // 更新状态并生成新价格
  const timeframeSeconds = 1; // 实时 tick 按 1 秒处理
  const prevPrice = state.currentPrice;

  // 简化版价格更新（不生成完整K线）
  const dtScale = Math.sqrt(timeframeSeconds / 60);
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
  
  // 价格保护：确保价格不会变成负数或过小
  if (state.currentPrice < MIN_PRICE) {
    state.currentPrice = Math.max(MIN_PRICE, prevPrice * 0.99); // 最多下跌 1%
  }

  // 更新动量
  state.momentum = state.momentum * 0.98 + changePercent * 50;
  state.momentum = Math.max(-1, Math.min(1, state.momentum));

  // 阶段更新（简化版）
  state.phaseCounter++;
  if (state.phaseCounter >= state.phaseDuration * 60) {
    // 转换为秒
    state.phase = getNextPhase(state.phase);
    state.phaseCounter = 0;
    state.phaseDuration = getPhaseDuration(state.phase, 60);
  }

  // 生成订单簿
  const bids: [number, number][] = [];
  const asks: [number, number][] = [];

  // 确保当前价格不低于最小价格
  const currentPrice = Math.max(state.currentPrice, MIN_PRICE);

  // 使用百分比 spread，适应不同价格水平
  // 每层 spread: 0.05% - 0.3%，累加后最多约 15% 的深度
  let bidSpreadPercent = 0;
  let askSpreadPercent = 0;

  for (let i = 0; i < LEVELS; i++) {
    const depthMultiplier = 1 + i * 0.15;
    const baseQty = Math.floor(Math.random() * 99) + 1;

    // 百分比 spread，每层增加 0.05% - 0.3%
    bidSpreadPercent += (0.0005 + Math.random() * 0.0025);
    const bidPrice = currentPrice * (1 - bidSpreadPercent);
    
    // 确保买单价格不低于最小价格，且低于当前价格
    const safeBidPrice = Math.max(MIN_PRICE, Math.min(bidPrice, currentPrice * 0.999));
    bids.push([round2(safeBidPrice), Math.round(baseQty * depthMultiplier)]);

    askSpreadPercent += (0.0005 + Math.random() * 0.0025);
    const askPrice = currentPrice * (1 + askSpreadPercent);
    
    // 确保卖单价格高于当前价格
    const safeAskPrice = Math.max(askPrice, currentPrice * 1.001);
    asks.push([round2(safeAskPrice), Math.round(baseQty * depthMultiplier)]);
  }

  bids.sort((a, b) => b[0] - a[0]);
  asks.sort((a, b) => a[0] - b[0]);

  return {
    symbol: SYMBOL,
    timestamp: Date.now(),
    price: round2(currentPrice),
    bids,
    asks,
  };
}

