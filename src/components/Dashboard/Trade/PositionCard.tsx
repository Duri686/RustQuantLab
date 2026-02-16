import { memo, useState, useCallback, useRef, useEffect } from 'react';
import type {
  Position,
  LiquidationResult,
  RiskLevel,
} from '../../../types/trading';
import { ConfirmDialog } from '../../common';
import { UI_TEXT } from '../../../constants/ui-glossary';
import { LiquidationProgress, MarginRatioGauge } from './components';

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
export const RISK_COLORS: Record<RiskLevel, string> = {
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
  const [_marginAmount, setMarginAmount] = useState('');

  // 平仓确认弹窗状态
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const handleCloseClick = useCallback(() => {
    setShowCloseConfirm(true);
  }, []);

  const handleCloseConfirm = useCallback(() => {
    onClose?.();
    setShowCloseConfirm(false);
  }, [onClose]);

  // 🔴 直接使用 Wasm 计算的值，无本地计算
  // Hedge Mode: 每个仓位有独立的字段，由 Rust 计算
  const pnlValue = position.unrealizedPnl;

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

  const borderColor = isLong ? 'var(--color-success)' : 'var(--color-danger)';


  // Use ref to track previous risk level for one-time vibration
  const prevRiskLevel = useRef<RiskLevel | null>(null);

  useEffect(() => {
    // 仅在从非 Critical 变为 Critical 时触发 (前端震动)
    if (
      riskLevel === 'Critical' &&
      prevRiskLevel.current !== 'Critical' &&
      prevRiskLevel.current !== null // 初次加载不震动
    ) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 200]);
      }
      // Add shake class manually if needed, or rely on key (but better to use imperative animation for events)
      const card = document.getElementById(`position-card-${position.id}`);
      if (card) {
        card.classList.add('animate-shake');
        setTimeout(() => card.classList.remove('animate-shake'), 500);
      }
    }
    prevRiskLevel.current = riskLevel;
  }, [riskLevel, position.id]);

  return (
    <div
      id={`position-card-${position.id}`}
      className={`p-2.5 rounded bg-bg-surface-elevated border-l-2 hover:opacity-90 transition-colors ${riskLevel === 'Critical' ? 'border-red-500 shadow-red-500/20 shadow-lg' : ''
        }`}
      style={{ borderLeftColor: riskLevel === 'Critical' ? undefined : borderColor }}
    >
      {/* ... Row 1 ... */}

      {/* Row 2: Badges (Removed Risk Level Badge) */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className={`px-1 py-px text-[10px] font-semibold rounded ${isLong
            ? 'bg-success/15 text-success'
            : 'bg-danger/15 text-danger'
            }`}
        >
          {isLong ? 'Long' : 'Short'}
        </span>
        <span className="text-[10px] text-gray-500 font-mono">
          {position.leverage}x
        </span>
      </div>

      {/* ... Row 3: Data Grid ... */}

      {/* Risk Visualization Section */}
      {riskAssessment && (
        <div className="mt-2 pt-2 border-t border-white/5 space-y-3">
          <LiquidationProgress
            distancePercent={distanceToLiq}
            riskLevel={riskLevel}
          />
          {/* 逐仓模式下显示保证金率 */}
          {!isCrossMode && (
            <MarginRatioGauge
              marginRatio={marginRatio}
              riskLevel={riskLevel}
            />
          )}
        </div>
      )}

      {/* Row 4: Actions (Removed distance text) */}
      <div className="flex items-center justify-end pt-2 mt-2 gap-2">
        {/* 增加保证金按钮 (仅逐仓模式) - Toggle */}
        {!isCrossMode && onAddMargin && (
          <button
            onClick={() => {
              setShowAddMargin(!showAddMargin);
              if (showAddMargin) setMarginAmount('');
            }}
            className={`h-6 px-2 text-[10px] font-medium rounded transition-colors ${showAddMargin
              ? 'text-success bg-success/20 border border-success/50'
              : 'text-success bg-success/10 hover:bg-success/20 border border-transparent'
              }`}
          >
            {UI_TEXT.actions.addMargin}
          </button>
        )}
        <button
          onClick={handleCloseClick}
          className="h-6 px-3 text-[10px] font-medium text-gray-400 bg-border-medium hover:bg-danger/20 hover:text-danger rounded transition-colors"
        >
          {UI_TEXT.actions.close}
        </button>
      </div>
      {/* 平仓确认弹窗 */}
      <ConfirmDialog
        isOpen={showCloseConfirm}
        title="确认平仓"
        message={`即将以市价平仓 ${isLong ? 'Long' : 'Short'} ${position.size.toFixed(4)} ${symbol}，预计${isProfit ? '盈利' : '亏损'} ${Math.abs(pnlValue).toFixed(2)} USDT`}
        confirmText="确认平仓"
        cancelText="取消"
        variant={isProfit ? 'normal' : 'warning'}
        onConfirm={handleCloseConfirm}
        onCancel={() => setShowCloseConfirm(false)}
      />
    </div>
  );
}

/* ============================================
   Empty State Component
   ============================================ */

export function EmptyPositionState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8">
      <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center">
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
      <span className="text-xs text-gray-600">{UI_TEXT.position.noPosition}</span>
      <span className="text-[10px] text-gray-700">
        {UI_TEXT.position.openTip}
      </span>
    </div>
  );
}

export default memo(WasmPositionCard);
