/**
 * K 线核心生成器 (重构版)
 *
 * 核心改进：
 * 1. 价格惯性与反转阻力 - 减少上下翻飞的毛刺
 * 2. 波动率时间分形约束 - 不同周期振幅符合平方根法则
 * 3. 流动性状态感知 - 影响影线和波动率
 */

import type { HistoryCandle } from '../../../types/index';
import type { CandleResult, MarketState } from '../types';
import { round2, fatTailRandom, updateIndicators } from '../utils';
import { updatePhase } from '../wyckoff';
import {
  shouldTriggerEvent,
  initializeEvent,
  generateManipulationCandle,
} from '../manipulation';
import {
  generateShadows,
  applyTechnicalResponse,
  updateLiquidityState,
  getNormalRange,
} from './shadows';
import { generateVolume, updateVolatilityAndVolumeMode } from './volume';
import {
  MOMENTUM_DECAY,
  INERTIA_STRENGTH,
  MAX_TICK_JUMP,
  MAX_RANGE_1M,
} from '../constants';

/**
 * 应用价格惯性
 * 如果上一根K线是涨的，这一根继续涨的概率略高
 */
function applyPriceInertia(
  s: MarketState,
  baseChange: number,
): number {
  const { lastPriceDirection, momentum } = s;

  // 当前变化的方向
  const currentDirection = baseChange > 0 ? 1 : baseChange < 0 ? -1 : 0;

  // 如果方向与上一根相同，增强效果
  if (lastPriceDirection !== 0 && currentDirection === lastPriceDirection) {
    // 同向惯性增强
    return baseChange * (1 + INERTIA_STRENGTH * Math.abs(momentum));
  }

  // 如果方向与上一根相反，需要克服惯性阻力
  if (lastPriceDirection !== 0 && currentDirection !== 0 && currentDirection !== lastPriceDirection) {
    // 反向阻力
    const resistance = INERTIA_STRENGTH * Math.abs(momentum) * 0.5;
    return baseChange * (1 - resistance);
  }

  return baseChange;
}

/**
 * 限制单根K线的最大变化幅度
 */
function clampPriceChange(
  change: number,
  timeframeSeconds: number,
  isExtremeEvent: boolean,
): number {
  // 计算当前周期允许的最大变化
  const scale = Math.sqrt(timeframeSeconds / 60);
  const maxChange = isExtremeEvent ? MAX_RANGE_1M * scale * 1.5 : MAX_RANGE_1M * scale * 0.7;

  return Math.max(-maxChange, Math.min(maxChange, change));
}

/**
 * 生成正常市场 K 线
 */
