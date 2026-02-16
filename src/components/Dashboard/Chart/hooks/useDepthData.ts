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

function buildDepth(bids: [number, number][], asks: [number, number][], precision: number) {
    // 聚合逻辑
    const aggregate = (list: [number, number][], desc: boolean) => {
        const map = new Map<number, number>();
        for (const [p, a] of list) {
            // 向下取整到精度
            const k = Math.floor(p / precision) * precision;
            map.set(k, (map.get(k) || 0) + a);
        }
        const sortedKeys = Array.from(map.keys()).sort((a, b) => desc ? b - a : a - b);
        
        const pts: DepthPoint[] = [];
        let cum = 0;
        for (const k of sortedKeys) {
            cum += map.get(k)!;
            pts.push({ price: k, cumVolume: cum });
        }
        return pts;
    };

    const bidPts = aggregate(bids, true); // 买单价格降序
    const askPts = aggregate(asks, false); // 卖单价格升序

    return { bidPts, askPts };
}

/* ============================================
   Hook
   ============================================ */

export function useDepthData(
    bids: [number, number][],
    asks: [number, number][],
    price?: number,
    precision: number = 0.1, // 默认精度
): UseDepthDataResult {
    const [zoomIdx, setZoomIdx] = useState(DEFAULT_ZOOM);
    const zoom = ZOOM_STEPS[zoomIdx];

    // 累积深度
    const { bidPts, askPts } = useMemo(() => buildDepth(bids, asks, precision), [bids, asks, precision]);

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
