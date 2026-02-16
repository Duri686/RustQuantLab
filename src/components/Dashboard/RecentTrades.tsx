/**
 * RecentTrades (TradeAnalysis) - 实时成交分析
 *
 * 显示最近成交记录，支持：
 * - 大单过滤：可调节阈值滑块过滤小于阈值的噪音交易
 * - 买卖量对比 (Taker Buy/Sell Volume)
 * - 大单高亮
 * - 净流入计算
 */

import { memo, useMemo, useState, useCallback } from 'react';
import type { TradeRecord } from '../../hooks/useBinanceMarket';
import { ArrowDown, ArrowUp, Filter } from 'lucide-react';

/* ============================================
   常量
   ============================================ */

/** 阈值滑块预设档位 (单位: 基础资产数量) */
const THRESHOLD_STEPS = [0, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10] as const;

/* ============================================
   格式化工具
   ============================================ */

function formatTime(ms: number): string {
  const d = new Date(ms);
  const HH = String(d.getHours()).padStart(2, '0');
  const MM = String(d.getMinutes()).padStart(2, '0');
  const SS = String(d.getSeconds()).padStart(2, '0');
  return `${HH}:${MM}:${SS}`;
}

function formatQty(qty: number): string {
  if (qty >= 100) return qty.toFixed(1);
  if (qty >= 10) return qty.toFixed(2);
  if (qty >= 1) return qty.toFixed(3);
  return qty.toFixed(4);
}

