/**
 * RecentTrades - 实时成交列表
 *
 * 显示最近 50 笔成交记录，数据来自 Binance WebSocket trade stream
 */

import { memo } from 'react';
import type { TradeRecord } from '../../hooks/useBinanceMarket';

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
  if (qty >= 1) return qty.toFixed(4);
  if (qty >= 0.01) return qty.toFixed(5);
  return qty.toFixed(6);
}

/* ============================================
   组件
   ============================================ */

interface RecentTradesProps {
  trades: TradeRecord[];
}

function RecentTrades({ trades }: RecentTradesProps) {
  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-[10px] font-mono">
        等待成交数据...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 表头 */}
      <div className="flex items-center px-2 py-1 text-[9px] font-mono text-gray-500 border-b border-border-dark shrink-0">
        <span className="w-[32%]">Price (USDT)</span>
        <span className="w-[32%] text-right">Amount (BTC)</span>
        <span className="w-[36%] text-right">Time</span>
      </div>

      {/* 成交列表 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {trades.map((trade) => {
          // isBuyerMaker = true → 卖方主动（价格下跌方向）
          // isBuyerMaker = false → 买方主动（价格上涨方向）
          const colorClass = trade.isBuyerMaker ? 'text-danger' : 'text-success';

          return (
            <div
              key={trade.id}
              className="flex items-center px-2 py-px text-[10px] font-mono tabular-nums hover:bg-bg-surface/50 transition-colors"
            >
              <span className={`w-[32%] ${colorClass}`}>
                {trade.price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="w-[32%] text-right text-gray-300">
                {formatQty(trade.qty)}
              </span>
              <span className="w-[36%] text-right text-gray-500">
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
