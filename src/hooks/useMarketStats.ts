/**
 * @fileoverview 24h 市场统计数据 Hook
 *
 * 从 K 线历史和实时 Tick 数据中计算 24h 统计指标：
 * - 24h 涨跌幅（绝对值 + 百分比）
 * - 24h 最高价 / 最低价
 * - 24h 成交量
 * - Mark Price / Index Price（模拟环境 ≈ 当前价格）
 * - 模拟资金费率
 *
 * @module hooks/useMarketStats
 */

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useCountDown } from 'ahooks';
import type { Candle, OrderBook } from '../types/index';
import type { BinanceTicker24h, BinancePremiumIndex } from '../services/binance/types';

// ============================================================================
// 类型定义
// ============================================================================

/** 24h 市场统计数据 */
export interface MarketStats {
  /** 24h 价格变动（绝对值） */
  priceChange: number;
  /** 24h 价格变动百分比 */
  priceChangePercent: number;
  /** 24h 最高价 */
  high24h: number;
  /** 24h 最低价 */
  low24h: number;
  /** 24h 成交量 (BTC) */
  volume24h: number;
  /** 24h 成交额 (USDT) */
  turnover24h: number;
  /** Mark Price（标记价格） */
  markPrice: number;
  /** Index Price（指数价格） */
  indexPrice: number;
  /** 资金费率 */
  fundingRate: number;
  /** 下次资金费率结算倒计时 (秒) */
  fundingCountdown: number;
  /** 当前 K 线收盘倒计时 (秒)，基于选中的时间周期 */
  candleCountdown: number;
  /** Taker 买入比例 (0~1，实时) */
  takerBuyRatio: number | null;
  /** 数据来源标识：true = 来自 Binance API，false = K 线估算 */
  isRealData: boolean;
}

/** Hook 配置 */
interface UseMarketStatsOptions {
  /** K 线历史（用于计算 24h 统计） */
  candleHistory: Candle[];
  /** 最新 Tick 数据 */
  latestData: OrderBook | null;
  /** 当前价格 */
  currentPrice?: number;
  /** 当前时间周期（用于 K 线收盘倒计时） */
  timeframe?: string;
  /** Binance 24h Ticker（live 模式） */
  ticker24h?: BinanceTicker24h | null;
  /** Taker 买入比例（来自 useBinanceMarket） */
  takerBuyRatio?: number | null;
  /** 合约标记价格 / 资金费率 */
  premiumIndex?: BinancePremiumIndex | null;
}

// ============================================================================
// 常量
// ============================================================================

/** 模拟资金费率：0.01%（每 8 小时）—— 作为 premiumIndex 不可用时的回退值 */
const FALLBACK_FUNDING_RATE = 0.0001;

/** 资金费率结算周期（8 小时 = 28800 秒） */
const FUNDING_INTERVAL_SECONDS = 28800;

/** 各时间周期对应的秒数 */
const TIMEFRAME_SECONDS: Record<string, number> = {
  '1s': 1,
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1H': 3600,
  '4H': 14400,
  '1D': 86400,
};

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 计算 24h 市场统计数据
 *
 * 在模拟环境下：
 * - Mark Price = 当前中间价（bids[0] + asks[0]) / 2
 * - Index Price = 当前成交价
 * - Funding Rate = 固定模拟值 0.01%
 */
