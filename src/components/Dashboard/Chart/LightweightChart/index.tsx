/**
 * LightweightChart 组件入口
 * 多窗格 K 线图表系统
 */

import { useRef, useState, useMemo, forwardRef, useImperativeHandle, useCallback, useEffect } from 'react';
import type { Time } from 'lightweight-charts';
import type { Candle, IndicatorData } from '../../../../types/index';
import UnifiedMultiPaneChart, { type UnifiedMultiPaneChartHandle } from './UnifiedMultiPaneChart';
import { CHART_COLORS } from './utils/chartColors';
import { formatVolume, calculateChange, formatPercent } from './utils/dataTransform';

export interface LightweightChartProps {
  /** 已完成的 K 线历史数据 */
  candleHistory: Candle[];
  /** 当前实时 K 线 */
  currentLiveCandle: Candle | null;
  /** 指标数据 */
  indicatorData: IndicatorData;
  /** 激活的主图指标 */
  activeMainIndicators?: string[];
  /** 激活的副图指标 */
  activeSubIndicators?: string[];
}

export interface LightweightChartHandle {
  /** 截图 */
  takeScreenshot: () => void;
  /** 滚动到最新 */
  scrollToLatest: () => void;
}

/**
 * 多窗格 K 线图表组件
 */
const LightweightChart = forwardRef<LightweightChartHandle, LightweightChartProps>(
  function LightweightChart(
    {
      candleHistory,
      currentLiveCandle,
      indicatorData,
      activeMainIndicators = ['MA'],
      activeSubIndicators = ['VOL'],
    },
    ref
  ) {
    // Ref：单 chart 多 pane
    const chartRef = useRef<UnifiedMultiPaneChartHandle>(null);

    // 状态
    const [_hoverTime, setHoverTime] = useState<Time | null>(null);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [showReSync, setShowReSync] = useState(false);
    
    // 追踪上一次数据集的首个 K 线时间（用于检测时间周期切换）
    const prevFirstCandleTimeRef = useRef<number | null>(null);

    // 合并 K 线数据
    const allCandles = useMemo(() => {
      if (currentLiveCandle) {
        return [...candleHistory, currentLiveCandle];
      }
      return candleHistory;
    }, [candleHistory, currentLiveCandle]);

    // 检测时间周期切换（单 chart 版本无需额外同步，但保留此检测用于未来扩展）
    useEffect(() => {
      if (allCandles.length === 0) return;
      
      const currentFirstTime = allCandles[0]?.time ?? null;
      const prevFirstTime = prevFirstCandleTimeRef.current;
      
      // 如果首个 K 线时间变化，说明是时间周期切换
      if (prevFirstTime !== null && currentFirstTime !== prevFirstTime) {
        // no-op
      }
      
      prevFirstCandleTimeRef.current = currentFirstTime;
    }, [allCandles]);

    // 暴露方法
    useImperativeHandle(ref, () => ({
      takeScreenshot: () => {
        const dataUrl = chartRef.current?.takeScreenshot();
        if (!dataUrl) return;
        const link = document.createElement('a');
        link.download = `chart-${Date.now()}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      },
      scrollToLatest: () => {
        chartRef.current?.scrollToLatest(true);
      },
    }));

    // 十字光标移动回调
    const handleCrosshairMove = useCallback((time: Time | null, index: number | null) => {
      setHoverTime(time);
      setHoverIndex(index);
    }, []);

    // 可见范围变化回调
    const handleVisibleRangeChange = useCallback((isAtEnd: boolean) => {
      setShowReSync(!isAtEnd);
    }, []);

    // 点击跟随最新
    const handleReSync = useCallback(() => {
      chartRef.current?.scrollToLatest(true);
      setShowReSync(false);
    }, []);

    // 显示的数据（悬停时显示悬停位置，否则显示最新）
    const displayIndex = hoverIndex !== null ? hoverIndex : Math.max(0, allCandles.length - 1);
    const displayCandle = allCandles[displayIndex];

    // 空数据占位
    if (allCandles.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-2 border-warning-alt border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-neutral-500 font-mono text-sm">等待 K 线数据...</p>
          </div>
        </div>
      );
    }

    // 计算涨跌
    const isUp = displayCandle && displayCandle.close >= displayCandle.open;
    const priceColor = isUp ? CHART_COLORS.UP : CHART_COLORS.DOWN;
    const { changePercent } = displayCandle
      ? calculateChange(displayCandle.open, displayCandle.close)
      : { change: 0, changePercent: 0 };

    // 指标数据
    const displayMa7 = indicatorData.ma7[displayIndex];
    const displayMa25 = indicatorData.ma25[displayIndex];
    const displayMa99 = indicatorData.ma99[displayIndex];
    const displayEma7 = indicatorData.ema7[displayIndex];
    const displayEma25 = indicatorData.ema25[displayIndex];
    const displayBollUpper = indicatorData.bollUpper[displayIndex];
    const displayBollMid = indicatorData.bollMid[displayIndex];
    const displayBollLower = indicatorData.bollLower[displayIndex];
    const displayMacdDif = indicatorData.macdDif[displayIndex];
    const displayMacdDea = indicatorData.macdDea[displayIndex];
    const displayMacdHist = indicatorData.macdHist[displayIndex];
    const displayRsi = indicatorData.rsi14[displayIndex];

    // 副图指标状态（用于顶部数据展示）
    const showMacd = activeSubIndicators.includes('MACD');
    const showRsi = activeSubIndicators.includes('RSI');

    return (
      <div className="w-full h-full flex flex-col overflow-hidden relative">
        {/* 头部数据显示 */}
        {displayCandle && (
          <div
            className="absolute top-1 left-1 z-10 flex flex-wrap items-center gap-x-3 gap-y-0.5
                       text-[10px] md:text-xs font-mono pointer-events-none
                       bg-bg-surface-alt/80 backdrop-blur-sm rounded px-2 py-1"
          >
            {/* 时间 */}
            <span className="text-neutral-400">{displayCandle.timeStr}</span>
            
            {/* OHLC */}
            <span className="text-neutral-500">开</span>
            <span style={{ color: priceColor }}>{displayCandle.open.toFixed(2)}</span>
            <span className="text-neutral-500">高</span>
            <span style={{ color: priceColor }}>{displayCandle.high.toFixed(2)}</span>
            <span className="text-neutral-500">低</span>
            <span style={{ color: priceColor }}>{displayCandle.low.toFixed(2)}</span>
            <span className="text-neutral-500">收</span>
            <span style={{ color: priceColor }}>{displayCandle.close.toFixed(2)}</span>
            
            {/* 涨跌 */}
            <span style={{ color: priceColor }}>{formatPercent(changePercent)}</span>
            
            {/* 成交量 */}
            <span className="text-neutral-500">量 {formatVolume(displayCandle.volume)}</span>

            {/* MA */}
            {activeMainIndicators.includes('MA') && (
              <>
                <span className="text-neutral-600 ml-2">|</span>
                <span style={{ color: CHART_COLORS.MA7 }}>
                  MA7:{displayMa7 != null ? displayMa7.toFixed(2) : '-'}
                </span>
                <span style={{ color: CHART_COLORS.MA25 }}>
                  MA25:{displayMa25 != null ? displayMa25.toFixed(2) : '-'}
                </span>
                <span style={{ color: CHART_COLORS.MA99 }}>
                  MA99:{displayMa99 != null ? displayMa99.toFixed(2) : '-'}
                </span>
              </>
            )}

            {/* EMA */}
            {activeMainIndicators.includes('EMA') && (
              <>
                <span className="text-neutral-600 ml-2">|</span>
                <span style={{ color: CHART_COLORS.EMA7 }}>
                  EMA7:{displayEma7 != null ? displayEma7.toFixed(2) : '-'}
                </span>
                <span style={{ color: CHART_COLORS.EMA25 }}>
                  EMA25:{displayEma25 != null ? displayEma25.toFixed(2) : '-'}
                </span>
              </>
            )}

            {/* BOLL */}
            {activeMainIndicators.includes('BOLL') && (
              <>
                <span className="text-neutral-600 ml-2">|</span>
                <span className="text-neutral-500">BOLL(20,2)</span>
                <span style={{ color: CHART_COLORS.BOLL_UPPER }}>
                  上:{displayBollUpper != null ? displayBollUpper.toFixed(2) : '-'}
                </span>
                <span style={{ color: CHART_COLORS.BOLL_MID }}>
                  中:{displayBollMid != null ? displayBollMid.toFixed(2) : '-'}
                </span>
                <span style={{ color: CHART_COLORS.BOLL_LOWER }}>
                  下:{displayBollLower != null ? displayBollLower.toFixed(2) : '-'}
                </span>
              </>
            )}

            {/* MACD */}
            {showMacd && (
              <>
                <span className="text-neutral-600 ml-2">|</span>
                <span className="text-neutral-500">MACD</span>
                <span style={{ color: CHART_COLORS.MACD_DIF }}>
                  DIF:{displayMacdDif != null ? displayMacdDif.toFixed(2) : '-'}
                </span>
                <span style={{ color: CHART_COLORS.MACD_DEA }}>
                  DEA:{displayMacdDea != null ? displayMacdDea.toFixed(2) : '-'}
                </span>
                <span
                  style={{
                    color:
                      displayMacdHist != null && displayMacdHist >= 0
                        ? CHART_COLORS.MACD_HIST_UP
                        : CHART_COLORS.MACD_HIST_DOWN,
                  }}
                >
                  MACD:{displayMacdHist != null ? displayMacdHist.toFixed(4) : '-'}
                </span>
              </>
            )}

            {/* RSI */}
            {showRsi && (
              <>
                <span className="text-neutral-600 ml-2">|</span>
                <span style={{ color: CHART_COLORS.RSI }}>
                  RSI(14):{displayRsi != null ? displayRsi.toFixed(2) : '-'}
                </span>
              </>
            )}
          </div>
        )}

        {/* 跟随最新按钮 */}
        {showReSync && (
          <div className="absolute top-12 right-2 z-20">
            <button
              onClick={handleReSync}
              className="flex items-center gap-1.5 px-3 py-1.5
                         bg-success hover:opacity-80
                         text-white text-[10px] md:text-xs font-medium
                         rounded-md transition-colors shadow-lg"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M6 2V6L8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              跟随最新
            </button>
          </div>
        )}

        {/* 单 Chart 多 Pane：主图 + VOL/MACD/RSI 一起绘制（彻底消除缩放/拖拽不同步） */}
        <div className="flex-1 min-h-0">
          <UnifiedMultiPaneChart
            ref={chartRef}
            candles={allCandles}
            indicatorData={indicatorData}
            activeMainIndicators={activeMainIndicators}
            activeSubIndicators={activeSubIndicators}
            onCrosshairMove={handleCrosshairMove}
            onVisibleRangeChange={handleVisibleRangeChange}
          />
        </div>
      </div>
    );
  }
);

export default LightweightChart;
export type { LightweightChartHandle };

