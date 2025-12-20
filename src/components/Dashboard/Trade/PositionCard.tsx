import { memo } from 'react';
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
}

const COLORS = {
  long: '#0ecb81',
  short: '#f6465d',
  warning: '#f0b90b',
} as const;

/** 风险等级颜色映射 */
const RISK_COLORS: Record<RiskLevel, string> = {
  Safe: '#0ecb81',
  Low: '#3b82f6',
  Medium: '#f0b90b',
  High: '#f97316',
  Critical: '#f6465d',
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
}: WasmPositionCardProps) {
  const isLong = position.side === 'Long';
  const isProfit = position.unrealizedPnl >= 0;

  // 🔴 直接使用 Wasm 计算的值，无本地计算
  const pnlValue = position.unrealizedPnl;
  const pnlPercent = position.pnlPercentage;
  const liquidationPrice =
    riskAssessment?.liquidationPrice ?? position.liquidationPrice;
  const marginRatio = riskAssessment?.marginRatio ?? 0;
  const riskLevel = riskAssessment?.riskLevel ?? 'Safe';
  const distanceToLiq = riskAssessment?.distanceToLiquidationPct ?? 100;

  // 风险预警：距离强平 < 10%
  const isLiqNear = distanceToLiq < 10;
  const isCritical = riskLevel === 'Critical' || riskLevel === 'High';

  const borderColor = isLong ? COLORS.long : COLORS.short;
  const pnlColor = isProfit ? COLORS.long : COLORS.short;
  const riskColor = RISK_COLORS[riskLevel];

  return (
    <div
      className={`p-2.5 rounded bg-[#161a25] border-l-2 hover:bg-[#1c2030] transition-colors ${
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
          <span className="text-[#f0b90b] font-mono tabular-nums">
            {currentPrice.toFixed(2)}
          </span>
        </div>

        {/* 🔴 P0 Feature: Liq Price from Rust */}
        <div className="flex justify-between">
          <span className="text-gray-500">Liq. Price</span>
          <span
            className="font-mono tabular-nums"
            style={{ color: isLiqNear ? COLORS.short : '#848e9c' }}
          >
            {liquidationPrice.toFixed(2)}
            {isLiqNear && <span className="ml-1">⚠</span>}
          </span>
        </div>

        {/* Margin Ratio from Rust */}
        <div className="flex justify-between">
          <span className="text-gray-500">Margin Ratio</span>
          <span className="font-mono tabular-nums" style={{ color: riskColor }}>
            {marginRatio.toFixed(2)}x
          </span>
        </div>
      </div>

      {/* Risk Warning Banner */}
      {isCritical && riskAssessment?.warningMessage && (
        <div className="mb-2 px-2 py-1 rounded bg-[#f6465d]/10 border border-[#f6465d]/30">
          <span className="text-[10px] text-[#f6465d]">
            ⚠️ {riskAssessment.warningMessage}
          </span>
        </div>
      )}

      {/* Row 4: Actions */}
      <div className="flex items-center justify-between pt-1.5 border-t border-[#252a36]">
        <span className="text-[9px] text-gray-600 font-mono">
          距强平 {distanceToLiq.toFixed(1)}%
        </span>
        <button
          onClick={() => onClose?.()}
          className="h-6 px-3 text-[10px] font-medium text-gray-400 bg-[#252a36] hover:bg-[#f6465d]/20 hover:text-[#f6465d] rounded transition-colors"
        >
          Close Position
        </button>
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
      <div className="w-12 h-12 rounded-full bg-[#1e2026] flex items-center justify-center">
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
