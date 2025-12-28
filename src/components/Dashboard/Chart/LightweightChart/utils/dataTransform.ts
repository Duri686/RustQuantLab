/**
 * 数据转换工具函数
 * 将应用数据格式转换为 Lightweight Charts 格式
 */

import type {
  CandlestickData,
  LineData,
  HistogramData,
  Time,
  WhitespaceData,
} from 'lightweight-charts';
import type { Candle } from '../../../../../types/index';
import { CHART_COLORS } from './chartColors';

function trimTrailingZeros(numStr: string): string {
  // "12.00" -> "12", "12.30" -> "12.3"
  if (!numStr.includes('.')) return numStr;
  return numStr.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '');
}

function formatCompactWithSuffix(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '-';

  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(decimals)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(decimals)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(decimals)}K`;
  return value.toFixed(decimals);
}

/**
 * 将时间戳转换为 Lightweight Charts 的时间格式
 * Candle.time 是秒级时间戳
 */
export function timeToChartTime(time: number): Time {
  // 兼容 ms/秒 两种时间戳输入：
  // - useCandleData (前端聚合) 使用 Date.now() -> 毫秒
  // - Rust/Wasm 侧可能输出秒或毫秒（取决于实现）
  // Lightweight Charts 的 UTCTimestamp 期望“秒”
  const seconds = time > 10_000_000_000 ? Math.floor(time / 1000) : time;
  return seconds as Time;
}

/**
 * 将 Candle 转换为 Lightweight Charts 的 CandlestickData 格式
 */
export function candleToChartData(candle: Candle): CandlestickData {
  return {
    time: timeToChartTime(candle.time),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

/**
 * 将 Candle 数组转换为 CandlestickData 数组
 */
export function candlesToChartData(candles: Candle[]): CandlestickData[] {
  return candles.map(candleToChartData);
}

/**
 * 将成交量数据转换为 HistogramData 格式
 */
export function candlesToVolumeData(candles: Candle[]): HistogramData[] {
  return candles.map((candle) => {
    const isUp = candle.close >= candle.open;
    return {
      time: timeToChartTime(candle.time),
      value: candle.volume,
      color: isUp ? CHART_COLORS.VOLUME_UP : CHART_COLORS.VOLUME_DOWN,
    };
  });
}

/**
 * 将指标数据转换为 LineData 格式
 * @param candles K 线数据（用于获取时间）
 * @param values 指标值数组
 */
export function indicatorToLineData(
  candles: Candle[],
  values: (number | null)[],
): Array<LineData | WhitespaceData> {
  return candles.map((candle, index) => {
    const value = values[index];
    const time = timeToChartTime(candle.time);

    // 使用 whitespace data 保留时间点，避免副图时间轴“缩水”导致与主图对不齐
    if (value === null || value === undefined || Number.isNaN(value)) {
      return { time };
    }

    return { time, value };
  });
}

/**
 * 将 MACD 柱状图数据转换为 HistogramData 格式
 */
export function macdHistToHistogramData(
  candles: Candle[],
  values: (number | null)[],
): Array<HistogramData | WhitespaceData> {
  return candles.map((candle, index) => {
    const value = values[index];
    const time = timeToChartTime(candle.time);

    // 保留时间点：缺失值用 whitespace，确保 timeScale 与主图一致
    if (value === null || value === undefined || Number.isNaN(value)) {
      return { time };
    }

    return {
      time,
      value,
      color:
        value >= 0 ? CHART_COLORS.MACD_HIST_UP : CHART_COLORS.MACD_HIST_DOWN,
    };
  });
}

/**
 * 根据时间查找 K 线索引
 */
export function findCandleIndexByTime(candles: Candle[], time: Time): number {
  const timeNum = time as number;
  return candles.findIndex((c) => c.time === timeNum);
}

/**
 * 计算涨跌幅
 */
export function calculateChange(
  open: number,
  close: number,
): { change: number; changePercent: number } {
  const change = close - open;
  const changePercent = open !== 0 ? (change / open) * 100 : 0;
  return { change, changePercent };
}

/**
 * 格式化成交量显示
 */
export function formatVolume(vol: number): string {
  const abs = Math.abs(vol);
  if (abs >= 1e9) return `${trimTrailingZeros((vol / 1e9).toFixed(2))}B`;
  if (abs >= 1e6) return `${trimTrailingZeros((vol / 1e6).toFixed(2))}M`;
  if (abs >= 1e3) return `${trimTrailingZeros((vol / 1e3).toFixed(2))}K`;
  // volume 通常是整数，但这里做个兼容
  return trimTrailingZeros(vol.toFixed(2));
}

/**
 * 格式化价格显示
 */
export function formatPrice(price: number, decimals = 2): string {
  return price.toFixed(decimals);
}

/**
 * 价格轴格式化（右侧刻度 & 十字线标签）
 * 目前默认保留 2 位小数；如需根据交易对动态调整精度，再在这里扩展。
 */
export function formatAxisPrice(price: number, decimals = 2): string {
  // 价格轴：不使用 K/M/B 紧凑格式，直接展示原始数值（保留 decimals 位小数，去掉无意义的 0）
  return trimTrailingZeros(price.toFixed(decimals));
}

/**
 * 成交量轴格式化（右侧刻度 & 十字线标签）
 * 使用 K/M/B，并去掉无意义的 0。
 */
export function formatAxisVolume(vol: number): string {
  return formatVolume(vol);
}

/**
 * 指标轴格式化（如 MACD）
 * 大数用 K/M/B，固定保留 2 位小数。
 */
export function formatAxisIndicator(value: number, decimals = 2): string {
  return formatCompactWithSuffix(value, decimals);
}

/**
 * 格式化百分比显示
 */
export function formatPercent(percent: number, decimals = 2): string {
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(decimals)}%`;
}