export function useMarketStats({
  candleHistory,
  latestData,
  currentPrice,
  timeframe = '1H',
  ticker24h,
  takerBuyRatio: externalTakerBuyRatio,
  premiumIndex,
}: UseMarketStatsOptions): MarketStats {
  const price = currentPrice ?? latestData?.price ?? 0;

  // 使用 ref 追踪 24h 前的价格（首根 K 线的开盘价）
  const openPrice24hRef = useRef<number>(0);

  // 初始化 24h 开盘价：取 K 线历史第一根的开盘价
  useEffect(() => {
    if (candleHistory.length > 0 && openPrice24hRef.current === 0) {
      openPrice24hRef.current = candleHistory[0].open;
    }
  }, [candleHistory]);

  // 资金费率倒计时（实时更新）
  const fundingCountdown = useMemo(() => {
    // 优先使用 premiumIndex 的真实下次结算时间
    if (premiumIndex?.nextFundingTime) {
      const remainMs = premiumIndex.nextFundingTime - Date.now();
      return Math.max(0, Math.ceil(remainMs / 1000));
    }
    // 回退：基于 8h 周期估算
    const nowSeconds = Math.floor(Date.now() / 1000);
    return FUNDING_INTERVAL_SECONDS - (nowSeconds % FUNDING_INTERVAL_SECONDS);
  }, [latestData?.timestamp, premiumIndex]); // 随 tick 更新

  // K 线收盘倒计时（基于当前时间周期，ahooks useCountDown 驱动）
  const calcNextClose = useCallback((tf: string) => {
    const intervalSec = TIMEFRAME_SECONDS[tf] ?? 3600;
    const nowSec = Math.floor(Date.now() / 1000);
    return (Math.floor(nowSec / intervalSec) + 1) * intervalSec * 1000;
  }, []);

  const [targetDate, setTargetDate] = useState(() => calcNextClose(timeframe));

  // 切换 timeframe 时重算目标时间
  useEffect(() => {
    setTargetDate(calcNextClose(timeframe));
  }, [timeframe, calcNextClose]);

  const [countdown] = useCountDown({
    targetDate,
    onEnd: () => setTargetDate(calcNextClose(timeframe)),
  });
  const candleCountdown = Math.ceil(countdown / 1000);

  return useMemo(() => {
    // 有真实 Binance 24h Ticker 数据时，优先使用
    if (ticker24h && price > 0) {
      const change = parseFloat(ticker24h.priceChange);
      const changePct = parseFloat(ticker24h.priceChangePercent);
      const high = parseFloat(ticker24h.highPrice);
      const low = parseFloat(ticker24h.lowPrice);
      const vol = parseFloat(ticker24h.volume);
      const turnover = parseFloat(ticker24h.quoteVolume);

      // 优先使用 premiumIndex 的真实 markPrice / indexPrice / fundingRate
      const realMarkPrice = premiumIndex ? parseFloat(premiumIndex.markPrice) : 0;
      const realIndexPrice = premiumIndex ? parseFloat(premiumIndex.indexPrice) : 0;
      const realFundingRate = premiumIndex ? parseFloat(premiumIndex.lastFundingRate) : 0;

      // Mark Price: 优先 premiumIndex > order book 中间价 > 当前价
      let markPrice = realMarkPrice || price;
      if (!realMarkPrice && latestData?.bids?.length && latestData?.asks?.length) {
        markPrice = (latestData.bids[0][0] + latestData.asks[0][0]) / 2;
      }

      return {
        priceChange: change,
        priceChangePercent: changePct,
        high24h: Math.max(high, price),
        low24h: Math.min(low, price),
        volume24h: vol,
        turnover24h: turnover,
        markPrice,
        indexPrice: realIndexPrice || price,
        fundingRate: realFundingRate || FALLBACK_FUNDING_RATE,
        fundingCountdown,
        candleCountdown,
        takerBuyRatio: externalTakerBuyRatio ?? null,
        isRealData: true,
      };
    }

    // 降级方案：从 K 线历史估算
    if (candleHistory.length === 0 || price === 0) {
      return {
        priceChange: 0,
        priceChangePercent: 0,
        high24h: price,
        low24h: price,
        volume24h: 0,
        turnover24h: 0,
        markPrice: price,
        indexPrice: price,
        fundingRate: premiumIndex ? parseFloat(premiumIndex.lastFundingRate) : FALLBACK_FUNDING_RATE,
        fundingCountdown,
        candleCountdown,
        takerBuyRatio: externalTakerBuyRatio ?? null,
        isRealData: false,
      };
    }

    // 从 K 线历史计算 24h 统计
    const openPrice = openPrice24hRef.current || candleHistory[0].open;
    let high = -Infinity;
    let low = Infinity;
    let totalVolume = 0;
    let totalTurnover = 0;

    for (let i = 0; i < candleHistory.length; i++) {
      const c = candleHistory[i];
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      totalVolume += c.volume;
      // 估算成交额 = volume × 平均价
      totalTurnover += c.volume * ((c.high + c.low) / 2);
    }

    // 如果当前价超出历史范围，更新
    if (price > high) high = price;
    if (price < low) low = price;

    const priceChange = price - openPrice;
    const priceChangePercent = openPrice > 0 ? (priceChange / openPrice) * 100 : 0;

    // Mark Price = order book 中间价（模拟环境）
    let markPrice = price;
    if (latestData?.bids?.length && latestData?.asks?.length) {
      markPrice = (latestData.bids[0][0] + latestData.asks[0][0]) / 2;
    }

    return {
      priceChange,
      priceChangePercent,
      high24h: high,
      low24h: low,
      volume24h: totalVolume,
      turnover24h: totalTurnover,
      markPrice,
      indexPrice: price,
      fundingRate: premiumIndex ? parseFloat(premiumIndex.lastFundingRate) : FALLBACK_FUNDING_RATE,
      fundingCountdown,
      candleCountdown,
      takerBuyRatio: externalTakerBuyRatio ?? null,
      isRealData: false,
    };
  }, [candleHistory, price, latestData, fundingCountdown, candleCountdown, ticker24h, externalTakerBuyRatio, premiumIndex]);
}
