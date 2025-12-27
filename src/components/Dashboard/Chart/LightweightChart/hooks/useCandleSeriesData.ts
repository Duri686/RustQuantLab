/**
 * useCandleSeriesData Hook
 * 
 * 职责：管理主图蜡烛图数据更新和 fitContent
 */

import { useEffect, useRef } from 'react';
import type { IChartApi } from 'lightweight-charts';
import type { Candle } from '../../../../../types';
import { candlesToChartData } from '../utils/dataTransform';
import type { MainSeriesRefs } from './useUnifiedChartSetup';

export interface UseCandleSeriesDataOptions {
  chart: IChartApi | null;
  candles: Candle[];
  mainSeriesRefs: React.RefObject<MainSeriesRefs>;
  chartEpoch: number;
  getSafeChart: () => IChartApi | null;
}

export function useCandleSeriesData({
  chart,
  candles,
  mainSeriesRefs,
  chartEpoch,
  getSafeChart,
}: UseCandleSeriesDataOptions): void {
  const didFitRef = useRef<number | null>(null);

  // Update candle data
  useEffect(() => {
    if (!chart || candles.length === 0) return;
    const refs = mainSeriesRefs.current;
    if (!refs) return;
    const candleSeries = refs.candle;
    if (!candleSeries) return;

    try { candleSeries.setData(candlesToChartData(candles)); } catch { /* ignore */ }
  }, [chart, candles, mainSeriesRefs, chartEpoch]);

  // Fit content once after chart creation
  useEffect(() => {
    const safeChart = getSafeChart();
    if (!safeChart || candles.length === 0) return;
    if (didFitRef.current === chartEpoch) return;
    didFitRef.current = chartEpoch;
    try { safeChart.timeScale().fitContent(); } catch { /* ignore */ }
  }, [chartEpoch, candles.length, getSafeChart]);
}
