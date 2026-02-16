/**
 * RecentTrades (TradeAnalysis) - 实时成交分析
 *
 * 显示最近 50 笔成交记录，并提供买卖盘分析（针对特定 Symbol）：
 * - 买卖量对比 (Taker Buy/Sell Volume)
 * - 大单监控 (Whale Alerts)
 * - 净流入计算
 */

import { memo, useMemo } from 'react';
import type { TradeRecord } from '../../hooks/useBinanceMarket';
import { ArrowDown, ArrowUp } from 'lucide-react';

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
  if (qty >= 10) return qty.toFixed(2);
  if (qty >= 1) return qty.toFixed(3);
  return qty.toFixed(4);
}

/* ============================================
   组件
   ============================================ */

interface RecentTradesProps {
  trades: TradeRecord[];
  symbol?: string;
}

function RecentTrades({ trades, symbol = 'BTC' }: RecentTradesProps) {
  // 统计分析
  const stats = useMemo(() => {
    let buyVol = 0;
    let sellVol = 0;
    let buyCount = 0;
    let sellCount = 0;
    let maxQty = 0;

    trades.forEach((t) => {
      // isBuyerMaker = false -> 主动买入 (Up)
      // isBuyerMaker = true -> 主动卖出 (Down)
      if (!t.isBuyerMaker) {
        buyVol += t.qty;
        buyCount++;
      } else {
        sellVol += t.qty;
        sellCount++;
      }
      if (t.qty > maxQty) maxQty = t.qty;
    });

    return {
      buyVol,
      sellVol,
      buyCount,
      sellCount,
      netVol: buyVol - sellVol,
      maxQty: Math.max(maxQty, 0.0001), // 避免除以0
      isBuyDominant: buyVol > sellVol,
    };
  }, [trades]);

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 text-[10px] font-mono gap-2">
        <span className="w-4 h-4 rounded-full border-2 border-border-dark border-t-accent animate-spin" />
        <span>Waiting for trades...</span>
      </div>
    );
  }

  // 大单阈值：最大成交量的 30% 或者 绝对值（BTC > 0.1, ETH > 2)
  // 这里简化为相对阈值，因为 symbol 不确定
  const largeOrderThreshold = stats.maxQty * 0.3;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-bg-surface text-[10px] font-mono select-none">
      {/* ========== 统计面板 ========== */}
      <div className="px-2 py-1.5 border-b border-border-dark bg-bg-surface-alt">
        {/* 标题行 */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-bold text-gray-300">{symbol} Analysis</span>
          <span className={stats.netVol > 0 ? 'text-success' : 'text-danger'}>
            Net: {stats.netVol > 0 ? '+' : ''}{formatQty(stats.netVol)}
          </span>
        </div>

        {/* 买卖量条 */}
        <div className="flex items-center justify-between mb-1 text-[9px] text-gray-400">
          <span className="text-success flex items-center gap-1">
            <ArrowUp className="w-2.5 h-2.5" /> Buy {formatQty(stats.buyVol)}
          </span>
          <span className="text-danger flex items-center gap-1">
            Sell {formatQty(stats.sellVol)} <ArrowDown className="w-2.5 h-2.5" />
          </span>
        </div>
        
        {/* 比例条 */}
        <div className="h-1.5 w-full bg-border-dark rounded-full overflow-hidden flex">
          <div 
            className="h-full bg-success transition-all duration-300"
            style={{ width: `${(stats.buyVol / (stats.buyVol + stats.sellVol || 1)) * 100}%` }}
          />
          <div 
            className="h-full bg-danger transition-all duration-300"
            style={{ width: `${(stats.sellVol / (stats.buyVol + stats.sellVol || 1)) * 100}%` }}
          />
        </div>

        {/* 净流量 */}
        <div className="flex justify-between mt-1 text-[9px]">
          <span className="text-gray-500">Vol Ratio</span>
          <span className={stats.netVol > 0 ? 'text-success' : 'text-danger'}>
            Net: {stats.netVol > 0 ? '+' : ''}{formatQty(stats.netVol)}
          </span>
        </div>
      </div>

      {/* ========== 表头 ========== */}
      <div className="flex items-center px-2 py-1 text-[9px] text-gray-500 border-b border-border-dark shrink-0 bg-bg-surface">
        <span className="w-[30%]">Price</span>
        <span className="w-[30%] text-right">Qty</span>
        <span className="w-[40%] text-right">Time</span>
      </div>

      {/* ========== 成交列表 ========== */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {trades.map((trade) => {
          const isBuy = !trade.isBuyerMaker;
          const isLarge = trade.qty >= largeOrderThreshold;
          
          // 数量条长度 (相对于最大单)
          const barWidth = Math.min((trade.qty / stats.maxQty) * 100, 100);

          return (
            <div
              key={trade.id}
              className={`relative flex items-center px-2 py-[2px] transition-colors hover:bg-white/5 ${
                isLarge ? 'bg-white/5' : ''
              }`}
            >
              {/* 背景数量条 */}
              <div 
                className={`absolute left-0 top-0 bottom-0 opacity-10 ${isBuy ? 'bg-success' : 'bg-danger'}`}
                style={{ width: `${barWidth}%` }}
              />

              <span className={`w-[30%] relative z-10 ${isBuy ? 'text-success' : 'text-danger'} ${isLarge ? 'font-bold' : ''}`}>
                {trade.price.toLocaleString(undefined, {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1, // 减少小数位，节省空间
                })}
              </span>
              <span className={`w-[30%] text-right relative z-10 ${isLarge ? 'text-gray-100 font-bold' : 'text-gray-400'}`}>
                {formatQty(trade.qty)}
              </span>
              <span className="w-[40%] text-right text-gray-500 relative z-10 opacity-70">
                {formatTime(trade.time)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(RecentTrades);
