import { memo, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useKeyPress } from 'ahooks';

/* ============================================
   Props Interface
   ============================================ */

export interface HighLeverageConfirmProps {
  /** 当前杠杆值 */
  leverage: number;
  /** 是否显示 */
  open: boolean;
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
}

/* ============================================
   Component
   ============================================ */

/**
 * HighLeverageConfirm — 高杠杆确认弹窗
 *
 * 杠杆 > 50x 时弹出，提示风险
 * 用户可确认继续或取消
 */
function HighLeverageConfirm({
  leverage,
  open,
  onConfirm,
  onCancel,
}: HighLeverageConfirmProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // 点击 backdrop 关闭
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        onCancel();
      }
    },
    [onCancel],
  );

  // ESC 关闭
  useKeyPress('esc', () => { if (open) onCancel(); });

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-80 mx-4 rounded-lg bg-bg-surface border border-border-dark shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-danger/10 border-b border-danger/20">
          <div className="flex items-center gap-2">
            <span className="text-danger">
              <AlertTriangle size={24} />
            </span>
            <span className="text-sm font-semibold text-danger">高杠杆风险确认</span>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-3">
          <p className="text-xs text-gray-300 leading-relaxed">
            您正在使用{' '}
            <span className="text-danger font-bold font-mono">{leverage}x</span>{' '}
            杠杆，这意味着:
          </p>
          <ul className="text-[11px] text-gray-400 space-y-1.5 pl-3">
            <li className="flex items-start gap-1.5">
              <span className="text-danger mt-0.5">•</span>
              <span>价格波动 <span className="text-danger font-mono">{(100 / leverage).toFixed(2)}%</span> 即可能触发强平</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-danger mt-0.5">•</span>
              <span>爆仓价格将非常接近开仓价格</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-danger mt-0.5">•</span>
              <span>建议仅在充分理解风险的前提下使用</span>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 flex gap-2 border-t border-border-dark">
          <button
            onClick={onCancel}
            className="flex-1 h-9 rounded text-xs font-medium text-gray-400 bg-bg-dark border border-border-dark hover:text-white transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-9 rounded text-xs font-semibold text-white bg-danger hover:brightness-110 transition-all"
          >
            我已了解风险，继续
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(HighLeverageConfirm);
