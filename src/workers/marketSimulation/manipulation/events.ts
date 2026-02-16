/**
 * 市场操纵事件系统 (重构版)
 *
 * 核心改进：
 * 1. 插针事件现在触发微观趋势展开，而非瞬间完成
 * 2. 引入流动性状态作为触发条件
 * 3. 区分常规噪音和操纵性波动
 */

import type { ManipulationEvent, MarketState } from '../types';
import { initializeMicroTrend, calculateEventDuration } from './microTrend';

/**
 * 判断是否应触发操纵事件
 *
 * 重构逻辑：
 * - 大部分时间不触发任何事件（常规噪音）
 * - 只有在特定流动性/技术条件下才触发
 */
export function shouldTriggerEvent(s: MarketState): ManipulationEvent {
  if (s.currentEvent !== 'NONE') return s.currentEvent;

  const { indicators, currentPrice, phase, liquidityState } = s;
  const rand = Math.random();

  // 基础触发概率（大幅降低）
  const baseProbability = liquidityState !== 'NORMAL' ? 0.12 : 0.03;

  // 1. 插针检测：价格接近布林带边界或关键支撑阻力位
  const nearBollUpper =
    currentPrice > indicators.bollUpper * 0.998 &&
    currentPrice < indicators.bollUpper * 1.005;
  const nearBollLower =
    currentPrice < indicators.bollLower * 1.002 &&
    currentPrice > indicators.bollLower * 0.995;
  const nearRecentHigh =
    Math.abs(currentPrice - indicators.recentHigh) / currentPrice < 0.003;
  const nearRecentLow =
    Math.abs(currentPrice - indicators.recentLow) / currentPrice < 0.003;

  // 插针现在需要流动性异常条件才更可能触发
  if ((nearBollUpper || nearRecentHigh) && rand < baseProbability) {
    return 'SCAM_WICK';
  }
  if ((nearBollLower || nearRecentLow) && rand < baseProbability) {
    return 'SCAM_WICK';
  }

  // 2. 停损狩猎：箱体震荡时 + 需要一定概率
  const inRange =
    currentPrice < indicators.rangeHigh * 1.005 &&
    currentPrice > indicators.rangeLow * 0.995;
  if (inRange && rand < baseProbability * 0.6) {
    return Math.random() < 0.5 ? 'STOP_HUNT_LOW' : 'STOP_HUNT_HIGH';
  }

  // 3. Bart 形态：低波动横盘后 (保持原有逻辑，这是多根K线的形态)
  if (phase === 'DISTRIBUTION' && s.volatilityMultiplier < 0.8 && rand < 0.03) {
    return 'BART_PATTERN';
  }

  // 4. 连环爆仓：突破布林带 + 高成交量
  if (currentPrice > indicators.bollUpper * 1.01 && liquidityState === 'VACUUM_HIGH' && rand < 0.15) {
    return 'CASCADE_SHORT'; // 空头爆仓
  }
  if (currentPrice < indicators.bollLower * 0.99 && liquidityState === 'VACUUM_HIGH' && rand < 0.15) {
    return 'CASCADE_LONG'; // 多头爆仓
  }

  // 5. 假突破：技术形态共识位置
  if (nearRecentHigh && phase === 'DISTRIBUTION' && rand < 0.05) {
    return 'FAKEOUT_BULL';
  }
  if (nearRecentLow && phase === 'ACCUMULATION' && rand < 0.05) {
    return 'FAKEOUT_BEAR';
  }

  return 'NONE';
}

/**
 * 初始化操纵事件
 *
 * 重构：插针事件现在使用微观趋势系统
 */
export function initializeEvent(
  s: MarketState,
  event: ManipulationEvent,
): void {
  s.currentEvent = event;
  s.eventProgress = 0;

  switch (event) {
    case 'SCAM_WICK': {
      // 插针事件：初始化微观趋势展开
      // 不再是单根K线，而是 5-15 根K线的V型展开
      const duration = calculateEventDuration();
      s.eventDuration = duration;

      // 确定插针方向
      const direction = s.currentPrice > s.indicators.bollMid ? 1 : -1;
      // 确定目标振幅（1.5% - 3%）
      const targetAmplitude = 0.015 + Math.random() * 0.015;

      initializeMicroTrend(s, direction as 1 | -1, targetAmplitude);
      break;
    }

    case 'BART_PATTERN':
      // Bart 形态保持原有逻辑（本身就是多根K线）
      s.eventDuration = 30 + Math.floor(Math.random() * 50); // 30-80 根 K 线
      s.bartStage = 'PUMP';
      s.bartStartPrice = s.currentPrice;
      s.bartTargetPrice = s.currentPrice * (1.02 + Math.random() * 0.03); // 拉升 2-5%
      s.bartStageProgress = 0;
      s.bartStageDuration = 3 + Math.floor(Math.random() * 5); // Pump 阶段 3-8 根
      break;

    case 'CASCADE_SHORT':
    case 'CASCADE_LONG': {
      // 连环爆仓：使用微观趋势展开
      const duration = calculateEventDuration();
      s.eventDuration = duration;

      const direction = event === 'CASCADE_SHORT' ? 1 : -1;
      const targetAmplitude = 0.02 + Math.random() * 0.02; // 2-4%

      initializeMicroTrend(s, direction as 1 | -1, targetAmplitude);
      break;
    }

    case 'STOP_HUNT_LOW':
    case 'STOP_HUNT_HIGH': {
      // 停损狩猎：使用微观趋势展开
      const duration = calculateEventDuration();
      s.eventDuration = duration;

      const direction = event === 'STOP_HUNT_HIGH' ? 1 : -1;
      const targetAmplitude = 0.01 + Math.random() * 0.015; // 1-2.5%

      initializeMicroTrend(s, direction as 1 | -1, targetAmplitude);
      break;
    }

    case 'FAKEOUT_BULL':
    case 'FAKEOUT_BEAR': {
      // 假突破：使用微观趋势展开
      const duration = Math.max(4, calculateEventDuration() - 3);
      s.eventDuration = duration;

      const direction = event === 'FAKEOUT_BULL' ? 1 : -1;
      const targetAmplitude = 0.012 + Math.random() * 0.012; // 1.2-2.4%

      initializeMicroTrend(s, direction as 1 | -1, targetAmplitude);
      break;
    }

    default:
      s.eventDuration = 0;
  }
}
