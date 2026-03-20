/**
 * depthCanvas - Canvas 绘制纯函数模块
 * 无 React 依赖，纯逻辑模块
 */

/* ============================================
   Types
   ============================================ */

export interface DepthPoint {
    price: number;
    cumVolume: number;
}

export interface PriceRange {
    min: number;
    max: number;
}

export interface DepthStats {
    bestBid: number;
    bestAsk: number;
    spread: number;
    spreadPct: number;
    totalBid: number;
    totalAsk: number;
    bidRatio: number;
}

export interface DrawDepthOptions {
    width: number;
    height: number;
    visibleBids: DepthPoint[];
    visibleAsks: DepthPoint[];
    priceRange: PriceRange;
    maxVol: number;
    stats: DepthStats;
    price?: number;
    mouse?: { x: number; y: number } | null;
    bidPts: DepthPoint[];
    askPts: DepthPoint[];
}

/* ============================================
   Constants
   ============================================ */

export const PADDING = { top: 28, right: 56, bottom: 28, left: 12 };

export const BID = {
    line: '#0ECB81',
    gradTop: 'rgba(14, 203, 129, 0.03)',
    gradBottom: 'rgba(14, 203, 129, 0.22)',
};

export const ASK = {
    line: '#F6465D',
    gradTop: 'rgba(246, 70, 93, 0.03)',
    gradBottom: 'rgba(246, 70, 93, 0.22)',
};

const GRID = 'rgba(43, 47, 54, 0.5)';
const LABEL_COLOR = '#5e6673';
const CROSSHAIR = 'rgba(132, 142, 156, 0.35)';
const CORNER_R = 3;

/* ============================================
   格式化函数
   ============================================ */

export function fmtVol(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    if (v >= 1) return v.toFixed(2);
    return v.toFixed(4);
}

/* ============================================
   路径绘制
   ============================================ */

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
            ctx.lineTo(currX, currY);
        } else {
            const r = Math.min(CORNER_R, Math.abs(dy) * 0.35, dx * 0.35);
            ctx.lineTo(currX - r, prevY);
            ctx.quadraticCurveTo(currX, prevY, currX, prevY + Math.sign(dy) * r);
            ctx.lineTo(currX, currY);
        }

        prevX = currX;
    }
}

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

    ctx.beginPath();
    traceSmoothedSteps(ctx, points, mapX, mapY, baseY);
    ctx.lineTo(mapX(points[points.length - 1].price), baseY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, topY, 0, baseY);
    grad.addColorStop(0, color.gradTop);
    grad.addColorStop(1, color.gradBottom);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    traceSmoothedSteps(ctx, points, mapX, mapY);
    ctx.strokeStyle = color.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();
}

/* ============================================
   主绘制函数
   ============================================ */

export function drawDepthChart(
    ctx: CanvasRenderingContext2D,
    options: DrawDepthOptions,
): void {
    const { width, height, visibleBids, visibleAsks, priceRange, maxVol, stats, price, mouse, bidPts, askPts } = options;

    ctx.clearRect(0, 0, width, height);

    const plotW = width - PADDING.left - PADDING.right;
    const plotH = height - PADDING.top - PADDING.bottom;
    const baseY = height - PADDING.bottom;

    // 空数据
    if (visibleBids.length === 0 && visibleAsks.length === 0) {
        ctx.fillStyle = LABEL_COLOR;
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('等待深度数据...', width / 2, height / 2);
        return;
    }

    // 坐标映射
    const maxY = maxVol * 1.1;
    const mapX = (p: number) =>
        PADDING.left + ((p - priceRange.min) / (priceRange.max - priceRange.min)) * plotW;
    const mapY = (v: number) => PADDING.top + plotH - (v / maxY) * plotH;

    // 网格线
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

    // 阶梯面积
    const dynamicMid = (stats.bestBid > 0 && stats.bestAsk > 0)
        ? (stats.bestBid + stats.bestAsk) / 2
        : price ?? 0;

    // 买方：按价格升序排列（从左到右），累积量从大到小
    const sortedBids = [...visibleBids].reverse();
    const bidEdgePts = sortedBids.length > 0
        ? [
            { price: priceRange.min, cumVolume: sortedBids[0].cumVolume },
            ...sortedBids,
            { price: dynamicMid, cumVolume: 0 },
        ]
        : sortedBids;
    const askEdgePts = visibleAsks.length > 0
        ? [
            { price: dynamicMid, cumVolume: 0 },
            ...visibleAsks,
            { price: priceRange.max, cumVolume: visibleAsks[visibleAsks.length - 1].cumVolume },
        ]
        : visibleAsks;

    drawStepGradient(ctx, bidEdgePts, mapX, mapY, baseY, PADDING.top, BID);
    drawStepGradient(ctx, askEdgePts, mapX, mapY, baseY, PADDING.top, ASK);

    // 中心价格标签
    if (dynamicMid > 0) {
        const midX = mapX(dynamicMid);
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = BID.line;
        ctx.fillText(stats.bestBid.toFixed(2), midX - 4, baseY + 16);
        ctx.textAlign = 'left';
        ctx.fillStyle = ASK.line;
        ctx.fillText(stats.bestAsk.toFixed(2), midX + 4, baseY + 16);
    }

    // X 轴价格标签
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

    // 十字光标 + Tooltip
    if (mouse && mouse.x >= PADDING.left && mouse.x <= PADDING.left + plotW) {
        drawCrosshair(ctx, mouse, width, baseY, plotW, priceRange, visibleBids, visibleAsks, bidPts, askPts, price);
    }
}

function drawCrosshair(
    ctx: CanvasRenderingContext2D,
    mouse: { x: number; y: number },
    width: number,
    baseY: number,
    plotW: number,
    priceRange: PriceRange,
    visibleBids: DepthPoint[],
    visibleAsks: DepthPoint[],
    bidPts: DepthPoint[],
    askPts: DepthPoint[],
    price?: number,
) {
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
        const tx = mx + tw2 + 12 > width ? mx - tw2 - 8 : mx + 10;
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
