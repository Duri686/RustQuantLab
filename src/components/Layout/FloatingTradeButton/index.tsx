import { memo } from 'react';
import { TrendingUp } from 'lucide-react';

interface FloatingTradeButtonProps {
    onClick: () => void;
    className?: string;
}

/**
 * 悬浮交易按钮 (FAB)
 * 
 * 设计理念:
 * - 仅移动端显示 (PC 端使用 Tab 行的 "去交易" 按钮)
 * - 右下角定位，符合 Thumb Zone
 * - 使用 env(safe-area-inset-bottom) 处理刘海屏
 */
function FloatingTradeButton({ onClick, className = '' }: FloatingTradeButtonProps) {
    return (
        <button
            onClick={() => {
                // 触觉反馈
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(15);
                }
                onClick();
            }}
            className={`
                lg:hidden
                group
                w-14 h-14
                flex items-center justify-center
                rounded-full
                bg-linear-to-br from-success to-emerald-600
                text-white
                shadow-lg shadow-success/30
                transition-all duration-300 ease-out
                hover:scale-110 hover:shadow-xl hover:shadow-success/40
                active:scale-95
                focus:outline-none focus:ring-2 focus:ring-success/50 focus:ring-offset-2 focus:ring-offset-terminal-bg
                ${className}
            `}
            aria-label="打开交易面板"
        >
            {/* 发光效果层 */}
            <div
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                    background: 'radial-gradient(circle, rgba(14, 203, 129, 0.4) 0%, transparent 70%)',
                    filter: 'blur(8px)',
                    transform: 'scale(1.5)',
                }}
            />

            {/* 图标 */}
            <TrendingUp
                size={24}
                className="relative z-10 transition-transform duration-300 group-hover:scale-110"
            />

            {/* 脉冲动画 (吸引注意但不过度) */}
            <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-success" />
        </button>
    );
}

export default memo(FloatingTradeButton);
