/**
 * 微观趋势模块
 *
 * 将大的插针/波动事件分解为多根K线的V型展开
 * 解决"1m影线太长"问题的核心方案
 *
 * 原理：
 * - 当算法决定生成一个"4H级别的向下插针"时，不在1分钟内完成
 * - 设定持续时间（Duration）：将这个动作分配给 5~15 根 1m K线
 *
 * 形态分布：
 * - PANIC (恐慌): 前 3-5 分钟，连续阴/阳线，实体逐渐增大
 * - CLIMAX (高潮): 中间 1-3 分钟，极高成交量，实体变小或十字星
 * - REVERSAL (反转): 后 3-5 分钟，连续反向K线，逐渐收复
 *
 * 结果：4H看是一根长影线，1m看是完美的V型底，每根1m K线影线都很短很真实
 */

import type { MarketState, MicroTrendState, MicroTrendPhase, CandleResult } from '../types';
import {
  WICK_EVENT_MIN_DURATION,
  WICK_EVENT_MAX_DURATION,
  V_REVERSAL_PHASES,
  NORMAL_RANGE_1M,
} from '../constants';

/**
 * 初始化微观趋势状态
 * @param direction 方向：1=向上，-1=向下
 * @param targetAmplitude 目标总振幅（百分比，如 0.02 表示 2%）
 */
export function initializeMicroTrend(
  s: MarketState,
  direction: 1 | -1,
  targetAmplitude: number,
): void {
  const totalDuration = WICK_EVENT_MIN_DURATION +
    Math.floor(Math.random() * (WICK_EVENT_MAX_DURATION - WICK_EVENT_MIN_DURATION));

  // 计算各阶段的K线数量
  const panicBars = Math.max(2, Math.floor(totalDuration * V_REVERSAL_PHASES[0]));
  const climaxBars = Math.max(1, Math.floor(totalDuration * V_REVERSAL_PHASES[1]));
  // 剩余给反转阶段

  s.microTrend = {
    phase: 'PANIC',
    direction,
    targetAmplitude,
    accumulatedMove: 0,
    phaseProgress: 0,
    phaseDuration: panicBars,
    phaseIndex: 0,
    startPrice: s.currentPrice,
    extremePrice: s.currentPrice,
  };
}

/**
 * 计算当前阶段应该移动的幅度
 */
function getPhaseMove(
  microTrend: MicroTrendState,
  phase: MicroTrendPhase,
): number {
  const { targetAmplitude, direction, phaseIndex, phaseDuration } = microTrend;

  // 进度比例 (0-1)
  const progress = phaseDuration > 0 ? (phaseIndex + 1) / phaseDuration : 1;

  switch (phase) {
    case 'PANIC': {
      // 恐慌阶段：指数加速移动
      // 前几根小，后几根大（恐慌加速效应）
      const accelerationFactor = Math.pow(progress, 1.5);
      // 恐慌阶段消耗目标振幅的约 70-80%
      const phaseTarget = targetAmplitude * 0.75;
      const movePerBar = phaseTarget / phaseDuration;
      return direction * movePerBar * (0.5 + accelerationFactor);
    }

    case 'CLIMAX': {
      // 高潮换手阶段：波动剧烈但方向不明确
      // 实体很小（多空换手），但有一定影线
      const noise = (Math.random() - 0.5) * NORMAL_RANGE_1M * 0.5;
      return direction * noise;
    }

    case 'REVERSAL': {
      // 反转阶段：逐渐收复失地
      // 开始强劲，逐渐减弱
      const recoveryFactor = 1 - Math.pow(progress, 0.8);
      const remainingMove = targetAmplitude * 0.6; // 反转收复约 60-70%
      const movePerBar = remainingMove / phaseDuration;
      return -direction * movePerBar * (0.8 + recoveryFactor * 0.4);
    }

    default:
      return 0;
  }
}

/**
 * 推进微观趋势到下一阶段
 */
function advanceMicroTrendPhase(s: MarketState): void {
  const { microTrend } = s;
  const totalDuration = WICK_EVENT_MIN_DURATION +
    Math.floor(Math.random() * (WICK_EVENT_MAX_DURATION - WICK_EVENT_MIN_DURATION));

  switch (microTrend.phase) {
    case 'PANIC':
      microTrend.phase = 'CLIMAX';
      microTrend.phaseIndex = 0;
      microTrend.phaseDuration = Math.max(1, Math.floor(totalDuration * V_REVERSAL_PHASES[1]));
      microTrend.extremePrice = s.currentPrice; // 记录极值
      break;

    case 'CLIMAX':
      microTrend.phase = 'REVERSAL';
      microTrend.phaseIndex = 0;
      microTrend.phaseDuration = Math.max(2, Math.floor(totalDuration * V_REVERSAL_PHASES[2]));
      break;

    case 'REVERSAL':
      microTrend.phase = 'NONE';
      microTrend.phaseIndex = 0;
      microTrend.phaseDuration = 0;
      break;
  }
}

