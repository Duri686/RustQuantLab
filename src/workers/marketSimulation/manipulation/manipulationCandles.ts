/**
 * 操纵事件 K 线生成 (重构版)
 *
 * 核心改进：
 * - 插针事件使用微观趋势系统，分解为多根K线
 * - 每根K线的影线都符合时间分形约束
 * - 不再有"单根K线暴跌又暴涨"的情况
 */

import type { CandleResult, MarketState } from '../types';
import { generateBartCandle } from './bart';
import { generateMicroTrendCandle, isMicroTrendComplete } from './microTrend';
import { getNormalRange } from '../candles/shadows';

// 前向声明，实际实现在 candles/generator.ts
// 为避免循环依赖，这里使用函数参数传入
type NormalCandleGenerator = (
  s: MarketState,
  open: number,
  timeframeSeconds: number,
) => CandleResult;

/**
 * 生成操纵事件 K 线
 */
export function generateManipulationCandle(
  s: MarketState,
  open: number,
  timeframeSeconds: number,
  generateNormalCandle: NormalCandleGenerator,
): CandleResult {
  const { currentEvent } = s;

  // 大部分操纵事件现在使用微观趋势系统
  switch (currentEvent) {
    case 'SCAM_WICK':
    case 'CASCADE_SHORT':
    case 'CASCADE_LONG':
    case 'STOP_HUNT_LOW':
    case 'STOP_HUNT_HIGH':
    case 'FAKEOUT_BULL':
    case 'FAKEOUT_BEAR': {
      // 使用微观趋势系统生成K线
      // 每根K线都是正常的、符合振幅约束的K线
      // 只是整体形成一个V型趋势
      if (s.microTrend.phase !== 'NONE') {
        return generateMicroTrendCandle(s, open, timeframeSeconds);
      }
      // 微观趋势已完成，回退到正常生成
      return generateNormalCandle(s, open, timeframeSeconds);
    }

    case 'BART_PATTERN':
      // Bart 形态保持原有逻辑（本身就是多根K线的设计）
      return generateBartCandle(s, open);

    default:
      // 默认回退到正常生成
      return generateNormalCandle(s, open, timeframeSeconds);
  }
}
