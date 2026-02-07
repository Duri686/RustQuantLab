/**
 * DepthChart - 深度图组件 (v2 Refactored)
 * Canvas + React 混合渲染的币安风格市场深度图
 */

import { memo, useRef, useEffect, useCallback, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { drawDepthChart, fmtVol } from './depthCanvas';
import { useDepthData } from './hooks/useDepthData';

/* ============================================
   Types
   ============================================ */

interface DepthChartProps {
  bids: [number, number][];
  asks: [number, number][];
  price?: number;
}

/* ============================================
   组件
   ============================================ */

function DepthChart({ bids, asks, price }: DepthChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);

  // 数据处理 Hook
  const {
    bidPts,
    askPts,
    visibleBids,
    visibleAsks,
    priceRange,
    maxVol,
    stats,
    zoomIdx,
    zoomIn,
    zoomOut,
    hasData,
  } = useDepthData(bids, asks, price);

  // 响应式尺寸
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Canvas 渲染
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    drawDepthChart(ctx, {
      width: size.w,
      height: size.h,
      visibleBids,
      visibleAsks,
      priceRange,
      maxVol,
      stats,
      price,
      mouse,
      bidPts,
      askPts,
    });
  }, [size, visibleBids, visibleAsks, bidPts, askPts, price, maxVol, priceRange, mouse, stats]);

  // 事件处理
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    [],
  );
  const handleMouseLeave = useCallback(() => setMouse(null), []);

  const ZOOM_STEPS_LEN = 4;

  return (
    <div ref={containerRef} className="w-full h-full bg-terminal-bg relative">
      {/* Canvas 图表 */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full h-full cursor-crosshair"
      />

      {/* 实时数据叠层 */}
      {hasData && (
        <div className="absolute top-1.5 left-3 flex items-center gap-3 text-[10px] font-mono pointer-events-none select-none">
          {price != null && (
            <span className="text-warning font-semibold tabular-nums">
              ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
          <span className="text-gray-500">
            Spread{' '}
            <span className="text-gray-400 tabular-nums">
              {stats.spread.toFixed(2)} ({stats.spreadPct.toFixed(3)}%)
            </span>
          </span>
          <span className="text-gray-500">
            Bid{' '}
            <span className="text-success tabular-nums">{fmtVol(stats.totalBid)}</span>
          </span>
          <span className="text-gray-500">
            Ask{' '}
            <span className="text-danger tabular-nums">{fmtVol(stats.totalAsk)}</span>
          </span>
        </div>
      )}

      {/* 买卖力量比进度条 */}
      {hasData && (
        <div className="absolute top-6 left-3 flex items-center gap-1.5 pointer-events-none select-none">
          <div className="w-28 h-1 rounded-full overflow-hidden bg-danger/30">
            <div
              className="h-full rounded-full bg-success transition-all duration-300 ease-out"
              style={{ width: `${stats.bidRatio * 100}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-gray-500 tabular-nums">
            {(stats.bidRatio * 100).toFixed(1)}%
          </span>
        </div>
      )}

      {/* 缩放控件 */}
      <div className="absolute bottom-10 right-16 flex flex-col gap-1">
        <button
          onClick={zoomIn}
          disabled={zoomIdx === 0}
          title="放大深度"
          className="w-6 h-6 rounded bg-bg-surface border border-border-dark flex items-center justify-center text-gray-400 hover:text-white hover:bg-bg-surface-alt disabled:opacity-30 transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={zoomOut}
          disabled={zoomIdx === ZOOM_STEPS_LEN - 1}
          title="缩小深度"
          className="w-6 h-6 rounded bg-bg-surface border border-border-dark flex items-center justify-center text-gray-400 hover:text-white hover:bg-bg-surface-alt disabled:opacity-30 transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default memo(DepthChart);
