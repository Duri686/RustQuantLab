import { memo, useMemo } from 'react';
import type { OrderRecord } from '../../../types';

/* ============================================
   Types & Constants
   ============================================ */

interface PositionCardProps {
  order: OrderRecord;
  symbol: string;
  currentPrice: number;
  availableBalance: number;
  onClose?: () => void;
  onAddMargin?: (amount: number) => void;
}

const COLORS = {
  long: '#0ecb81',
  short: '#f6465d',
  warning: '#f0b90b',
} as const;

/* ============================================
   Main Component - Micro-Compact Design
   ============================================ */

function PositionCard({
  order,
  symbol,
  currentPrice,
  availableBalance,
  onClose,
  onAddMargin,
}: PositionCardProps) {
  const isClosed = order.closed;
  const isLong = order.side === 'buy';

  // 计算盈亏
  const { pnlValue, pnlPercent, isProfit } = useMemo(() => {
    if (isClosed) {
      const realizedPnl = order.realizedPnl ?? 0;
      const pct = (realizedPnl / order.margin) * 100;
      return {
        pnlValue: realizedPnl,
        pnlPercent: pct,
        isProfit: realizedPnl >= 0,
      };
    }
    const pct = isLong
      ? ((currentPrice - order.executedPrice) / order.executedPrice) *
        100 *
        order.leverage
      : ((order.executedPrice - currentPrice) / order.executedPrice) *
        100 *
        order.leverage;
    const value = (order.margin * pct) / 100;
    return { pnlValue: value, pnlPercent: pct, isProfit: value >= 0 };
  }, [isClosed, isLong, currentPrice, order]);

  // 爆仓价预警
  const isLiqNear = useMemo(() => {
    if (isClosed) return false;
    return (
      Math.abs((currentPrice - order.liquidationPrice) / currentPrice) < 0.05
    );
  }, [isClosed, currentPrice, order.liquidationPrice]);

  const borderColor = order.liquidated
    ? COLORS.short
    : isLong
    ? COLORS.long
    : COLORS.short;
  const pnlColor = isProfit ? COLORS.long : COLORS.short;

  // ==================== 爆仓卡片 ====================
  if (order.liquidated) {
    return (
      <div
        className="p-2 rounded bg-[#161a25] border-l-2 opacity-70"
        style={{ borderLeftColor: COLORS.short }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-400">
              {symbol}USDT
            </span>
            <span className="px-1 py-px text-[9px] font-medium rounded bg-[#f6465d]/20 text-[#f6465d]">
              LIQUIDATED
            </span>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#f6465d]">
            {pnlValue.toFixed(2)}
          </span>
        </div>
      </div>
    );
  }

  // ==================== 已平仓卡片 ====================
  if (isClosed) {
    return (
      <div
        className="p-2 rounded bg-[#161a25] border-l-2 opacity-50"
        style={{ borderLeftColor: '#3b3f46' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-500">
              {symbol}USDT
            </span>
            <span className="text-[10px] text-gray-600">{order.leverage}x</span>
          </div>
          <span
            className="text-xs font-medium font-mono tabular-nums"
            style={{ color: pnlColor, opacity: 0.7 }}
          >
            {isProfit ? '+' : ''}
            {pnlValue.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1 text-[10px] text-gray-600 font-mono tabular-nums">
          <span>Entry {order.executedPrice.toFixed(2)}</span>
          <span>Close {order.closePrice?.toFixed(2)}</span>
        </div>
      </div>
    );
  }

  // ==================== 持仓中卡片 (Micro-Compact) ====================
  return (
    <div
      className="p-2.5 rounded bg-[#161a25] border-l-2 hover:bg-[#1c2030] transition-colors"
      style={{ borderLeftColor: borderColor }}
    >
      {/* Row 1: Symbol & PNL */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-bold text-white">{symbol}USDT</span>
        <span
          className="text-sm font-semibold font-mono tabular-nums"
          style={{ color: pnlColor }}
        >
          {isProfit ? '+' : ''}
          {pnlValue.toFixed(2)}
          <span className="text-[10px] ml-1 opacity-80">
            ({isProfit ? '+' : ''}
            {pnlPercent.toFixed(2)}%)
          </span>
        </span>
      </div>

      {/* Row 2: Badges */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="px-1 py-px text-[10px] font-semibold rounded"
          style={{
            backgroundColor: isLong
              ? 'rgba(14,203,129,0.15)'
              : 'rgba(246,70,93,0.15)',
            color: isLong ? COLORS.long : COLORS.short,
          }}
        >
          {isLong ? 'Long' : 'Short'}
        </span>
        <span className="text-[10px] text-gray-500 font-mono">
          {order.leverage}x
        </span>
        <span
          className="text-[10px] px-1 py-px rounded"
          style={{
            backgroundColor:
              order.marginMode === 'cross'
                ? 'rgba(59,130,246,0.1)'
                : 'rgba(240,185,11,0.1)',
            color: order.marginMode === 'cross' ? '#3b82f6' : '#f0b90b',
          }}
        >
          {order.marginMode === 'cross' ? 'Cross' : 'Isolated'}
        </span>
      </div>

      {/* Row 3: Data Grid */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] mb-2">
        <div className="flex justify-between">
          <span className="text-gray-500">Size</span>
          <span className="text-gray-300 font-mono tabular-nums">
            {order.size.toFixed(4)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Margin</span>
          <div className="flex items-center gap-1">
            <span className="text-gray-300 font-mono tabular-nums">
              {order.margin.toFixed(2)}
            </span>
            {/* +Margin: 仅 Isolated 模式显示 */}
            {order.marginMode === 'isolated' && onAddMargin && (
              <button
                onClick={() => {
                  const amt = order.margin * 0.1;
                  if (amt <= availableBalance) onAddMargin(amt);
                }}
                disabled={order.margin * 0.1 > availableBalance}
                title="追加 10% 保证金"
                className="w-4 h-4 flex items-center justify-center bg-blue-500/30 hover:bg-blue-500/50 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-2.5 h-2.5"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 2v8M2 6h8" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Entry</span>
          <span className="text-gray-300 font-mono tabular-nums">
            {order.executedPrice.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Mark</span>
          <span className="text-[#f0b90b] font-mono tabular-nums">
            {currentPrice.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between col-span-2">
          <span className="text-gray-500">Liq. Price</span>
          <span
            className="font-mono tabular-nums"
            style={{ color: isLiqNear ? '#f6465d' : '#848e9c' }}
          >
            {order.liquidationPrice.toFixed(2)}
            {isLiqNear && <span className="ml-1 text-[#f6465d]">⚠</span>}
          </span>
        </div>
      </div>

      {/* Row 4: Actions (TP/SL + Close only) */}
      <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-[#252a36]">
        <button className="h-6 px-2 text-[10px] text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
          TP/SL
        </button>
        <button
          onClick={() => onClose?.()}
          className="h-6 px-2 text-[10px] text-gray-400 bg-[#252a36] hover:bg-[#f6465d]/20 hover:text-[#f6465d] rounded transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default memo(PositionCard);
