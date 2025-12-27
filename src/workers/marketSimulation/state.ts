/**
 * 市场状态管理模块
 */

import type { MarketState } from './types';
import { BASE_PRICE } from './constants';

/** 全局状态实例 */
let state: MarketState | null = null;

/** 调度器状态 */
let timeoutId: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

/**
 * 获取当前状态（如未初始化则抛出异常）
 */
export function getState(): MarketState {
  if (!state) {
    throw new Error('MarketState not initialized');
  }
  return state;
}

/**
 * 获取当前状态（可能为 null）
 */
export function getStateOrNull(): MarketState | null {
  return state;
}

/**
 * 初始化市场状态
 */
export function initializeState(startPrice?: number): MarketState {
  const price = startPrice && startPrice > 0 ? startPrice : BASE_PRICE;

  state = {
    phase: 'ACCUMULATION',
    phaseProgress: 0,
    phaseDuration: 500 + Math.floor(Math.random() * 1000),
    phaseCounter: 0,

    currentEvent: 'NONE',
    eventProgress: 0,
    eventDuration: 0,

    bartStage: 'NONE',
    bartStartPrice: 0,
    bartTargetPrice: 0,
    bartStageProgress: 0,
    bartStageDuration: 0,

    // 微观趋势状态初始化
    microTrend: {
      phase: 'NONE',
      direction: 1,
      targetAmplitude: 0,
      accumulatedMove: 0,
      phaseProgress: 0,
      phaseDuration: 0,
      phaseIndex: 0,
      startPrice: 0,
      extremePrice: 0,
    },

    currentPrice: price,
    basePrice: price,
    momentum: 0,
    volatilityMultiplier: 1,
    lastPriceDirection: 0,

    volumeMode: 'NORMAL',
    avgVolume: 2000,
    liquidityState: 'NORMAL',

    indicators: {
      ma20: price,
      ma50: price,
      bollUpper: price * 1.02,
      bollMid: price,
      bollLower: price * 0.98,
      recentHigh: price * 1.01,
      recentLow: price * 0.99,
      rangeHigh: price * 1.015,
      rangeLow: price * 0.985,
    },

    priceHistory: [price],
  };

  return state;
}

/**
 * 设置状态（用于外部模块更新）
 */
export function setState(newState: MarketState): void {
  state = newState;
}

/**
 * 重置状态
 */
export function resetState(): void {
  state = null;
}

// ============================================================================
// 调度器状态管理
// ============================================================================

export function getTimeoutId(): ReturnType<typeof setTimeout> | null {
  return timeoutId;
}

export function setTimeoutId(id: ReturnType<typeof setTimeout> | null): void {
  timeoutId = id;
}

export function getIsRunning(): boolean {
  return isRunning;
}

export function setIsRunning(running: boolean): void {
  isRunning = running;
}