function formatUSD(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/* ============================================
   组件
   ============================================ */

interface RecentTradesProps {
  trades: TradeRecord[];
  symbol?: string;
}

function RecentTrades({ trades, symbol = 'BTC' }: RecentTradesProps) {
  // 阈值过滤：滑块 index -> 实际阈值
  const [thresholdIdx, setThresholdIdx] = useState(0);
  const threshold = THRESHOLD_STEPS[thresholdIdx];

  // 展开/收起过滤器
  const [showFilter, setShowFilter] = useState(false);

  // 过滤后的成交列表
  const filteredTrades = useMemo(
    () => (threshold > 0 ? trades.filter((t) => t.qty >= threshold) : trades),
    [trades, threshold],
  );

  // 统计分析 (基于过滤后数据)
  const stats = useMemo(() => {
    let buyVol = 0;
    let sellVol = 0;
    let buyCount = 0;
    let sellCount = 0;
    let maxQty = 0;
    let buyUSD = 0;
    let sellUSD = 0;

    filteredTrades.forEach((t) => {
      const usd = t.qty * t.price;
      if (!t.isBuyerMaker) {
        buyVol += t.qty;
        buyUSD += usd;
        buyCount++;
      } else {
        sellVol += t.qty;
        sellUSD += usd;
        sellCount++;
      }
      if (t.qty > maxQty) maxQty = t.qty;
    });

    return {
      buyVol,
      sellVol,
      buyCount,
      sellCount,
      buyUSD,
      sellUSD,
      netVol: buyVol - sellVol,
      netUSD: buyUSD - sellUSD,
      maxQty: Math.max(maxQty, 0.0001),
    };
  }, [filteredTrades]);

  // 大单阈值：最大成交量的 30%
  const largeOrderThreshold = stats.maxQty * 0.3;

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setThresholdIdx(Number(e.target.value));
    },
    [],
  );

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 text-[10px] font-mono gap-2">
        <span className="w-4 h-4 rounded-full border-2 border-border-dark border-t-accent animate-spin" />
        <span>Waiting for trades...</span>
      </div>
    );
  }

  const buyRatio = stats.buyVol / (stats.buyVol + stats.sellVol || 1);
  const isNetPositive = stats.netVol > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-surface text-[10px] font-mono select-none">
      {/* ========== 统计面板 ========== */}
      <div className="px-2 py-1.5 border-b border-border-dark bg-bg-surface-alt">
        {/* 标题行 */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-bold text-gray-300">{symbol} Analysis</span>
          {/* 净流入 (USD 金额) */}
          <span className={isNetPositive ? 'text-success' : 'text-danger'}>
            Net: {isNetPositive ? '+' : ''}
            {formatUSD(stats.netUSD)}
          </span>
        </div>

        {/* 买卖量条 */}
        <div className="flex items-center justify-between mb-1 text-[9px] text-gray-400">
          <span className="text-success flex items-center gap-1">
            <ArrowUp className="w-2.5 h-2.5" /> Buy {formatQty(stats.buyVol)}{' '}
            <span className="text-gray-600">({stats.buyCount})</span>
          </span>
          <span className="text-danger flex items-center gap-1">
            <span className="text-gray-600">({stats.sellCount})</span>{' '}
            Sell {formatQty(stats.sellVol)} <ArrowDown className="w-2.5 h-2.5" />
          </span>
        </div>

        {/* 比例条 */}
        <div className="h-1.5 w-full bg-border-dark rounded-full overflow-hidden flex">
          <div
            className="h-full bg-success transition-all duration-300"
            style={{ width: `${buyRatio * 100}%` }}
          />
          <div
            className="h-full bg-danger transition-all duration-300"
            style={{ width: `${(1 - buyRatio) * 100}%` }}
          />
        </div>

        {/* 买卖 USD 对比 */}
        <div className="flex justify-between mt-1 text-[9px]">
          <span className="text-success/80">{formatUSD(stats.buyUSD)}</span>
          <span className="text-gray-600">
            {(buyRatio * 100).toFixed(1)}% / {((1 - buyRatio) * 100).toFixed(1)}%
          </span>
          <span className="text-danger/80">{formatUSD(stats.sellUSD)}</span>
        </div>
      </div>

      {/* ========== 过滤器 ========== */}
      <div className="px-2 py-1 border-b border-border-dark bg-bg-surface shrink-0">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilter((v) => !v)}
            className="flex items-center gap-1 text-[9px] text-gray-500 hover:text-gray-300 transition-colors"
            type="button"
          >
            <Filter className="w-3 h-3" />
            <span>
              Min: {threshold > 0 ? formatQty(threshold) : 'OFF'}
            </span>
          </button>
          <span className="text-[9px] text-gray-600">
            {filteredTrades.length}/{trades.length} trades
          </span>
        </div>

        {showFilter && (
          <div className="mt-1.5 pb-0.5">
            <input
              type="range"
              min={0}
              max={THRESHOLD_STEPS.length - 1}
              step={1}
              value={thresholdIdx}
              onChange={handleSliderChange}
              className="w-full h-1 appearance-none bg-border-dark rounded-full cursor-pointer accent-accent"
              title={`阈值: ${threshold}`}
            />
            <div className="flex justify-between text-[8px] text-gray-600 mt-0.5 px-0.5">
              <span>OFF</span>
              <span>0.01</span>
              <span>0.1</span>
              <span>1</span>
              <span>10</span>
            </div>
          </div>
        )}
      </div>

      {/* ========== 表头 ========== */}
      <div className="flex items-center px-2 py-1 text-[9px] text-gray-500 border-b border-border-dark shrink-0 bg-bg-surface">
        <span className="w-[28%]">Price</span>
        <span className="w-[22%] text-right">Qty</span>
        <span className="w-[25%] text-right">Value</span>
        <span className="w-[25%] text-right">Time</span>
      </div>

      {/* ========== 成交列表 ========== */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredTrades.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-gray-600 text-[10px]">
            All trades below threshold ({formatQty(threshold)})
          </div>
        ) : (
          filteredTrades.map((trade) => {
            const isBuy = !trade.isBuyerMaker;
            const isLarge = trade.qty >= largeOrderThreshold;
            const usdValue = trade.qty * trade.price;
            const barWidth = Math.min((trade.qty / stats.maxQty) * 100, 100);

            return (
              <div
                key={trade.id}
                className={`relative flex items-center px-2 py-[2px] transition-colors hover:bg-white/5 ${
                  isLarge ? 'bg-white/[0.04]' : ''
                }`}
              >
                {/* 背景数量条 */}
                <div
                  className={`absolute left-0 top-0 bottom-0 opacity-10 ${isBuy ? 'bg-success' : 'bg-danger'}`}
                  style={{ width: `${barWidth}%` }}
                />

                <span
                  className={`w-[28%] relative z-10 ${isBuy ? 'text-success' : 'text-danger'} ${isLarge ? 'font-bold' : ''}`}
                >
                  {trade.price.toLocaleString(undefined, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </span>
                <span
                  className={`w-[22%] text-right relative z-10 ${isLarge ? 'text-gray-100 font-bold' : 'text-gray-400'}`}
                >
                  {formatQty(trade.qty)}
                </span>
                <span
                  className={`w-[25%] text-right relative z-10 text-[9px] ${
                    usdValue >= 10000 ? 'text-warning font-semibold' : 'text-gray-500'
                  }`}
                >
                  {formatUSD(usdValue)}
                </span>
                <span className="w-[25%] text-right text-gray-500 relative z-10 opacity-70">
                  {formatTime(trade.time)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default memo(RecentTrades);
