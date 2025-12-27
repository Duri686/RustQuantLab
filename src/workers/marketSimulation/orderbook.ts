/**
 * 实时订单簿生成
 */

import type { OrderBook } from '../../types/index';
import { getState } from './state';
import { SYMBOL, LEVELS } from './constants';
import { round2, fatTailRandom } from './utils';
import { getNextPhase, getPhaseDuration } from './wyckoff';

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

  let bidSpread = 0;
  let askSpread = 0;

  for (let i = 0; i < LEVELS; i++) {
    const depthMultiplier = 1 + i * 0.15;
    const baseQty = Math.floor(Math.random() * 99) + 1;

    bidSpread += 0.01 + Math.random() * 0.49;
    const bidPrice = state.currentPrice - bidSpread;
    bids.push([round2(bidPrice), Math.round(baseQty * depthMultiplier)]);

    askSpread += 0.01 + Math.random() * 0.49;
    const askPrice = state.currentPrice + askSpread;
    asks.push([round2(askPrice), Math.round(baseQty * depthMultiplier)]);
  }

  bids.sort((a, b) => b[0] - a[0]);
  asks.sort((a, b) => a[0] - b[0]);

  return {
    symbol: SYMBOL,
    timestamp: Date.now(),
    price: round2(state.currentPrice),
    bids,
    asks,
  };
}

