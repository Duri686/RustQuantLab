/**
 * 影线生成模块 (重构版)
 *
 * 核心原则：
 * 1. 波动率时间分形约束 - 不同周期K线振幅符合平方根法则
 * 2. 噪音影线与操纵影线分离 - 95%时间影线很短
 * 3. 流动性状态触发 - 只有特定条件下才允许长影线
 */

import type { MarketPhase, MarketState, LiquidityState } from '../types';
import {
  MAX_RANGE_1M,
  NORMAL_RANGE_1M,
  VOLATILITY_SCALE,
  NOISE_WICK_PROB,
  LOW_VOLUME_THRESHOLD,
  HIGH_VOLUME_THRESHOLD,
} from '../constants';

/**
 * 获取时间周期的波动率缩放因子
 */
export function getVolatilityScale(timeframeSeconds: number): number {
  const known = VOLATILITY_SCALE[timeframeSeconds as keyof typeof VOLATILITY_SCALE];
  if (known) return known;
  // 对于未知周期，使用平方根法则计算
  return Math.sqrt(timeframeSeconds / 60);
}

/**
 * 计算当前时间周期的最大允许振幅
 */
export function getMaxRange(timeframeSeconds: number, isLiquidityVacuum: boolean): number {
  const scale = getVolatilityScale(timeframeSeconds);
  const baseMax = isLiquidityVacuum ? MAX_RANGE_1M * 2 : MAX_RANGE_1M;
  return baseMax * scale;
}

/**
 * 计算当前时间周期的常规振幅
 */
export function getNormalRange(timeframeSeconds: number): number {
  const scale = getVolatilityScale(timeframeSeconds);
  return NORMAL_RANGE_1M * scale;
}

/**
 * 更新流动性状态
 * 基于成交量判断是否处于流动性真空
 */
export function updateLiquidityState(s: MarketState, currentVolume: number): void {
  const volumeRatio = currentVolume / s.avgVolume;

  if (volumeRatio < LOW_VOLUME_THRESHOLD) {
    s.liquidityState = 'VACUUM_LOW';
  } else if (volumeRatio > HIGH_VOLUME_THRESHOLD) {
    s.liquidityState = 'VACUUM_HIGH';
  } else {
    s.liquidityState = 'NORMAL';
  }
}

/**
 * 检查是否允许生成长影线
 * 只有在流动性真空状态下才允许
 */
export function canGenerateLongWick(liquidityState: LiquidityState): boolean {
  return liquidityState !== 'NORMAL';
}

/**
 * 生成上下影线 (重构版)
 *
 * 真实市场特征：
 * - 95% 时间：影线极短（噪音级），Open 和 Close 接近 High 和 Low
 * - 5% 时间：流动性真空时才出现长影线
 * - 不同时间周期：振幅符合平方根法则
 */
