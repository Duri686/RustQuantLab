/**
 * useUnifiedChartSetup Hook
 * 
 * 职责：管理 Unified Multi-Pane Chart 的生命周期
 * - 创建/销毁 Chart 实例
 * - 管理 Pane 结构（根据 panePlan 动态创建）
 * - 创建基础 Series（主图蜡烛图 + 副图系列）
 * - 订阅/取消订阅事件（crosshair、visibleRange）
 * - 处理 ResizeObserver
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type LogicalRange,
  type Time,
  type TickMarkType,
} from 'lightweight-charts';
import type { Candle } from '../../../../../types';
import { CHART_COLORS } from '../utils/chartColors';
import { RIGHT_PRICE_SCALE_MIN_WIDTH } from '../utils/chartLayout';
import { formatTickMark } from '../utils/tickMarkFormatter';
import { formatAxisPrice, formatAxisVolume, formatAxisIndicator, timeToChartTime } from '../utils/dataTransform';

// ============ Types ============

export type PanePlan = Array<'PRICE' | 'VOL' | 'MACD' | 'RSI'>;

export type MainSeriesRefs = {
  candle: ISeriesApi<'Candlestick'> | null;
  ma: Map<string, ISeriesApi<'Line'>>;
  ema: Map<string, ISeriesApi<'Line'>>;
  boll: Map<string, ISeriesApi<'Line'>>;
};

export type SubSeriesRefs = {
  volume: ISeriesApi<'Histogram'> | null;
  macd: {
    dif: ISeriesApi<'Line'> | null;
    dea: ISeriesApi<'Line'> | null;
    hist: ISeriesApi<'Histogram'> | null;
  };
  rsi: {
    rsi: ISeriesApi<'Line'> | null;
    overbought: ISeriesApi<'Line'> | null;
    oversold: ISeriesApi<'Line'> | null;
  };
};

export interface UseUnifiedChartSetupOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  panePlan: PanePlan;
  candlesRef: React.RefObject<Candle[]>;
  onCrosshairMove?: (time: Time | null, index: number | null) => void;
  onVisibleRangeChange?: (isAtEnd: boolean) => void;
}

export interface UseUnifiedChartSetupReturn {
  chart: IChartApi | null;
  chartEpoch: number;
  mainSeriesRefs: React.RefObject<MainSeriesRefs>;
  subSeriesRefs: React.RefObject<SubSeriesRefs>;
  hoverTime: Time | null;
  hoverIndex: number | null;
  paneTopOffsets: Record<string, number>;
  getSafeChart: () => IChartApi | null;
}

// ============ Helpers ============

function isChartDisposed(chart: IChartApi | null): boolean {
  if (!chart) return true;
  try {
    chart.timeScale();
    return false;
  } catch {
    return true;
  }
}

function createInitialMainSeriesRefs(): MainSeriesRefs {
  return {
    candle: null,
    ma: new Map(),
    ema: new Map(),
    boll: new Map(),
  };
}

function createInitialSubSeriesRefs(): SubSeriesRefs {
  return {
    volume: null,
    macd: { dif: null, dea: null, hist: null },
    rsi: { rsi: null, overbought: null, oversold: null },
  };
}

// ============ Hook ============

export function useUnifiedChartSetup({
  containerRef,
  panePlan,
  candlesRef,
  onCrosshairMove,
  onVisibleRangeChange,
}: UseUnifiedChartSetupOptions): UseUnifiedChartSetupReturn {
  const chartRef = useRef<IChartApi | null>(null);
  const disposedRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  const [chartEpoch, setChartEpoch] = useState(0);
  const [hoverTime, setHoverTime] = useState<Time | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [paneTopOffsets, setPaneTopOffsets] = useState<Record<string, number>>({});

  // Refs for callbacks to avoid stale closures
  const onCrosshairMoveRef = useRef(onCrosshairMove);
  const onVisibleRangeChangeRef = useRef(onVisibleRangeChange);
  useEffect(() => { onCrosshairMoveRef.current = onCrosshairMove; }, [onCrosshairMove]);
  useEffect(() => { onVisibleRangeChangeRef.current = onVisibleRangeChange; }, [onVisibleRangeChange]);

  // Series refs
  const mainSeriesRefs = useRef<MainSeriesRefs>(createInitialMainSeriesRefs());
  const subSeriesRefs = useRef<SubSeriesRefs>(createInitialSubSeriesRefs());

  const getSafeChart = useCallback((): IChartApi | null => {
    if (disposedRef.current || isChartDisposed(chartRef.current)) return null;
    return chartRef.current;
  }, []);

  const computePaneOffsets = useCallback((chart: IChartApi, plan: PanePlan) => {
    const offsets: Record<string, number> = {};
    let accTop = 0;
    for (let i = 0; i < plan.length; i += 1) {
      const key = plan[i];
      offsets[key] = accTop;
      try {
        const size = chart.paneSize(i);
        accTop += size.height;
      } catch {
        break;
      }
    }
    setPaneTopOffsets(offsets);
  }, []);

  // Main effect: create/destroy chart when panePlan changes
  useEffect(() => {
    if (!containerRef.current) return;

    disposedRef.current = false;

    // Clean up old chart
    if (chartRef.current) {
      try { chartRef.current.remove(); } catch { /* ignore */ }
      chartRef.current = null;
    }

    // Reset series refs
    mainSeriesRefs.current = createInitialMainSeriesRefs();
    subSeriesRefs.current = createInitialSubSeriesRefs();

    // Create chart
    const chart = createChart(containerRef.current, {
      attributionLogo: false,
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.BACKGROUND },
        textColor: CHART_COLORS.TEXT_SECONDARY,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      grid: {
        vertLines: { color: CHART_COLORS.GRID },
        horzLines: { color: CHART_COLORS.GRID },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.BORDER,
        scaleMargins: { top: 0.1, bottom: 0.1 },
        minimumWidth: RIGHT_PRICE_SCALE_MIN_WIDTH,
        entireTextOnly: true,
      },
      leftPriceScale: { visible: false },
      timeScale: {
        borderColor: CHART_COLORS.BORDER,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) => formatTickMark(time, tickMarkType),
        rightOffset: 5,
      },
      crosshair: {
        mode: 1,
        vertLine: { color: CHART_COLORS.CROSSHAIR, width: 1, style: 1 },
        horzLine: { color: CHART_COLORS.CROSSHAIR, width: 1, style: 1 },
      },
    });

    chartRef.current = chart;

    // Remove extra panes if any exist
    const paneApis = chart.panes();
    for (let i = paneApis.length - 1; i >= 1; i -= 1) {
      try { chart.removePane(i); } catch { /* ignore */ }
    }

    // Create required panes
    const requiredPanes = panePlan.length;
    for (let i = 1; i < requiredPanes; i += 1) {
      chart.addPane(true);
    }

    // Set stretch factors
    const panes = chart.panes();
    const subCount = requiredPanes - 1;
    const mainRatio = subCount === 0 ? 1 : subCount === 1 ? 0.75 : subCount === 2 ? 0.6 : 0.5;
    const subRatio = subCount === 0 ? 0 : (1 - mainRatio) / subCount;
    panes.forEach((p, idx) => {
      try { p.setStretchFactor(idx === 0 ? mainRatio : subRatio); } catch { /* ignore */ }
    });

    computePaneOffsets(chart, panePlan);

    // === Create main chart series (pane 0) ===
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.UP,
      downColor: CHART_COLORS.DOWN,
      borderVisible: false,
      wickUpColor: CHART_COLORS.UP,
      wickDownColor: CHART_COLORS.DOWN,
      priceFormat: {
        type: 'custom',
        formatter: (p: number) => formatAxisPrice(p, 2),
      },
    }, 0);
    mainSeriesRefs.current.candle = candleSeries;

    // === Create sub-pane series ===
    const paneIndexByType = new Map(panePlan.map((t, idx) => [t, idx] as const));

    // VOL
    if (paneIndexByType.has('VOL')) {
      const paneIndex = paneIndexByType.get('VOL')!;
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'custom', formatter: (v: number) => formatAxisVolume(v) },
        priceScaleId: 'right',
      }, paneIndex);
      subSeriesRefs.current.volume = volSeries;
    }

    // MACD
    if (paneIndexByType.has('MACD')) {
      const paneIndex = paneIndexByType.get('MACD')!;
      const hist = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'custom', formatter: (v: number) => formatAxisIndicator(v, 2) },
        priceScaleId: 'right',
        lastValueVisible: false,
        priceLineVisible: false,
      }, paneIndex);
      const dif = chart.addSeries(LineSeries, {
        color: CHART_COLORS.MACD_DIF,
        lineWidth: 1,
        priceFormat: { type: 'custom', formatter: (v: number) => formatAxisIndicator(v, 2) },
        priceScaleId: 'right',
        lastValueVisible: false,
        priceLineVisible: false,
      }, paneIndex);
      const dea = chart.addSeries(LineSeries, {
        color: CHART_COLORS.MACD_DEA,
        lineWidth: 1,
        priceFormat: { type: 'custom', formatter: (v: number) => formatAxisIndicator(v, 2) },
        priceScaleId: 'right',
        lastValueVisible: false,
        priceLineVisible: false,
      }, paneIndex);
      subSeriesRefs.current.macd = { dif, dea, hist };
    }

    // RSI
    if (paneIndexByType.has('RSI')) {
      const paneIndex = paneIndexByType.get('RSI')!;
      const overbought = chart.addSeries(LineSeries, {
        color: CHART_COLORS.RSI_OVERBOUGHT_LINE,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceScaleId: 'right',
        lastValueVisible: false,
        priceLineVisible: false,
      }, paneIndex);
      const oversold = chart.addSeries(LineSeries, {
        color: CHART_COLORS.RSI_OVERSOLD_LINE,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceScaleId: 'right',
        lastValueVisible: false,
        priceLineVisible: false,
      }, paneIndex);
      const rsi = chart.addSeries(LineSeries, {
        color: CHART_COLORS.RSI,
        lineWidth: 2,
        priceScaleId: 'right',
        lastValueVisible: false,
        priceLineVisible: false,
      }, paneIndex);
      subSeriesRefs.current.rsi = { rsi, overbought, oversold };

      // Fix RSI axis 0-100
      try {
        chart.priceScale('right', paneIndex).applyOptions({
          autoScale: false,
          scaleMargins: { top: 0.05, bottom: 0.05 },
        });
        chart.priceScale('right', paneIndex).setVisibleRange({ from: 0, to: 100 });
      } catch { /* ignore */ }
    }

    // Crosshair move handler
    const onMove = (param: MouseEventParams) => {
      const time = param.time ?? null;
      if (!time) {
        setHoverTime(null);
        setHoverIndex(null);
        onCrosshairMoveRef.current?.(null, null);
        return;
      }
      const list = candlesRef.current ?? [];
      const idx = list.findIndex((c) => timeToChartTime(c.time) === time);
      setHoverTime(time);
      setHoverIndex(idx >= 0 ? idx : null);
      onCrosshairMoveRef.current?.(time, idx >= 0 ? idx : null);
    };
    try { chart.subscribeCrosshairMove(onMove); } catch { /* ignore */ }

    // Visible range change handler
    const onRange = (range: LogicalRange | null) => {
      if (!range) return;
      const dataEnd = (candlesRef.current ?? []).length - 1;
      const isAtEnd = dataEnd <= 0 ? true : range.to >= dataEnd * 0.995;
      onVisibleRangeChangeRef.current?.(isAtEnd);
    };
    try { chart.timeScale().subscribeVisibleLogicalRangeChange(onRange); } catch { /* ignore */ }

    // ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (disposedRef.current) return;
        const el = containerRef.current;
        if (!el) return;
        try {
          chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
          computePaneOffsets(chart, panePlan);
        } catch { /* ignore */ }
      });
    });
    resizeObserver.observe(containerRef.current);

    setChartEpoch((x) => x + 1);

    return () => {
      disposedRef.current = true;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      resizeObserver.disconnect();
      try { chart.unsubscribeCrosshairMove(onMove); } catch { /* ignore */ }
      try { chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange); } catch { /* ignore */ }
      try { chart.remove(); } catch { /* ignore */ }
      chartRef.current = null;
    };
  }, [panePlan, containerRef, candlesRef, computePaneOffsets]);

  return {
    chart: chartRef.current,
    chartEpoch,
    mainSeriesRefs,
    subSeriesRefs,
    hoverTime,
    hoverIndex,
    paneTopOffsets,
    getSafeChart,
  };
}
