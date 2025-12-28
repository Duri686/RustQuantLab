import { memo, useState } from 'react';
import type {
  Position,
  LiquidationResult,
  RiskLevel,
} from '../../../types/trading';

/* ============================================
   Types & Constants
   ============================================ */

/**
 * WasmPositionCard Props
 *
 * 使用 Wasm 引擎计算的 Position 和 LiquidationResult
 * 🔴 所有盈亏、强平价均由 Rust 计算，前端仅展示
 */
export interface WasmPositionCardProps {
  /** Wasm Position 对象 */
  position: Position;
  /** Wasm 风险评估结果 */
  riskAssessment: LiquidationResult | null;
  /** 交易对符号 */
  symbol?: string;
  /** 当前市场价格 */
  currentPrice: number;
  /** 平仓回调 */
  onClose?: () => void;
  /** 增加保证金回调 (逐仓模式) */
  onAddMargin?: (positionId: string, amount: number) => void;
}

// 使用 CSS 变量，移除硬编码颜色常量
/** 风险等级颜色映射 */
const RISK_COLORS: Record<RiskLevel, string> = {
  Safe: 'var(--color-success)',
  Low: 'var(--color-info)',
  Medium: 'var(--color-warning-alt)',
  High: '#f97316', // 橙色，暂时保留，后续可添加到 CSS 变量
  Critical: 'var(--color-danger)',
};

/* ============================================
   Main Component - Wasm-Powered Position Card
   ============================================ */

/**
 * WasmPositionCard
 *
 * 🧠 Brain Transplant: 所有计算逻辑已迁移至 Rust Wasm
 * - PnL: position.unrealizedPnl (Rust 计算)
 * - Liq Price: riskAssessment.liquidationPrice (Rust 计算)
 * - Margin Ratio: riskAssessment.marginRatio (Rust 计算)
 */
