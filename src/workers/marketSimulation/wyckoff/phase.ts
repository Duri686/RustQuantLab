/**
 * Wyckoff 市场周期状态机
 */

import type { MarketPhase, MarketState } from '../types';

/**
 * 获取下一个市场阶段
 */
export function getNextPhase(currentPhase: MarketPhase): MarketPhase {
  const rand = Math.random();

  switch (currentPhase) {
    case 'ACCUMULATION':
      // 吸筹后：70% 进入拉升，30% 继续吸筹
      return rand < 0.7 ? 'MARKUP' : 'ACCUMULATION';

    case 'MARKUP':
      // 拉升后：50% 进入派发，30% 继续拉升，20% 回调吸筹
      if (rand < 0.5) return 'DISTRIBUTION';
      if (rand < 0.8) return 'MARKUP';
      return 'ACCUMULATION';

    case 'DISTRIBUTION':
      // 派发后：70% 进入下跌，30% 继续派发
      return rand < 0.7 ? 'MARKDOWN' : 'DISTRIBUTION';

    case 'MARKDOWN':
      // 下跌后：50% 进入吸筹，30% 继续下跌，20% 反弹派发
      if (rand < 0.5) return 'ACCUMULATION';
      if (rand < 0.8) return 'MARKDOWN';
      return 'DISTRIBUTION';
  }
}

/**
 * 获取阶段持续时间（K 线数）
 */
export function getPhaseDuration(
  phase: MarketPhase,
  timeframeSeconds: number,
): number {
  const baseUnit = 60 / timeframeSeconds; // 基准单位：1分钟K线数

  switch (phase) {
    case 'ACCUMULATION':
      // 吸筹：较长 (1-4小时)
      return Math.floor((60 + Math.random() * 180) * baseUnit);

    case 'MARKUP':
      // 拉升：中等 (30分钟-2小时)
      return Math.floor((30 + Math.random() * 90) * baseUnit);

    case 'DISTRIBUTION':
      // 派发：较长 (1-3小时)
      return Math.floor((60 + Math.random() * 120) * baseUnit);

    case 'MARKDOWN':
      // 下跌：最短 (15分钟-1小时) - 电梯效应
      return Math.floor((15 + Math.random() * 45) * baseUnit);
  }
}

/**
 * 更新阶段状态
 */
export function updatePhase(s: MarketState, timeframeSeconds: number): void {
  s.phaseCounter++;
  s.phaseProgress = s.phaseCounter / s.phaseDuration;

  if (s.phaseCounter >= s.phaseDuration) {
    // 阶段转换
    s.phase = getNextPhase(s.phase);
    s.phaseCounter = 0;
    s.phaseDuration = getPhaseDuration(s.phase, timeframeSeconds);

    // 更新基准价格（均值回归目标）
    if (s.phase === 'ACCUMULATION') {
      s.basePrice = s.currentPrice * (0.98 + Math.random() * 0.04); // 略低于当前价
    } else if (s.phase === 'DISTRIBUTION') {
      s.basePrice = s.currentPrice * (0.98 + Math.random() * 0.04); // 略低于当前价
    }
  }
}

