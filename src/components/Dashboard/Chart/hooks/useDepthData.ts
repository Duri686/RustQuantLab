/**
 * useDepthData - 深度图数据处理 Hook
 * 封装累积深度计算、可视范围筛选、缩放状态
 */

import { useState, useMemo, useCallback } from 'react';
import type { DepthPoint, PriceRange, DepthStats } from '../depthCanvas';

/* ============================================
   Constants
   ============================================ */

const ZOOM_STEPS = [0.1, 0.25, 0.5, 1.0] as const;
const DEFAULT_ZOOM = 3; // 默认 1.0 (全范围)

/* ============================================
   Types
   ============================================ */

export interface UseDepthDataResult {
    bidPts: DepthPoint[];
    askPts: DepthPoint[];
    visibleBids: DepthPoint[];
    visibleAsks: DepthPoint[];
    priceRange: PriceRange;
    maxVol: number;
    stats: DepthStats;
    zoom: number;
    zoomIdx: number;
    zoomIn: () => void;
    zoomOut: () => void;
    hasData: boolean;
}

/* ============================================
   数据处理函数
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
   Hook
   ============================================ */

export function useDepthData(
    bids: [number, number][],
    asks: [number, number][],
    price?: number,
): UseDepthDataResult {
    const [zoomIdx, setZoomIdx] = useState(DEFAULT_ZOOM);
    const zoom = ZOOM_STEPS[zoomIdx];

    // 累积深度
    const { bidPts, askPts } = useMemo(() => buildDepth(bids, asks), [bids, asks]);

    // 实时统计
    const stats = useMemo<DepthStats>(() => {
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

    // 可视价格范围
    const priceRange = useMemo<PriceRange>(() => {
        if (bidPts.length === 0 && askPts.length === 0) return { min: 0, max: 1 };
        const allPrices = [...bidPts.map((p) => p.price), ...askPts.map((p) => p.price)];
        const fullMin = Math.min(...allPrices);
        const fullMax = Math.max(...allPrices);
        const fullSpread = fullMax - fullMin || 1;
        const mid = price ?? (fullMin + fullMax) / 2;
        const halfRange = (fullSpread * zoom) / 2;
        return { min: mid - halfRange * 1.05, max: mid + halfRange * 1.05 };
    }, [bidPts, askPts, price, zoom]);

    // 可视范围点
    const visibleBids = useMemo(
        () => bidPts.filter((p) => p.price >= priceRange.min && p.price <= priceRange.max),
        [bidPts, priceRange],
    );
    const visibleAsks = useMemo(
        () => askPts.filter((p) => p.price >= priceRange.min && p.price <= priceRange.max),
        [askPts, priceRange],
    );

    // 最大累积量
    const maxVol = useMemo(() => {
        const mb = visibleBids.length > 0 ? Math.max(...visibleBids.map((p) => p.cumVolume)) : 0;
        const ma = visibleAsks.length > 0 ? Math.max(...visibleAsks.map((p) => p.cumVolume)) : 0;
        return Math.max(mb, ma);
    }, [visibleBids, visibleAsks]);

    // 缩放控制
    const zoomIn = useCallback(() => setZoomIdx((i) => Math.max(0, i - 1)), []);
    const zoomOut = useCallback(() => setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1)), []);

    const hasData = bids.length > 0 || asks.length > 0;

    return {
        bidPts,
        askPts,
        visibleBids,
        visibleAsks,
        priceRange,
        maxVol,
        stats,
        zoom,
        zoomIdx,
        zoomIn,
        zoomOut,
        hasData,
    };
}