export function generateNormalCandle(
  s: MarketState,
  open: number,
  timeframeSeconds: number,
): CandleResult {
  const { phase, phaseProgress, momentum, volatilityMultiplier, liquidityState } = s;
  const dtScale = Math.sqrt(timeframeSeconds / 60);

  // 获取当前周期的正常振幅范围
  const normalRange = getNormalRange(timeframeSeconds);

  // 基础波动率 - 大幅降低以产生更真实的小振幅K线
  let baseVol = normalRange * 0.3 * volatilityMultiplier;

  // 根据阶段调整动量和波动率
  let drift = 0;
  switch (phase) {
    case 'ACCUMULATION':
      drift = 0.0001 * dtScale; // 微弱上涨倾向
      baseVol *= 0.6; // 低波动
      break;

    case 'MARKUP': {
      // 爬楼梯上涨，末期加速（抛物线效应）
      const markupAcceleration = 1 + Math.pow(phaseProgress, 2) * 1.5;
      drift = 0.0005 * dtScale * markupAcceleration;
      baseVol *= 0.7 + phaseProgress * 0.3; // 波动率递增但受控
      break;
    }

    case 'DISTRIBUTION':
      drift = -0.0001 * dtScale; // 微弱下跌倾向
      baseVol *= 0.7;
      break;

    case 'MARKDOWN': {
      // 电梯下跌，快速且连续
      const markdownSpeed = 1 + phaseProgress * 1.2;
      drift = -0.001 * dtScale * markdownSpeed;
      baseVol *= 1.2 + phaseProgress * 0.5; // 高波动但仍受控
      break;
    }
  }

  // 加入动量和随机项 (使用较小的厚尾分布)
  const random = fatTailRandom() * baseVol;
  const momentumEffect = momentum * 0.0002 * dtScale;
  let changePercent = drift + random + momentumEffect;

  // 应用价格惯性
  changePercent = applyPriceInertia(s, changePercent);

  // 技术指标响应 (80% 遵循规则)
  if (Math.random() < 0.8) {
    changePercent = applyTechnicalResponse(s, open, changePercent);
  }

  // 均值回归 - 防止价格偏离基准价格太远
  const deviation = (open - s.basePrice) / s.basePrice;
  if (Math.abs(deviation) > 0.05) {
    // 偏离超过5%时，产生回归力
    const reversionForce = deviation * 0.3; // 回归强度
    changePercent -= reversionForce * dtScale;
  }
  
  // 价格保护：防止价格偏离基准价格超过50%
  const maxDeviation = 0.5; // 最大偏离50%
  if (Math.abs(deviation) > maxDeviation) {
    // 如果偏离过大，强制回归
    const forcedReversion = -deviation * 0.5;
    changePercent = forcedReversion * dtScale;
  }

  // 限制单根K线的最大变化幅度
  const isExtreme = liquidityState !== 'NORMAL' || s.currentEvent !== 'NONE';
  changePercent = clampPriceChange(changePercent, timeframeSeconds, isExtreme);

  // 计算收盘价
  const close = open * (1 + changePercent);

  // 生成成交量（先生成，用于判断流动性状态）
  const volume = generateVolume(s, Math.abs(changePercent), phase);

  // 更新流动性状态
  updateLiquidityState(s, volume);

  // 生成上下影线 (传入时间周期和流动性状态)
  const { high, low } = generateShadows(
    open,
    close,
    baseVol,
    phase,
    timeframeSeconds,
    s.liquidityState,
  );

  // 更新动量 (使用衰减系数)
  s.momentum = s.momentum * MOMENTUM_DECAY + changePercent * 80;
  s.momentum = Math.max(-1, Math.min(1, s.momentum));

  // 更新价格方向
  s.lastPriceDirection = changePercent > 0.00001 ? 1 : changePercent < -0.00001 ? -1 : 0;

  return { close, high, low, volume };
}

/**
 * 从状态生成完整 K 线
 */
export function generateCandleFromState(
  s: MarketState,
  time: number,
  timeframeSeconds: number,
): HistoryCandle {
  const open = s.currentPrice;
  let close: number;
  let high: number;
  let low: number;
  let volume: number;

  // 1. 检查并触发操纵事件
  if (s.currentEvent === 'NONE') {
    const newEvent = shouldTriggerEvent(s);
    if (newEvent !== 'NONE') {
      initializeEvent(s, newEvent);
    }
  }

  // 2. 根据当前状态生成 K 线
  if (s.currentEvent !== 'NONE') {
    // 操纵事件模式 (微观趋势展开)
    const result = generateManipulationCandle(
      s,
      open,
      timeframeSeconds,
      generateNormalCandle,
    );
    close = result.close;
    high = result.high;
    low = result.low;
    volume = result.volume;

    // 更新事件进度
    s.eventProgress++;
    if (s.eventProgress >= s.eventDuration) {
      s.currentEvent = 'NONE';
      s.bartStage = 'NONE';
      // 重置微观趋势状态
      s.microTrend.phase = 'NONE';
    }
  } else {
    // 正常市场模式
    const result = generateNormalCandle(s, open, timeframeSeconds);
    close = result.close;
    high = result.high;
    low = result.low;
    volume = result.volume;
  }

  // 3. 更新状态
  s.currentPrice = close;
  s.priceHistory.push(close);
  if (s.priceHistory.length > 200) {
    s.priceHistory.shift();
  }
  updateIndicators(s);
  updatePhase(s, timeframeSeconds);

  // 4. 更新波动率和成交量模式
  updateVolatilityAndVolumeMode(s);

  return {
    time,
    open: round2(open),
    high: round2(high),
    low: round2(low),
    close: round2(close),
    volume: round2(volume),
    tickCount: 1,
  };
}
