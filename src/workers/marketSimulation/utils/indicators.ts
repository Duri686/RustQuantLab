/**
 * 技术指标计算工具
 */

import type { MarketState } from '../types';
import { BASE_PRICE } from '../constants';

/**
 * 计算简单移动平均
 */
export function calculateMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || BASE_PRICE;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * 计算标准差
 */
export function calculateStdDev(prices: number[], period: number): number {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  const ma = slice.reduce((a, b) => a + b, 0) / period;
  const variance =
    slice.reduce((sum, p) => sum + Math.pow(p - ma, 2), 0) / period;
  return Math.sqrt(variance);
}

/**
 * 更新技术指标
 */
export function updateIndicators(s: MarketState): void {
  const { priceHistory: prices, currentPrice } = s;

  // 更新 MA
  s.indicators.ma20 = calculateMA(prices, 20);
  s.indicators.ma50 = calculateMA(prices, 50);

  // 更新布林带 (20 周期, 2 标准差)
  const stdDev = calculateStdDev(prices, 20);
  s.indicators.bollMid = s.indicators.ma20;
  s.indicators.bollUpper = s.indicators.ma20 + stdDev * 2;
  s.indicators.bollLower = s.indicators.ma20 - stdDev * 2;

  // 更新近期高低点 (50 根 K 线)
  const recentPrices = prices.slice(-50);
  s.indicators.recentHigh = Math.max(...recentPrices);
  s.indicators.recentLow = Math.min(...recentPrices);

  // 更新箱体区间 (20 根 K 线的高低点)
  const rangePrices = prices.slice(-20);
  if (rangePrices.length >= 10) {
    const rangeMax = Math.max(...rangePrices);
    const rangeMin = Math.min(...rangePrices);
    const range = rangeMax - rangeMin;
    // 只有当波动率较小时才认为是箱体
    if (range / currentPrice < 0.03) {
      s.indicators.rangeHigh = rangeMax;
      s.indicators.rangeLow = rangeMin;
    }
  }
}

