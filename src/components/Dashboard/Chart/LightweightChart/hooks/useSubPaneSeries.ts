/**
 * useSubPaneSeries Hook
 * 
 * 职责：管理副图（VOL、MACD、RSI）的数据更新
 */

import { useEffect } from 'react';
import type { Candle, IndicatorData } from '../../../../../types';
import {
  candlesToVolumeData,
  indicatorToLineData,
  macdHistToHistogramData,
  timeToChartTime,
} from '../utils/dataTransform';
import type { SubSeriesRefs } from './useUnifiedChartSetup';

export interface UseSubPaneSeriesOptions {
  candles: Candle[];
  indicatorData: IndicatorData;
  subSeriesRefs: React.RefObject<SubSeriesRefs>;
  chartEpoch: number;
}

export function useSubPaneSeries({
  candles,
  indicatorData,
  subSeriesRefs,
  chartEpoch,
}: UseSubPaneSeriesOptions): void {
  useEffect(() => {
    if (candles.length === 0) return;
    const refs = subSeriesRefs.current;
    if (!refs) return;

    // VOL
    if (refs.volume) {
      try { refs.volume.setData(candlesToVolumeData(candles)); } catch { /* ignore */ }
    }

    // MACD
    if (refs.macd.dif && refs.macd.dea && refs.macd.hist) {
      try { refs.macd.dif.setData(indicatorToLineData(candles, indicatorData.macdDif)); } catch { /* ignore */ }
      try { refs.macd.dea.setData(indicatorToLineData(candles, indicatorData.macdDea)); } catch { /* ignore */ }
      try { refs.macd.hist.setData(macdHistToHistogramData(candles, indicatorData.macdHist)); } catch { /* ignore */ }
    }

    // RSI
    if (refs.rsi.rsi && refs.rsi.overbought && refs.rsi.oversold) {
      const clamped = indicatorData.rsi14.map((v) =>
        v === null || v === undefined ? null : Math.max(0, Math.min(100, v))
      );
      try { refs.rsi.rsi.setData(indicatorToLineData(candles, clamped)); } catch { /* ignore */ }
      
      // Horizontal lines at 70/30
      const over = candles.map((c) => ({ time: timeToChartTime(c.time), value: 70 }));
      const under = candles.map((c) => ({ time: timeToChartTime(c.time), value: 30 }));
      try { refs.rsi.overbought.setData(over); } catch { /* ignore */ }
      try { refs.rsi.oversold.setData(under); } catch { /* ignore */ }
    }
  }, [candles, indicatorData, subSeriesRefs, chartEpoch]);
}