function WasmPositionCard({
  position,
  riskAssessment,
  symbol = 'BTC',
  currentPrice,
  onClose,
  onAddMargin,
}: WasmPositionCardProps) {
  const isLong = position.side === 'Long';
  const isProfit = position.unrealizedPnl >= 0;

  // 增加保证金弹窗状态
  const [showAddMargin, setShowAddMargin] = useState(false);
  const [marginAmount, setMarginAmount] = useState('');

  // 🔴 直接使用 Wasm 计算的值，无本地计算
  // Hedge Mode: 每个仓位有独立的字段，由 Rust 计算
  const pnlValue = position.unrealizedPnl;
  const pnlPercent = position.pnlPercentage;

  // 区分全仓/逐仓模式的数据来源
  // 注意：Rust serde 序列化为小写 "cross"/"isolated"
  const isCrossMode = position.marginMode?.toLowerCase() === 'cross';
  // 全仓模式：使用账户级别的强平价和保证金率
  // 逐仓模式：使用单仓位数据
  const liquidationPrice = isCrossMode
    ? riskAssessment?.liquidationPrice ?? position.liquidationPrice
    : position.liquidationPrice;
  const marginRatio = isCrossMode
    ? riskAssessment?.marginRatio ?? position.marginRatio
    : position.marginRatio;
  const riskLevel = isCrossMode
    ? riskAssessment?.riskLevel ?? 'Safe'
    : position.marginRatio < 1.5
    ? 'Critical'
    : position.marginRatio < 3
    ? 'High'
    : 'Safe';
  // 计算该仓位距离强平的距离
  const distanceToLiq =
    liquidationPrice > 0
      ? Math.abs(((currentPrice - liquidationPrice) / currentPrice) * 100)
      : 100;

  // 风险预警：距离强平 < 10%
  const isLiqNear = distanceToLiq < 10;
  const isCritical = riskLevel === 'Critical' || riskLevel === 'High';

  const borderColor = isLong ? 'var(--color-success)' : 'var(--color-danger)';
  const pnlColor = isProfit ? 'var(--color-success)' : 'var(--color-danger)';
  const riskColor = RISK_COLORS[riskLevel];

  return (
    <div
      className={`p-2.5 rounded bg-[var(--color-bg-surface-elevated)] border-l-2 hover:opacity-90 transition-colors ${
        isCritical ? 'animate-pulse' : ''
      }`}
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
          className={`px-1 py-px text-[10px] font-semibold rounded ${
            isLong
              ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
              : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'
          }`}
        >
          {isLong ? 'Long' : 'Short'}
        </span>
        <span className="text-[10px] text-gray-500 font-mono">
          {position.leverage}x
        </span>
        {/* 风险等级 Badge */}
        <span
          className="text-[10px] px-1 py-px rounded font-medium"
          style={{
            backgroundColor: `${riskColor}20`,
            color: riskColor,
          }}
        >
          {riskLevel}
        </span>
      </div>

      {/* Row 3: Data Grid - All values from Wasm */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] mb-2">
        <div className="flex justify-between">
          <span className="text-gray-500">Size</span>
          <span className="text-gray-300 font-mono tabular-nums">
            {position.size.toFixed(4)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Margin</span>
          <span className="text-gray-300 font-mono tabular-nums">
            {position.margin.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Entry</span>
          <span className="text-gray-300 font-mono tabular-nums">
            {position.entryPrice.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Mark</span>
          <span className="text-[var(--color-warning-alt)] font-mono tabular-nums">
            {currentPrice.toFixed(2)}
          </span>
        </div>

        {/* 🔴 P0 Feature: Liq Price from Rust */}
        <div className="flex justify-between">
          <span className="text-gray-500">Liq. Price</span>
          <span
            className={`font-mono tabular-nums ${
              isLiqNear ? 'text-[var(--color-danger)]' : 'text-gray-500'
            }`}
          >
            {liquidationPrice.toFixed(2)}
            {isLiqNear && <span className="ml-1">⚠</span>}
          </span>
        </div>

        {/* Margin Ratio */}
        <div className="flex justify-between">
          <span className="text-gray-500">Margin Ratio</span>
          <span className="font-mono tabular-nums" style={{ color: riskColor }}>
            {Number.isFinite(marginRatio) && marginRatio < 10000
              ? marginRatio.toFixed(2)
              : marginRatio > 10000
              ? '>9999'
              : '0.00'}
            x
          </span>
        </div>
      </div>

      {/* Risk Warning Banner */}
      {isCritical && riskAssessment?.warningMessage && (
        <div className="mb-2 px-2 py-1.5 rounded bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 flex items-center justify-center">
          <span className="text-[10px] text-[var(--color-danger)] leading-none">
            ⚠️ {riskAssessment.warningMessage}
          </span>
        </div>
      )}

      {/* 增加保证金输入 (仅逐仓模式) - 融合设计 */}
      {showAddMargin && !isCrossMode && (
        <div className="mb-2 flex items-center h-6 rounded overflow-hidden border border-[var(--color-success)]/50">
          <input
            type="number"
            value={marginAmount}
            onChange={(e) => setMarginAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const amount = parseFloat(marginAmount);
                if (amount > 0) {
                  onAddMargin?.(position.id, amount);
                  setMarginAmount('');
                  setShowAddMargin(false);
                }
              } else if (e.key === 'Escape') {
                setMarginAmount('');
                setShowAddMargin(false);
              }
            }}
            placeholder="0.00"
            className="flex-1 h-full px-2 text-[10px] bg-[var(--color-bg-surface-elevated)] text-white placeholder-gray-500 focus:outline-none font-mono tabular-nums border-none"
            autoFocus
          />
          <span className="px-1.5 text-[9px] text-gray-500 bg-[var(--color-bg-surface-elevated)]">
            USDT
          </span>
          <button
            onClick={() => {
              const amount = parseFloat(marginAmount);
              if (amount > 0) {
                onAddMargin?.(position.id, amount);
                setMarginAmount('');
                setShowAddMargin(false);
              }
            }}
            className="h-full px-3 text-[9px] font-semibold text-white bg-[var(--color-success)] hover:bg-[var(--color-success)]/80 transition-colors"
          >
            OK
          </button>
        </div>
      )}

      {/* Row 4: Actions */}
      <div className="flex items-center justify-between pt-1.5 border-t border-[var(--color-border-medium)]">
        <span className="text-[9px] text-gray-600 font-mono">
          距强平 {distanceToLiq.toFixed(1)}%
        </span>
        <div className="flex items-center gap-1.5">
          {/* 增加保证金按钮 (仅逐仓模式) - Toggle */}
          {!isCrossMode && onAddMargin && (
            <button
              onClick={() => {
                setShowAddMargin(!showAddMargin);
                if (showAddMargin) setMarginAmount('');
              }}
              className={`h-6 px-2 text-[10px] font-medium rounded transition-colors ${
                showAddMargin
                  ? 'text-[var(--color-success)] bg-[var(--color-success)]/20 border border-[var(--color-success)]/50'
                  : 'text-[var(--color-success)] bg-[var(--color-success)]/10 hover:bg-[var(--color-success)]/20 border border-transparent'
              }`}
            >
              Add Margin
            </button>
          )}
          <button
            onClick={() => onClose?.()}
            className="h-6 px-3 text-[10px] font-medium text-gray-400 bg-[var(--color-border-medium)] hover:bg-[var(--color-danger)]/20 hover:text-[var(--color-danger)] rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================
   Empty State Component
   ============================================ */

export function EmptyPositionState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8">
      <div className="w-12 h-12 rounded-full bg-[var(--color-bg-surface)] flex items-center justify-center">
        <svg
          className="w-6 h-6 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>
      </div>
      <span className="text-xs text-gray-600">No active position</span>
      <span className="text-[10px] text-gray-700">
        Open a Long or Short to start trading
      </span>
    </div>
  );
}

export default memo(WasmPositionCard);
