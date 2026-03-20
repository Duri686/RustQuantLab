import { memo } from 'react';
import { BarChart2 } from 'lucide-react';
import type { Position } from '../../../../types/trading';

/* ============================================
   Props Interface
   ============================================ */

export interface PositionContextProps {
  /** 当前交易对的持仓 */
  position: Position | null | undefined;
  /** 交易对 symbol (如 BTC) */
  symbol: string;
}

/* ============================================
   Component
   ============================================ */

/**
 * PositionContext — 持仓上下文 Banner
 *
 * 有仓位时显示仓位摘要 + 操作提示
 * 无仓位时不渲染任何内容
 */
function PositionContext({ position, symbol: _symbol }: PositionContextProps) {
  if (!position) return null;

  const isLong = position.side === 'Long';
  const sideLabel = isLong ? '多' : '空';
  const sideClass = isLong ? 'text-success' : 'text-danger';
  // 根据 marginRatio 推断风险等级: >3 Safe, >1.5 Warning, else Danger
  const riskLabel = position.marginRatio > 3 ? 'Safe' : position.marginRatio > 1.5 ? 'Warning' : 'Danger';

  return (
    <div className="shrink-0 px-3 py-2 rounded bg-bg-surface border border-border-dark space-y-1.5">
      {/* 标题行 */}
      <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
        <span className="text-primary/70">
          <BarChart2 size={14} />
        </span>
        <span>当前持仓</span>
      </div>

      {/* 仓位摘要 */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className={`font-semibold ${sideClass}`}>
          {sideLabel}
        </span>
        <span className="text-gray-400 font-mono">
          {position.leverage}x
        </span>
        <span className={`text-[9px] px-1 py-0.5 rounded ${riskLabel === 'Safe'
          ? 'bg-success/10 text-success'
          : riskLabel === 'Warning'
            ? 'bg-warning/10 text-warning'
            : 'bg-danger/10 text-danger'
          }`}>
          {riskLabel}
        </span>
      </div>

      {/* 仓位数据 */}
      <div className="grid grid-cols-2 gap-x-3 text-[10px] font-mono">
        <div className="flex justify-between">
          <span className="text-gray-500">Size:</span>
          <span className="text-gray-300">{position.size.toFixed(4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Margin:</span>
          <span className="text-gray-300">{position.margin.toFixed(2)}</span>
        </div>
        <div className="flex justify-between col-span-2">
          <span className="text-gray-500">Entry:</span>
          <span className="text-gray-300">
            {position.entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* 操作提示 */}
      <div className="text-[9px] text-gray-500 space-y-0.5">
        <div>
          ▸ Buy/Long ={' '}
          <span className={isLong ? 'text-success' : 'text-gray-400'}>
            {isLong ? '同方向加仓' : '开反向新仓位'}
          </span>
        </div>
        <div>
          ▸ Sell/Short ={' '}
          <span className={!isLong ? 'text-danger' : 'text-gray-400'}>
            {!isLong ? '同方向加仓' : '开反向新仓位'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default memo(PositionContext);
