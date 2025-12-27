/**
 * 成交量生成模块
 */

import type { MarketPhase, MarketState } from '../types';

/**
 * 生成成交量
 */
export function generateVolume(
  s: MarketState,
  priceChange: number,
  phase: MarketPhase,
): number {
  const { volumeMode, avgVolume } = s;
  let volume = avgVolume;

  // 基于成交量模式
  switch (volumeMode) {
    case 'NORMAL':
      // 正常：成交量与波动率正相关
      volume *= 1 + priceChange * 200;
      break;

    case 'PAINT_TAPE_UP':
    case 'PAINT_TAPE_DOWN':
      // 无量空涨/跌：小成交量大波动
      volume *= 0.3 + Math.random() * 0.3;
      break;

    case 'VOLUME_CLIMAX_TOP':
    case 'VOLUME_CLIMAX_BOTTOM':
      // 放量滞涨/止跌：大成交量小波动
      volume *= 3 + Math.random() * 2;
      break;
  }

  // 根据阶段调整
  switch (phase) {
    case 'ACCUMULATION':
      // 吸筹：成交量逐渐放大但价格不涨
      volume *= 1.2 + s.phaseProgress * 0.5;
      break;
    case 'MARKUP':
      // 拉升：成交量随趋势放大
      volume *= 1 + s.phaseProgress * 0.8;
      break;
    case 'DISTRIBUTION':
      // 派发：高成交量
      volume *= 1.3 + Math.random() * 0.5;
      break;
    case 'MARKDOWN':
      // 下跌：恐慌放量
      volume *= 1.5 + s.phaseProgress;
      break;
  }

  // 随机大单 (3% 概率)
  if (Math.random() < 0.03) {
    volume *= 3 + Math.random() * 4;
  }

  return volume * (0.8 + Math.random() * 0.4);
}

/**
 * 更新波动率和成交量模式
 */
export function updateVolatilityAndVolumeMode(s: MarketState): void {
  // 波动率均值回归
  const targetVol =
    s.phase === 'MARKDOWN' ? 1.5 : s.phase === 'MARKUP' ? 1.2 : 1;
  s.volatilityMultiplier = s.volatilityMultiplier * 0.95 + targetVol * 0.05;

  // 更新成交量模式
  const rand = Math.random();
  if (s.phase === 'ACCUMULATION' && s.phaseProgress > 0.7 && rand < 0.1) {
    s.volumeMode = 'VOLUME_CLIMAX_BOTTOM';
  } else if (
    s.phase === 'DISTRIBUTION' &&
    s.phaseProgress > 0.7 &&
    rand < 0.1
  ) {
    s.volumeMode = 'VOLUME_CLIMAX_TOP';
  } else if (s.volatilityMultiplier < 0.7 && rand < 0.05) {
    s.volumeMode = rand < 0.5 ? 'PAINT_TAPE_UP' : 'PAINT_TAPE_DOWN';
  } else if (rand < 0.1) {
    s.volumeMode = 'NORMAL';
  }
}

