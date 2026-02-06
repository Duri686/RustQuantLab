/**
 * DepthChart - 深度图组件 (v2)
 * Canvas + React 混合渲染的币安风格市场深度图
 * - Canvas: 阶梯面积图 (渐变填充)、网格、十字光标
 * - React: 实时数据叠层、买卖力量比、缩放控件
 */

import { memo, useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';

/* ============================================
   Types
   ============================================ */

interface DepthChartProps {
  /** 买单 [价格, 数量][], 按价格降序 */
  bids: [number, number][];
  /** 卖单 [价格, 数量][], 按价格升序 */
  asks: [number, number][];
  /** 当前中间价 */
  price?: number;
}

interface DepthPoint {
  price: number;
  cumVolume: number;
}

/* ============================================
   Constants
   ============================================ */

const PADDING = { top: 28, right: 56, bottom: 28, left: 12 };

const BID = {
  line: '#0ECB81',
  gradTop: 'rgba(14, 203, 129, 0.03)',
  gradBottom: 'rgba(14, 203, 129, 0.22)',
};
const ASK = {
  line: '#F6465D',
  gradTop: 'rgba(246, 70, 93, 0.03)',
  gradBottom: 'rgba(246, 70, 93, 0.22)',
};
const GRID = 'rgba(43, 47, 54, 0.5)';
const LABEL_COLOR = '#5e6673';
const CROSSHAIR = 'rgba(132, 142, 156, 0.35)';

/** 缩放档位: 显示全部深度的百分比 */
const ZOOM_STEPS = [0.1, 0.25, 0.5, 1.0] as const;
const DEFAULT_ZOOM = 1;

/* ============================================
   数据处理
   ============================================ */

function buildDepth(bids: [number, number][], asks: [number, number][]) {
  // 买单：从 best bid 向外累加，反转为 [低价 → 高价]
  const bidPts: DepthPoint[] = [];
  let cum = 0;
  for (const [p, a] of bids) {
    cum += a;
    bidPts.push({ price: p, cumVolume: cum });
  }
  bidPts.reverse();

  // 卖单：从 best ask 向外累加 [低价 → 高价]
  const askPts: DepthPoint[] = [];
  cum = 0;
  for (const [p, a] of asks) {
    cum += a;
    askPts.push({ price: p, cumVolume: cum });
  }

  return { bidPts, askPts };
}

/* ============================================
   Canvas 绘制辅助
   ============================================ */

/** 阶梯拐角平滑半径 (px) — 保留梯度感的同时消除锯齿 */
const CORNER_R = 3;

/**
 * 绘制平滑阶梯路径 (共用于 fill 和 stroke)
 * 在每个拐角处使用 quadraticCurveTo 做微弧过渡
 */
function traceSmoothedSteps(
  ctx: CanvasRenderingContext2D,
  points: DepthPoint[],
  mapX: (p: number) => number,
  mapY: (v: number) => number,
  fromBaseY?: number,
) {
  if (fromBaseY != null) {
    ctx.moveTo(mapX(points[0].price), fromBaseY);
    ctx.lineTo(mapX(points[0].price), mapY(points[0].cumVolume));
  } else {
    ctx.moveTo(mapX(points[0].price), mapY(points[0].cumVolume));
  }

  let prevX = mapX(points[0].price);

  for (let i = 1; i < points.length; i++) {
    const prevY = mapY(points[i - 1].cumVolume);
    const currX = mapX(points[i].price);
    const currY = mapY(points[i].cumVolume);
    const dy = currY - prevY;
    const dx = Math.abs(currX - prevX);

    if (Math.abs(dy) < 1) {
      // 几乎同一高度 → 直线
      ctx.lineTo(currX, currY);
    } else {
      // 拐角平滑: 限制半径不超过步高和水平距的 35%
      const r = Math.min(CORNER_R, Math.abs(dy) * 0.35, dx * 0.35);
      ctx.lineTo(currX - r, prevY);                                          // 水平段
      ctx.quadraticCurveTo(currX, prevY, currX, prevY + Math.sign(dy) * r);  // 弧形拐角
      ctx.lineTo(currX, currY);                                              // 垂直段
    }

    prevX = currX;
  }
}

/** 绘制阶梯面积 (渐变填充 + 轮廓线, 拐角微弧平滑) */
function drawStepGradient(
  ctx: CanvasRenderingContext2D,
  points: DepthPoint[],
  mapX: (p: number) => number,
  mapY: (v: number) => number,
  baseY: number,
  topY: number,
  color: { line: string; gradTop: string; gradBottom: string },
) {
  if (points.length === 0) return;

  // 渐变填充
  ctx.beginPath();
  traceSmoothedSteps(ctx, points, mapX, mapY, baseY);
  ctx.lineTo(mapX(points[points.length - 1].price), baseY);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, topY, 0, baseY);
  grad.addColorStop(0, color.gradTop);
  grad.addColorStop(1, color.gradBottom);
  ctx.fillStyle = grad;
  ctx.fill();

  // 轮廓线 (仅顶部阶梯)
  ctx.beginPath();
  traceSmoothedSteps(ctx, points, mapX, mapY);
  ctx.strokeStyle = color.line;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** 格式化数量 */
function fmtVol(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

/* ============================================
   组件
   ============================================ */

function DepthChart({ bids, asks, price }: DepthChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_ZOOM);

  const zoom = ZOOM_STEPS[zoomIdx];

  // 累积深度
  const { bidPts, askPts } = useMemo(() => buildDepth(bids, asks), [bids, asks]);

  // 实时统计 (React 渲染，天然实时)
  const stats = useMemo(() => {
    const bestBid = bids.length > 0 ? bids[0][0] : 0;
    const bestAsk = asks.length > 0 ? asks[0][0] : 0;
    const spread = bestAsk - bestBid;
    const spreadPct = bestBid > 0 ? (spread / bestBid) * 100 : 0;
    const totalBid = bids.reduce((s, [, a]) => s + a, 0);
    const totalAsk = asks.reduce((s, [, a]) => s + a, 0);
    const total = totalBid + totalAsk;
    const bidRatio = total > 0 ? totalBid / total : 0.5;
    return { bestBid, bestAsk, spread, spreadPct, totalBid, totalAsk, bidRatio };
  }, [bids, asks]);

  // 可视价格范围 (基于缩放，聚焦中间价附近)
  const priceRange = useMemo(() => {
    if (bidPts.length === 0 && askPts.length === 0) return { min: 0, max: 1 };
    const allPrices = [...bidPts.map((p) => p.price), ...askPts.map((p) => p.price)];
    const fullMin = Math.min(...allPrices);
    const fullMax = Math.max(...allPrices);
    const fullSpread = fullMax - fullMin || 1;
    const mid = price ?? (fullMin + fullMax) / 2;
    const halfRange = (fullSpread * zoom) / 2;
    return { min: mid - halfRange * 1.05, max: mid + halfRange * 1.05 };
  }, [bidPts, askPts, price, zoom]);

  // 仅渲染可视范围内的点
  const visibleBids = useMemo(
    () => bidPts.filter((p) => p.price >= priceRange.min && p.price <= priceRange.max),
    [bidPts, priceRange],
  );
  const visibleAsks = useMemo(
    () => askPts.filter((p) => p.price >= priceRange.min && p.price <= priceRange.max),
    [askPts, priceRange],
  );

  const maxVol = useMemo(() => {
    const mb = visibleBids.length > 0 ? Math.max(...visibleBids.map((p) => p.cumVolume)) : 0;
    const ma = visibleAsks.length > 0 ? Math.max(...visibleAsks.map((p) => p.cumVolume)) : 0;
    return Math.max(mb, ma);
  }, [visibleBids, visibleAsks]);

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

  // ---- Canvas 渲染 ----
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
    ctx.clearRect(0, 0, size.w, size.h);

    const plotW = size.w - PADDING.left - PADDING.right;
    const plotH = size.h - PADDING.top - PADDING.bottom;
    const baseY = size.h - PADDING.bottom;

    // 空数据
    if (visibleBids.length === 0 && visibleAsks.length === 0) {
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = '12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('等待深度数据...', size.w / 2, size.h / 2);
      return;
    }

    // 坐标映射
    const maxY = maxVol * 1.1;
    const mapX = (p: number) =>
      PADDING.left + ((p - priceRange.min) / (priceRange.max - priceRange.min)) * plotW;
    const mapY = (v: number) => PADDING.top + plotH - (v / maxY) * plotH;

    // ---- 网格线 ----
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 0.5;
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const y = PADDING.top + (plotH / yTicks) * i;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(PADDING.left + plotW, y);
      ctx.stroke();
      const vol = maxY * (1 - i / yTicks);
      ctx.fillStyle = LABEL_COLOR;
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(fmtVol(vol), PADDING.left + plotW + 4, y + 3);
    }

    // ---- 阶梯面积 (渐变填充, 币安风格: 红绿衔接无间隙) ----
    const dynamicMid = (stats.bestBid > 0 && stats.bestAsk > 0)
      ? (stats.bestBid + stats.bestAsk) / 2
      : price ?? 0;

    // 虚拟边缘点: 左边缘 + 中心归零 (bid); 中心归零 + 右边缘 (ask)
    const bidEdgePts = visibleBids.length > 0
      ? [
          { price: priceRange.min, cumVolume: visibleBids[0].cumVolume },
          ...visibleBids,
          { price: dynamicMid, cumVolume: 0 },
        ]
      : visibleBids;
    const askEdgePts = visibleAsks.length > 0
      ? [
          { price: dynamicMid, cumVolume: 0 },
          ...visibleAsks,
          { price: priceRange.max, cumVolume: visibleAsks[visibleAsks.length - 1].cumVolume },
        ]
      : visibleAsks;

    drawStepGradient(ctx, bidEdgePts, mapX, mapY, baseY, PADDING.top, BID);
    drawStepGradient(ctx, askEdgePts, mapX, mapY, baseY, PADDING.top, ASK);

    // ---- 中心价格标签 (替代黄色虚线, 仅底部显示) ----
    if (dynamicMid > 0) {
      const midX = mapX(dynamicMid);
      const bidLabel = stats.bestBid.toFixed(2);
      const askLabel = stats.bestAsk.toFixed(2);
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = BID.line;
      ctx.fillText(bidLabel, midX - 4, baseY + 16);
      ctx.textAlign = 'left';
      ctx.fillStyle = ASK.line;
      ctx.fillText(askLabel, midX + 4, baseY + 16);
    }

    // ---- X 轴价格标签 ----
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    const midX = dynamicMid > 0 ? mapX(dynamicMid) : -999;
    const xTicks = Math.min(6, Math.floor(plotW / 80));
    for (let i = 0; i <= xTicks; i++) {
      const p = priceRange.min + ((priceRange.max - priceRange.min) / xTicks) * i;
      const x = mapX(p);
      if (Math.abs(x - midX) < 60) continue;
      ctx.fillText(p.toFixed(2), x, baseY + 16);
    }

    // ---- 十字光标 + Tooltip ----
    if (mouse && mouse.x >= PADDING.left && mouse.x <= PADDING.left + plotW) {
      const mx = mouse.x;
      const my = mouse.y;

      ctx.strokeStyle = CROSSHAIR;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(mx, PADDING.top);
      ctx.lineTo(mx, baseY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(PADDING.left, my);
      ctx.lineTo(PADDING.left + plotW, my);
      ctx.stroke();
      ctx.setLineDash([]);

      const mousePrice =
        priceRange.min + ((mx - PADDING.left) / plotW) * (priceRange.max - priceRange.min);
      let cumVol: number | null = null;
      let side = '';

      const midPrice = price ?? (bidPts.length > 0 && askPts.length > 0
        ? (bidPts[bidPts.length - 1].price + askPts[0].price) / 2
        : 0);

      if (mousePrice <= midPrice && visibleBids.length > 0) {
        side = 'BID';
        for (let i = visibleBids.length - 1; i >= 0; i--) {
          if (visibleBids[i].price <= mousePrice) {
            cumVol = visibleBids[i].cumVolume;
            break;
          }
        }
        if (cumVol === null) cumVol = visibleBids[0].cumVolume;
      } else if (visibleAsks.length > 0) {
        side = 'ASK';
        for (let i = visibleAsks.length - 1; i >= 0; i--) {
          if (visibleAsks[i].price <= mousePrice) {
            cumVol = visibleAsks[i].cumVolume;
            break;
          }
        }
        if (cumVol === null) cumVol = 0;
      }

      if (cumVol !== null) {
        ctx.font = '10px ui-monospace, monospace';
        const l1 = `${mousePrice.toFixed(2)}`;
        const l2 = `${side} ${fmtVol(cumVol)}`;
        const tw2 = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 16;
        const th = 34;
        const tx = mx + tw2 + 12 > size.w ? mx - tw2 - 8 : mx + 10;
        const ty = Math.max(Math.min(my - 20, baseY - th), PADDING.top);
        ctx.fillStyle = 'rgba(30, 32, 38, 0.92)';
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw2, th, 4);
        ctx.fill();
        ctx.strokeStyle = 'rgba(43, 47, 54, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#eaecef';
        ctx.fillText(l1, tx + 8, ty + 14);
        ctx.fillStyle = side === 'BID' ? BID.line : ASK.line;
        ctx.fillText(l2, tx + 8, ty + 27);
      }
    }
  }, [size, visibleBids, visibleAsks, bidPts, askPts, price, maxVol, priceRange, mouse, stats.bestBid, stats.bestAsk]);

  // ---- 事件处理 ----
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    [],
  );
  const handleMouseLeave = useCallback(() => setMouse(null), []);
  const zoomIn = useCallback(() => setZoomIdx((i) => Math.max(0, i - 1)), []);
  const zoomOut = useCallback(() => setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1)), []);

  const hasData = bids.length > 0 || asks.length > 0;

  return (
    <div ref={containerRef} className="w-full h-full bg-terminal-bg relative">
      {/* Canvas 图表 */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full h-full cursor-crosshair"
      />

      {/* ---- 实时数据叠层 (React 渲染，每次 props 更新自动刷新) ---- */}
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

      {/* ---- 买卖力量比进度条 ---- */}
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

      {/* ---- 缩放控件 ---- */}
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
          disabled={zoomIdx === ZOOM_STEPS.length - 1}
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
