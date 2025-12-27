/**
 * OverlayLabels Component
 * 
 * 职责：渲染 VOL/MACD/RSI 浮动标签（显示当前 hover 或最新数据）
 */

import React from 'react';
import type { Candle, IndicatorData } from '../../../../../types';
import { CHART_COLORS } from '../utils/chartColors';
import { formatAxisVolume, formatAxisIndicator } from '../utils/dataTransform';

export interface OverlayLabelsProps {
  showVolume: boolean;
  showMacd: boolean;
  showRsi: boolean;
  paneTopOffsets: Record<string, number>;
  labelIndex: number;
  candles: Candle[];
  indicatorData: IndicatorData;
  labelTimeStr: string | null;
}

export const OverlayLabels: React.FC<OverlayLabelsProps> = React.memo(function OverlayLabels({
  showVolume,
  showMacd,
  showRsi,
  paneTopOffsets,
  labelIndex,
  candles,
  indicatorData,
  labelTimeStr,
}) {
  const hasData = candles.length > 0 && labelIndex >= 0 && labelIndex < candles.length;

  const volText = hasData ? formatAxisVolume(candles[labelIndex].volume) : '-';
  const difText = hasData ? formatAxisIndicator(indicatorData.macdDif[labelIndex] ?? NaN, 2) : '-';
  const deaText = hasData ? formatAxisIndicator(indicatorData.macdDea[labelIndex] ?? NaN, 2) : '-';
  const histText = hasData ? formatAxisIndicator(indicatorData.macdHist[labelIndex] ?? NaN, 2) : '-';
  const rsiText =
    hasData && indicatorData.rsi14[labelIndex] !== null && indicatorData.rsi14[labelIndex] !== undefined
      ? (indicatorData.rsi14[labelIndex] as number).toFixed(2)
      : '-';

  const volTop = (paneTopOffsets.VOL ?? 0) + 6;
  const macdTop = (paneTopOffsets.MACD ?? 0) + 6;
  const rsiTop = (paneTopOffsets.RSI ?? 0) + 6;

  return (
    <>
      {/* VOL label */}
      {showVolume && (
        <div
          className="absolute left-2 z-10 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-mono pointer-events-none"
          style={{ top: `${volTop}px` }}
        >
          <span className="text-neutral-500">VOL</span>
          {labelTimeStr && <span className="text-neutral-600 ml-1">{labelTimeStr}</span>}
          <span className="text-neutral-400">{volText}</span>
        </div>
      )}

      {/* MACD label */}
      {showMacd && (
        <div
          className="absolute left-2 z-10 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-mono pointer-events-none"
          style={{ top: `${macdTop}px` }}
        >
          <span className="text-neutral-500">MACD(12,26,9)</span>
          {labelTimeStr && <span className="text-neutral-600 ml-1">{labelTimeStr}</span>}
          <span style={{ color: CHART_COLORS.MACD_DIF }}>DIF:{difText}</span>
          <span style={{ color: CHART_COLORS.MACD_DEA }}>DEA:{deaText}</span>
          <span
            style={{
              color:
                hasData && (indicatorData.macdHist[labelIndex] ?? 0) >= 0
                  ? CHART_COLORS.MACD_HIST_UP
                  : CHART_COLORS.MACD_HIST_DOWN,
            }}
          >
            MACD:{histText}
          </span>
        </div>
      )}

      {/* RSI label */}
      {showRsi && (
        <div
          className="absolute left-2 z-10 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-mono pointer-events-none"
          style={{ top: `${rsiTop}px` }}
        >
          <span className="text-neutral-500">RSI(14)</span>
          {labelTimeStr && <span className="text-neutral-600 ml-1">{labelTimeStr}</span>}
          <span style={{ color: CHART_COLORS.RSI }}>RSI:{rsiText}</span>
        </div>
      )}
    </>
  );
});
