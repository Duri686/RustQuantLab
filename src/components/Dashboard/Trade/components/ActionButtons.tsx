import { memo, useState, useCallback, useRef, useEffect } from 'react';
import type { Position } from '../../../../types/trading';

/* ============================================
   Types
   ============================================ */

type ButtonFeedback = 'idle' | 'loading' | 'success' | 'error';

export interface ActionButtonsProps {
  /** 是否禁用 (size=0 或余额不足) */
  disabled: boolean;
  /** 当前持仓 (用于按钮文案动态化) */
  currentPosition?: Position | null;
  /** 点击回调 */
  onSubmit: (side: 'LONG' | 'SHORT') => boolean | null | undefined;
}

/* ============================================
   Component
   ============================================ */

/**
 * ActionButtons — Buy/Sell 按钮
 *
 * 增强反馈: Loading spinner → Success ✓ / Error shake
 * 按钮文案: 有仓位时显示加仓箭头
 */
function ActionButtons({ disabled, currentPosition, onSubmit }: ActionButtonsProps) {
  const [buyFeedback, setBuyFeedback] = useState<ButtonFeedback>('idle');
  const [sellFeedback, setSellFeedback] = useState<ButtonFeedback>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Bug #4 fix: 组件卸载时清理定时器
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const handleClick = useCallback(
    (side: 'LONG' | 'SHORT') => {
      const setFeedback = side === 'LONG' ? setBuyFeedback : setSellFeedback;

      // 防重复点击
      if (buyFeedback === 'loading' || sellFeedback === 'loading') return;

      setFeedback('loading');

      // 使用 setTimeout 模拟异步，确保 UI 更新
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const result = onSubmit(side);

        if (result === true || result === undefined) {
          // 成功
          setFeedback('success');
          setTimeout(() => setFeedback('idle'), 600);
        } else if (result === false) {
          // 失败 (验证未通过但无错误)
          setFeedback('idle');
        } else {
          // null = 错误
          setFeedback('error');
          setTimeout(() => setFeedback('idle'), 600);
        }
      }, 50);
    },
    [onSubmit, buyFeedback, sellFeedback],
  );

  // 按钮文案动态化
  const positionSide = currentPosition?.side;
  const buyLabel = positionSide === 'Long' ? 'Buy / Long ↑' : 'Buy / Long';
  const sellLabel = positionSide === 'Short' ? 'Sell / Short ↓' : 'Sell / Short';

  return (
    <div className="grid grid-cols-2 gap-2 shrink-0">
      <ActionButton
        side="LONG"
        label={buyLabel}
        feedback={buyFeedback}
        disabled={disabled}
        onClick={() => handleClick('LONG')}
      />
      <ActionButton
        side="SHORT"
        label={sellLabel}
        feedback={sellFeedback}
        disabled={disabled}
        onClick={() => handleClick('SHORT')}
      />
    </div>
  );
}

/* ============================================
   Sub-Component: ActionButton
   ============================================ */

function ActionButton({
  side,
  label,
  feedback,
  disabled,
  onClick,
}: {
  side: 'LONG' | 'SHORT';
  label: string;
  feedback: ButtonFeedback;
  disabled: boolean;
  onClick: () => void;
}) {
  const isLong = side === 'LONG';
  const colorVar = isLong ? 'var(--color-success)' : 'var(--color-danger)';

  const isDisabled = disabled || feedback === 'loading';

  // 动效 class
  const feedbackClass =
    feedback === 'success'
      ? 'scale-[1.02]'
      : feedback === 'error'
        ? 'animate-[shake_0.3s_ease-in-out]'
        : '';

  // 按钮内容
  const content =
    feedback === 'loading' ? (
      <span className="inline-flex items-center gap-1.5">
        <Spinner />
        处理中...
      </span>
    ) : feedback === 'success' ? (
      <span className="inline-flex items-center gap-1">✓ 成功</span>
    ) : (
      label
    );

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`h-11 rounded font-semibold text-sm transition-all ${feedbackClass} ${
        isDisabled
          ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
          : 'text-white hover:brightness-110 active:scale-[0.98]'
      }`}
      style={
        isDisabled
          ? undefined
          : {
              backgroundColor: colorVar,
              boxShadow: `0 4px 12px color-mix(in srgb, ${colorVar} 25%, transparent)`,
            }
      }
    >
      {content}
    </button>
  );
}

/* ============================================
   Spinner SVG
   ============================================ */

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export default memo(ActionButtons);
