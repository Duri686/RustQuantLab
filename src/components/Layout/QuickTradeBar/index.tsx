import { memo } from 'react';

interface QuickTradeBarProps {
    /** 点击做多 */
    onBuy?: () => void;
    /** 点击做空 */
    onSell?: () => void;
    /** 禁用状态 */
    disabled?: boolean;
    className?: string;
}

/**
 * 底部快捷交易栏
 * 等宽平铺做多/做空按钮
 */
function QuickTradeBar({
    onBuy,
    onSell,
    disabled,
    className = ''
}: QuickTradeBarProps) {
    const handleClick = (callback?: () => void) => {
        // 触觉反馈
        if (navigator.vibrate) {
            navigator.vibrate(20);
        }
        callback?.();
    };

    return (
        <div className={`
      flex gap-3 px-4 py-3 bg-terminal-bg border-t border-border-dark
      safe-area-pb
      ${className}
    `}>
            <button
                onClick={() => handleClick(onBuy)}
                disabled={disabled}
                className="
          flex-1 h-12 rounded-lg font-semibold text-white
          bg-success hover:bg-success/90 active:scale-95
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all
        "
            >
                做多 ↑
            </button>
            <button
                onClick={() => handleClick(onSell)}
                disabled={disabled}
                className="
          flex-1 h-12 rounded-lg font-semibold text-white
          bg-danger hover:bg-danger/90 active:scale-95
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all
        "
            >
                做空 ↓
            </button>
        </div>
    );
}

export default memo(QuickTradeBar);
