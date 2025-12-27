/**
 * useMainIndicatorSeries Hook
 * 
 * 职责：管理主图上覆盖指标（MA、EMA、BOLL）的动态添加/删除/更新
 */

import { useEffect } from 'react';
import { LineSeries, LineStyle, type IChartApi } from 'lightweight-charts';
import type { Candle, IndicatorData } from '../../../../../types';
import { CHART_COLORS } from '../utils/chartColors';
import { indicatorToLineData } from '../utils/dataTransform';
import type { MainSeriesRefs } from './useUnifiedChartSetup';

export interface UseMainIndicatorSeriesOptions {
  chart: IChartApi | null;
  candles: Candle[];
  indicatorData: IndicatorData;
  activeMainIndicators: string[];
  mainSeriesRefs: React.RefObject<MainSeriesRefs>;
  chartEpoch: number;
}

export function useMainIndicatorSeries({
  chart,
  candles,
  indicatorData,
  activeMainIndicators,
  mainSeriesRefs,
  chartEpoch,
}: UseMainIndicatorSeriesOptions): void {
  useEffect(() => {
    if (!chart || candles.length === 0) return;
    const refs = mainSeriesRefs.current;
    if (!refs || !refs.candle) return;

    // === MA ===
    const wantMA = activeMainIndicators.includes('MA');
    const ma7Values = indicatorData.ma7.length === candles.length 
      ? indicatorData.ma7 
      : candles.map((c) => c.ma7);
    const ma25Values = indicatorData.ma25.length === candles.length 
      ? indicatorData.ma25 
      : candles.map((c) => c.ma25);
    const ma99Values = indicatorData.ma99.length === candles.length 
      ? indicatorData.ma99 
      : candles.map((c) => c.ma99);
    
    const maConfigs = [
      { key: 'ma7', color: CHART_COLORS.MA7, values: ma7Values },
      { key: 'ma25', color: CHART_COLORS.MA25, values: ma25Values },
      { key: 'ma99', color: CHART_COLORS.MA99, values: ma99Values },
    ];

    if (!wantMA) {
      refs.ma.forEach((s) => {
        try { chart.removeSeries(s); } catch { /* ignore */ }
      });
      refs.ma.clear();
    } else {
      maConfigs.forEach(({ key, color, values }) => {
        let s = refs.ma.get(key);
        if (!s) {
          s = chart.addSeries(LineSeries, {
            color,
            lineWidth: 1,
            priceScaleId: 'right',
            lastValueVisible: false,
            priceLineVisible: false,
          }, 0);
          refs.ma.set(key, s);
        }
        try { s.setData(indicatorToLineData(candles, values)); } catch { /* ignore */ }
      });
    }

    // === EMA ===
    const wantEMA = activeMainIndicators.includes('EMA');
    const emaConfigs = [
      { key: 'ema7', color: CHART_COLORS.EMA7, values: indicatorData.ema7 },
      { key: 'ema25', color: CHART_COLORS.EMA25, values: indicatorData.ema25 },
    ];

    if (!wantEMA) {
      refs.ema.forEach((s) => {
        try { chart.removeSeries(s); } catch { /* ignore */ }
      });
      refs.ema.clear();
    } else {
      emaConfigs.forEach(({ key, color, values }) => {
        let s = refs.ema.get(key);
        if (!s) {
          s = chart.addSeries(LineSeries, {
            color,
            lineWidth: 1,
            priceScaleId: 'right',
            lastValueVisible: false,
            priceLineVisible: false,
          }, 0);
          refs.ema.set(key, s);
        }
        try { s.setData(indicatorToLineData(candles, values)); } catch { /* ignore */ }
      });
    }

    // === BOLL ===
    const wantBOLL = activeMainIndicators.includes('BOLL');
    const bollConfigs = [
      { key: 'bollUpper', color: CHART_COLORS.BOLL_UPPER, values: indicatorData.bollUpper, lineStyle: LineStyle.Dashed },
      { key: 'bollMid', color: CHART_COLORS.BOLL_MID, values: indicatorData.bollMid, lineStyle: LineStyle.Solid },
      { key: 'bollLower', color: CHART_COLORS.BOLL_LOWER, values: indicatorData.bollLower, lineStyle: LineStyle.Dashed },
    ];

    if (!wantBOLL) {
      refs.boll.forEach((s) => {
        try { chart.removeSeries(s); } catch { /* ignore */ }
      });
      refs.boll.clear();
    } else {
      bollConfigs.forEach(({ key, color, values, lineStyle }) => {
        let s = refs.boll.get(key);
        if (!s) {
          s = chart.addSeries(LineSeries, {
            color,
            lineWidth: 1,
            lineStyle,
            priceScaleId: 'right',
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          }, 0);
          refs.boll.set(key, s);
        }
        try { s.setData(indicatorToLineData(candles, values)); } catch { /* ignore */ }
      });
    }
  }, [chart, candles, indicatorData, activeMainIndicators, mainSeriesRefs, chartEpoch]);
}
