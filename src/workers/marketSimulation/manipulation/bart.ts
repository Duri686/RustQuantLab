/**
 * Bart 形态生成器
 */

import type { CandleResult, MarketState } from '../types';

/**
 * 生成 Bart 形态 K 线
 */
export function generateBartCandle(
  s: MarketState,
  open: number,
): CandleResult {
  let close = open;
  let high = open;
  let low = open;
  let volume = s.avgVolume;

  s.bartStageProgress++;

  switch (s.bartStage) {
    case 'PUMP': {
      // 急速拉升
      const pumpProgress = s.bartStageProgress / s.bartStageDuration;
      const targetProgress =
        (s.bartTargetPrice - s.bartStartPrice) * pumpProgress;
      close = s.bartStartPrice + targetProgress + open * (Math.random() * 0.002);
      high = close + open * 0.003;
      low = open - open * 0.001;
      volume = s.avgVolume * (2 + Math.random() * 2);

      if (s.bartStageProgress >= s.bartStageDuration) {
        s.bartStage = 'CONSOLIDATE';
        s.bartStageProgress = 0;
        s.bartStageDuration = 20 + Math.floor(Math.random() * 40); // 高位震荡 20-60 根
      }
      break;
    }

    case 'CONSOLIDATE': {
      // 高位锯齿震荡
      const sawtoothAmplitude = s.bartTargetPrice * 0.005;
      const sawtoothOffset =
        Math.sin(s.bartStageProgress * 0.5) * sawtoothAmplitude;
      close =
        s.bartTargetPrice +
        sawtoothOffset +
        (Math.random() - 0.5) * open * 0.003;
      high = Math.max(open, close) + open * 0.002;
      low = Math.min(open, close) - open * 0.002;
      volume = s.avgVolume * (0.5 + Math.random() * 0.5); // 缩量

      if (s.bartStageProgress >= s.bartStageDuration) {
        s.bartStage = 'DUMP';
        s.bartStageProgress = 0;
        s.bartStageDuration = 3 + Math.floor(Math.random() * 5); // Dump 阶段 3-8 根
      }
      break;
    }

    case 'DUMP': {
      // 急速下跌回原点
      const dumpProgress = s.bartStageProgress / s.bartStageDuration;
      const currentTarget =
        s.bartTargetPrice -
        (s.bartTargetPrice - s.bartStartPrice) * dumpProgress;
      close = currentTarget - open * (Math.random() * 0.002);
      low = close - open * 0.003;
      high = open + open * 0.001;
      volume = s.avgVolume * (2 + Math.random() * 2);

      if (s.bartStageProgress >= s.bartStageDuration) {
        s.bartStage = 'NONE';
      }
      break;
    }

    default:
      close = open;
  }

  return { close, high, low, volume };
}

