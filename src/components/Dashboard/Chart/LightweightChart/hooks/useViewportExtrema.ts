/**
 * useViewportExtrema Hook
 *
 * 职责：
 * - 监听轻量图表的可视范围变化（缩放/拖拽）
 * - 仅针对当前可视区域（Viewport）内的 K 线，计算最高价/最低价
 * - 若存在多个相同极值，选择时间最近（最右侧）的一根 K 线
 * - 计算像素坐标（x/y），并返回渲染所需信息
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IChartApi, LogicalRange, Time } from 'lightweight-charts';
import type { Candle } from '../../../../../types';
import type { MainSeriesRefs } from './useUnifiedChartSetup';
import { timeToChartTime } from '../utils/dataTransform';

export interface ViewportExtremaPoint {
  index: number;
  price: number;
  /** 绝对像素坐标（相对于整个 Chart 容器左上角，需要结合 paneTopOffsets 使用） */
  x: number;
  /** 相对于主图 pane 顶部的 y 坐标（渲染时加上 paneTopOffsets.PRICE） */
  y: number;
  /** 对应时间（用于定位 X 坐标） */
  time: Time;
  /** 文本（已格式化） */
  label: string;
}

export interface ViewportExtremaState {
  high: ViewportExtremaPoint | null;
  low: ViewportExtremaPoint | null;
  /** 主图 pane 宽度（像素） */
  paneWidth: number;
}

export interface UseViewportExtremaOptions {
  candles: Candle[];
  mainSeriesRefs: React.RefObject<MainSeriesRefs>;
  getSafeChart: () => IChartApi | null;
  chartEpoch: number;
}

export function useViewportExtrema({
  candles,
  mainSeriesRefs,
  getSafeChart,
  chartEpoch,
}: UseViewportExtremaOptions): ViewportExtremaState {
  const [state, setState] = useState<ViewportExtremaState>({
    high: null,
    low: null,
    paneWidth: 0,
  });
  const rangeRef = useRef<LogicalRange | null>(null);

  const compute = useCallback(() => {
    const chart = getSafeChart();
    const refs = mainSeriesRefs.current;
    if (!chart || !refs || !refs.candle || candles.length === 0) {
      setState({ high: null, low: null, paneWidth: 0 });
      return;
    }

    // 可视范围（逻辑索引）
    let logical = chart.timeScale().getVisibleLogicalRange();
    if (!logical) {
      // 若暂不可得，回退为显示最后 N 根（类型断言为 LogicalRange）
      const last = candles.length - 1;
      logical = {
        from: Math.max(0, last - 100) as unknown as number,
        to: last as unknown as number,
      } as unknown as LogicalRange;
    }
    rangeRef.current = logical;

    const start = Math.max(
      0,
      Math.ceil((logical as unknown as { from: number }).from),
    );
    const end = Math.min(
      candles.length - 1,
      Math.floor((logical as unknown as { to: number }).to),
    );
    if (start > end) {
      setState({ high: null, low: null, paneWidth: chart.paneSize(0).width });
      return;
    }

    // 先一次遍历找极值
    let maxHigh = -Infinity;
    let minLow = Infinity;
    for (let i = start; i <= end; i += 1) {
      const c = candles[i];
      if (c.high > maxHigh) maxHigh = c.high;
      if (c.low < minLow) minLow = c.low;
    }

    // 再从右往左找与极值相等的最右侧索引
    let maxIndex = -1;
    let minIndex = -1;
    for (let i = end; i >= start; i -= 1) {
      const c = candles[i];
      if (maxIndex === -1 && c.high === maxHigh) maxIndex = i;
      if (minIndex === -1 && c.low === minLow) minIndex = i;
      if (maxIndex !== -1 && minIndex !== -1) break;
    }

    const candleSeries = refs.candle;
    const paneWidth = chart.paneSize(0).width;

    // 计算坐标
    const toPoint = (
      idx: number,
      price: number,
    ): ViewportExtremaPoint | null => {
      if (idx < 0) return null;
      const t = timeToChartTime(candles[idx].time);
      let x = 0;
      let y = 0;
      try {
        const tx = chart.timeScale().timeToCoordinate(t);
        const py = candleSeries.priceToCoordinate(price);
        if (tx == null || py == null) return null;
        x = tx;
        y = py;
      } catch {
        return null;
      }
      return {
        index: idx,
        price,
        x,
        y,
        time: t,
        label: String(price),
      };
    };

    const highPoint = toPoint(maxIndex, maxHigh);
    const lowPoint = toPoint(minIndex, minLow);

    setState({ high: highPoint, low: lowPoint, paneWidth });
  }, [candles, getSafeChart, mainSeriesRefs]);

  // 初次与依赖变化时计算
  useEffect(() => {
    compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartEpoch, candles]);

  // 订阅可视范围变化
  useEffect(() => {
    const chart = getSafeChart();
    if (!chart) return;
    const handler = (r: LogicalRange | null) => {
      if (!r) return;
      rangeRef.current = r;
      // 使用 rAF 聚合频繁事件，保证拖拽/缩放时平滑且不阻塞
      requestAnimationFrame(() => compute());
    };
    try {
      chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    } catch {
      // ignore
    }
    return () => {
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
      } catch {
        // ignore
      }
    };
  }, [getSafeChart, compute]);

  return state;
}
