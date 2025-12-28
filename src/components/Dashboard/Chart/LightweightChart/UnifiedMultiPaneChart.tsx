/**
 * UnifiedMultiPaneChart - 单 Chart 多 Pane 版本
 *
 * 目标：把主图 + VOL/MACD/RSI 放进同一个 lightweight-charts 实例里，
 * 这样 timeScale 天然一致，不会出现"缩放/拖拽对不齐"的同步问题。
 *
 * 重构后：通过组合 hooks 实现单一职责，主组件仅负责编排和渲染。
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type { IChartApi, Time } from 'lightweight-charts';
import type { Candle, IndicatorData } from '../../../../types';
import {
  useUnifiedChartSetup,
  useMainIndicatorSeries,
  useSubPaneSeries,
  useCandleSeriesData,
  type PanePlan,
} from './hooks';
import { OverlayLabels } from './components/OverlayLabels';
import { useViewportExtrema } from './hooks';
import { ViewportExtremaMarkers } from './components/ViewportExtremaMarkers';

// ============ Types ============

export interface UnifiedMultiPaneChartProps {
  candles: Candle[];
  indicatorData: IndicatorData;
  activeMainIndicators: string[];
  activeSubIndicators: string[];
  onCrosshairMove?: (time: Time | null, index: number | null) => void;
  onVisibleRangeChange?: (isAtEnd: boolean) => void;
}

export interface UnifiedMultiPaneChartHandle {
  getChart: () => IChartApi | null;
  scrollToLatest: (animate?: boolean) => void;
  takeScreenshot: () => string | null;
}

// ============ Component ============

const UnifiedMultiPaneChart = forwardRef<
  UnifiedMultiPaneChartHandle,
  UnifiedMultiPaneChartProps
>(function UnifiedMultiPaneChart(
  {
    candles,
    indicatorData,
    activeMainIndicators,
    activeSubIndicators,
    onCrosshairMove,
    onVisibleRangeChange,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const candlesRef = useRef<Candle[]>(candles);

  // Keep candlesRef in sync
  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  // Compute pane plan based on active sub-indicators
  const showVolume = activeSubIndicators.includes('VOL');
  const showMacd = activeSubIndicators.includes('MACD');
  const showRsi = activeSubIndicators.includes('RSI');

  const panePlan = useMemo<PanePlan>(() => {
    const panes: PanePlan = ['PRICE'];
    if (showVolume) panes.push('VOL');
    if (showMacd) panes.push('MACD');
    if (showRsi) panes.push('RSI');
    return panes;
  }, [showVolume, showMacd, showRsi]);

  // === Hook: Chart Setup ===
  const {
    chartEpoch,
    mainSeriesRefs,
    subSeriesRefs,
    hoverTime,
    hoverIndex,
    paneTopOffsets,
    getSafeChart,
  } = useUnifiedChartSetup({
    containerRef,
    panePlan,
    candlesRef,
    onCrosshairMove,
    onVisibleRangeChange,
  });

  // === Hook: Viewport extrema (High/Low in current viewport) ===
  const { high, low, paneWidth } = useViewportExtrema({
    candles,
    mainSeriesRefs,
    getSafeChart,
    chartEpoch,
  });

  // === Hook: Candle Series Data ===
  useCandleSeriesData({
    candles,
    mainSeriesRefs,
    chartEpoch,
    getSafeChart,
  });

  // === Hook: Main Indicator Series (MA/EMA/BOLL) ===
  useMainIndicatorSeries({
    candles,
    indicatorData,
    activeMainIndicators,
    mainSeriesRefs,
    chartEpoch,
    getSafeChart,
  });

  // === Hook: Sub Pane Series (VOL/MACD/RSI) ===
  useSubPaneSeries({
    candles,
    indicatorData,
    subSeriesRefs,
    chartEpoch,
  });

  // === Imperative Handle ===
  useImperativeHandle(
    ref,
    () => ({
      getChart: () => getSafeChart(),
      scrollToLatest: (_animate = false) => {
        const c = getSafeChart();
        if (!c) return;
        try {
          c.timeScale().scrollToRealTime();
        } catch {
          // ignore
        }
      },
      takeScreenshot: () => {
        const c = getSafeChart();
        if (!c) return null;
        try {
          return c.takeScreenshot().toDataURL();
        } catch {
          return null;
        }
      },
    }),
    [getSafeChart],
  );

  // === Computed values for overlay labels ===
  const labelIndex =
    hoverIndex !== null ? hoverIndex : Math.max(0, candles.length - 1);
  const hasData =
    candles.length > 0 && labelIndex >= 0 && labelIndex < candles.length;
  const labelTimeStr =
    hoverTime && hasData ? candles[labelIndex].timeStr : null;

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      <OverlayLabels
        showVolume={showVolume}
        showMacd={showMacd}
        showRsi={showRsi}
        paneTopOffsets={paneTopOffsets}
        labelIndex={labelIndex}
        candles={candles}
        indicatorData={indicatorData}
        labelTimeStr={labelTimeStr}
      />

      {/* 可视区域极值标记（主图 pane） */}
      <ViewportExtremaMarkers
        high={high}
        low={low}
        pricePaneTop={paneTopOffsets.PRICE ?? 0}
        paneWidth={paneWidth}
      />
    </div>
  );
});

export default UnifiedMultiPaneChart;