export function generateShadows(
  open: number,
  close: number,
  _volatility: number,
  phase: MarketPhase,
  timeframeSeconds: number = 60,
  liquidityState: LiquidityState = 'NORMAL',
): { high: number; low: number } {
  const body = Math.abs(close - open);
  const midPrice = (open + close) / 2;

  // 获取当前时间周期的振幅限制
  const normalRange = getNormalRange(timeframeSeconds);
  const maxAllowedRange = getMaxRange(timeframeSeconds, liquidityState !== 'NORMAL');

  // 计算当前实体已占用的振幅
  const bodyRange = body / midPrice;

  let upperShadow: number;
  let lowerShadow: number;

  const rand = Math.random();
  const allowLongWick = canGenerateLongWick(liquidityState);

  if (rand < NOISE_WICK_PROB && !allowLongWick) {
    // =========================================
    // 95% 概率：噪音影线 (极短)
    // =========================================
    // 影线长度受实体大小和正态分布限制
    // 大部分K线是实体饱满的小K线

    if (rand < 0.70) {
      // 70%：几乎无影线 (纯实体)
      upperShadow = body * Math.random() * 0.02;
      lowerShadow = body * Math.random() * 0.02;
    } else if (rand < 0.90) {
      // 20%：微小影线
      upperShadow = body * (0.02 + Math.random() * 0.05);
      lowerShadow = body * (0.02 + Math.random() * 0.05);
    } else {
      // 5%：短影线
      upperShadow = body * (0.05 + Math.random() * 0.10);
      lowerShadow = body * (0.05 + Math.random() * 0.10);
    }
  } else {
    // =========================================
    // 5% 概率或流动性真空：允许较长影线
    // =========================================
    // 只有成交量极低或极高时才会出现

    if (liquidityState === 'VACUUM_LOW') {
      // 流动性真空（成交量极低）：订单簿被击穿
      // 影线可以较长，但仍受时间周期限制
      const wickMultiplier = 0.3 + Math.random() * 0.4;
      if (Math.random() < 0.5) {
        upperShadow = midPrice * normalRange * wickMultiplier;
        lowerShadow = body * Math.random() * 0.05;
      } else {
        lowerShadow = midPrice * normalRange * wickMultiplier;
        upperShadow = body * Math.random() * 0.05;
      }
    } else if (liquidityState === 'VACUUM_HIGH') {
      // 流动性冲击（成交量极高）：爆仓连环触发
      // 通常是单边长影线
      const wickMultiplier = 0.5 + Math.random() * 0.5;
      if (Math.random() < 0.5) {
        upperShadow = midPrice * normalRange * wickMultiplier * 1.5;
        lowerShadow = body * Math.random() * 0.03;
      } else {
        lowerShadow = midPrice * normalRange * wickMultiplier * 1.5;
        upperShadow = body * Math.random() * 0.03;
      }
    } else {
      // 常规的稀有长影线（特殊形态）
      const wickMultiplier = 0.15 + Math.random() * 0.20;
      if (Math.random() < 0.5) {
        upperShadow = body * wickMultiplier * 3;
        lowerShadow = body * Math.random() * 0.05;
      } else {
        lowerShadow = body * wickMultiplier * 3;
        upperShadow = body * Math.random() * 0.05;
      }
    }
  }

  // 根据市场阶段微调
  switch (phase) {
    case 'MARKUP':
      // 上涨趋势：影线更短，实体更饱满
      upperShadow *= 0.6;
      lowerShadow *= 0.7;
      break;
    case 'MARKDOWN':
      // 下跌趋势：影线更短，恐慌出逃
      upperShadow *= 0.7;
      lowerShadow *= 0.6;
      break;
    case 'ACCUMULATION':
      // 吸筹：略增下影线
      lowerShadow *= 1.05;
      break;
    case 'DISTRIBUTION':
      // 派发：略增上影线
      upperShadow *= 1.05;
      break;
  }

  // =========================================
  // 强制约束：确保总振幅不超过时间周期限制
  // =========================================
  const high = Math.max(open, close) + upperShadow;
  const low = Math.min(open, close) - lowerShadow;
  const totalRange = (high - low) / midPrice;

  if (totalRange > maxAllowedRange) {
    // 按比例缩放影线，保持总振幅在限制内
    const scaleFactor = (maxAllowedRange - bodyRange) / (totalRange - bodyRange);
    upperShadow *= Math.max(0, scaleFactor);
    lowerShadow *= Math.max(0, scaleFactor);
  }

  return {
    high: Math.max(open, close) + upperShadow,
    low: Math.min(open, close) - lowerShadow,
  };
}

/**
 * 技术指标响应
 */
export function applyTechnicalResponse(
  s: MarketState,
  price: number,
  change: number,
): number {
  const { indicators } = s;

  // MA20 支撑/阻力
  const distToMA20 = (price - indicators.ma20) / price;
  if (Math.abs(distToMA20) < 0.002) {
    // 接近 MA20 时减速
    change *= 0.5;
    // 80% 概率反弹
    if (Math.random() < 0.8) {
      change = Math.abs(change) * (distToMA20 > 0 ? 1 : -1) * -0.5;
    }
  }

  // MA50 支撑/阻力（更强）
  const distToMA50 = (price - indicators.ma50) / price;
  if (Math.abs(distToMA50) < 0.003) {
    change *= 0.3;
    if (Math.random() < 0.85) {
      change = Math.abs(change) * (distToMA50 > 0 ? 1 : -1) * -0.7;
    }
  }

  // 布林带反弹
  if (price > indicators.bollUpper * 0.998) {
    change = -Math.abs(change) * 0.8; // 上轨压力
  } else if (price < indicators.bollLower * 1.002) {
    change = Math.abs(change) * 0.8; // 下轨支撑
  }

  return change;
}
