/**
 * 数学工具函数
 */

import { PRICE_PRECISION } from '../constants';

/**
 * 将时间戳对齐到指定周期
 */
export function alignTimestamp(timestamp: number, intervalMs: number): number {
  return Math.floor(timestamp / intervalMs) * intervalMs;
}

/**
 * 精确到两位小数
 */
export function round2(n: number): number {
  return Math.round(n * PRICE_PRECISION) / PRICE_PRECISION;
}

/**
 * 生成厚尾分布的随机数 (Student's t-distribution 近似)
 */
export function fatTailRandom(): number {
  // 使用 Box-Muller 变换生成正态分布，然后加入厚尾特征
  const u1 = Math.random();
  const u2 = Math.random();
  const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

  // 5% 概率生成极端值（厚尾）
  if (Math.random() < 0.05) {
    return normal * (2 + Math.random() * 2); // 极端波动
  }
  return normal;
}