/**
 * 生成微观趋势中的单根K线
 * 每根K线都是独立的、符合振幅约束的正常K线
 * 只是整体形成一个V型趋势
 */
export function generateMicroTrendCandle(
  s: MarketState,
  open: number,
  timeframeSeconds: number,
): CandleResult {
  const { microTrend } = s;
  const { phase, direction } = microTrend;

  if (phase === 'NONE') {
    // 不应该到这里，返回默认值
    return { close: open, high: open, low: open, volume: s.avgVolume };
  }

  // 计算本根K线的移动幅度
  const move = getPhaseMove(microTrend, phase);
  const close = open * (1 + move);

  // 根据阶段生成不同特征的影线
  let upperShadow: number;
  let lowerShadow: number;
  const body = Math.abs(close - open);

  switch (phase) {
    case 'PANIC': {
      // 恐慌阶段：实体饱满，影线很短
      // 连续的阴线（或阳线），实体逐渐增大
      const progress = microTrend.phaseIndex / microTrend.phaseDuration;
      const shadowRatio = 0.02 + Math.random() * 0.03; // 很小的影线

      if (direction === -1) {
        // 向下插针：主要是阴线
        upperShadow = body * shadowRatio;
        lowerShadow = body * shadowRatio * (1 + progress * 0.5);
      } else {
        // 向上插针：主要是阳线
        lowerShadow = body * shadowRatio;
        upperShadow = body * shadowRatio * (1 + progress * 0.5);
      }
      break;
    }

    case 'CLIMAX': {
      // 高潮换手阶段：十字星或小实体，可能有略长的双向影线
      // 这是换手剧烈的标志
      const bodySize = Math.max(body, open * 0.0005); // 保证最小实体
      const shadowMultiplier = 1.5 + Math.random() * 2;

      upperShadow = bodySize * shadowMultiplier * 0.5;
      lowerShadow = bodySize * shadowMultiplier * 0.5;
      break;
    }

    case 'REVERSAL': {
      // 反转阶段：逐渐收复，实体从大到小
      const progress = microTrend.phaseIndex / microTrend.phaseDuration;
      const shadowRatio = 0.02 + Math.random() * 0.05;

      if (direction === -1) {
        // 从下方反转：主要是阳线
        lowerShadow = body * shadowRatio;
        upperShadow = body * shadowRatio * (0.5 + progress * 0.3);
      } else {
        // 从上方反转：主要是阴线
        upperShadow = body * shadowRatio;
        lowerShadow = body * shadowRatio * (0.5 + progress * 0.3);
      }
      break;
    }

    default:
      upperShadow = body * 0.02;
      lowerShadow = body * 0.02;
  }

  const high = Math.max(open, close) + upperShadow;
  const low = Math.min(open, close) - lowerShadow;

  // 根据阶段调整成交量
  let volume = s.avgVolume;
  switch (phase) {
    case 'PANIC':
      // 恐慌阶段：成交量逐渐放大
      volume *= 1.5 + (microTrend.phaseIndex / microTrend.phaseDuration) * 2;
      break;
    case 'CLIMAX':
      // 高潮阶段：极高成交量
      volume *= 3 + Math.random() * 2;
      break;
    case 'REVERSAL':
      // 反转阶段：成交量从高逐渐回落
      volume *= 2 - (microTrend.phaseIndex / microTrend.phaseDuration) * 0.8;
      break;
  }

  // 更新微观趋势状态
  microTrend.accumulatedMove += move;
  microTrend.phaseIndex++;

  // 检查是否需要进入下一阶段
  if (microTrend.phaseIndex >= microTrend.phaseDuration) {
    advanceMicroTrendPhase(s);
  }

  return {
    close,
    high,
    low,
    volume: volume * (0.8 + Math.random() * 0.4),
  };
}

/**
 * 检查微观趋势是否已完成
 */
export function isMicroTrendComplete(s: MarketState): boolean {
  return s.microTrend.phase === 'NONE';
}

/**
 * 计算建议的事件总持续时间（K线数）
 */
export function calculateEventDuration(): number {
  return WICK_EVENT_MIN_DURATION +
    Math.floor(Math.random() * (WICK_EVENT_MAX_DURATION - WICK_EVENT_MIN_DURATION));
}

