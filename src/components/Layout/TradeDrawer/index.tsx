import { memo, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Pin, PinOff, X, BarChart3 } from 'lucide-react';
import { useLocalStorage } from '../../../hooks/useLocalStorage';

interface TradeDrawerProps {
    /** 是否打开 */
    open: boolean;
    /** 关闭回调 */
    onClose: () => void;
    /** Drawer 内容 (TradePanel) */
    children: ReactNode;
    /** 订单簿内容 (PC 端显示) */
    orderBookContent?: ReactNode;
}

/**
 * 统一交易面板 Drawer
 * 
 * 设计变更:
 * - Header 横跨整个 Drawer，视觉更统一
 * - 使用中性标题 "交易"
 * - 方向选择在 TradePanel 内部完成
 * 
 * 布局:
 * - 移动端: 底部滑出 (仅 TradePanel)
 * - 桌面端: 右侧滑出 (Header + [OrderBook | TradePanel])
 */
function TradeDrawer({ open, onClose, children, orderBookContent }: TradeDrawerProps) {
    const [isPinned, setIsPinned] = useLocalStorage('drawer_pinned', false);
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

    // Esc 关闭: 直接关闭面板，同时重置 pin 状态保持对称
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && open) {
                // 取消固定（如果有）+ 关闭面板
                if (isPinned) setIsPinned(false);
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose, isPinned, setIsPinned]);

    // 阻止滚动穿透
    useEffect(() => {
        if (open && !isDesktop) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = '';
            };
        }
    }, [open, isDesktop]);

    if (!open) return null;

    const content = (
        <>
            {/* 遮罩层 - 仅移动端或未固定时 */}
            {(!isDesktop || !isPinned) && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 animate-fade-in"
                    onClick={onClose}
                />
            )}

            {/* Drawer 面板 */}
            <div
                className={`
                    fixed z-50 bg-terminal-bg flex flex-col
                    ${isDesktop
                        ? 'top-0 right-0 h-full w-[680px] border-l border-border-dark animate-slide-in-right'
                        : 'bottom-0 left-0 right-0 h-[70vh] rounded-t-2xl border-t border-border-dark animate-slide-in-bottom'
                    }
                `}
            >
                {/* 统一 Header - 横跨整个 Drawer */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border-dark shrink-0 bg-bg-surface">
                    <div className="flex items-center gap-2">
                        <BarChart3 size={18} className="text-success" />
                        <span className="font-medium text-gray-200">交易</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {isDesktop && (
                            <button
                                onClick={() => {
                                    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
                                    setIsPinned(!isPinned);
                                }}
                                className={`
                                    p-2 rounded-lg transition-all duration-200
                                    ${isPinned
                                        ? 'bg-success/20 text-success'
                                        : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                                    }
                                `}
                                title={isPinned ? '取消固定' : '固定面板'}
                            >
                                {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
                                onClose();
                            }}
                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-800 hover:text-white transition-all duration-200"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* 移动端拖动条 */}
                {!isDesktop && (
                    <div className="flex justify-center py-2 bg-bg-surface border-b border-border-dark/50">
                        <div className="h-1 w-10 bg-gray-600 rounded-full" />
                    </div>
                )}

                {/* 内容区域 */}
                <div className="flex-1 flex min-h-0">
                    {/* PC 端: 左侧订单簿 */}
                    {isDesktop && orderBookContent && (
                        <div className="w-[320px] border-r border-border-dark/50 overflow-hidden flex flex-col bg-bg-surface-alt">
                            {orderBookContent}
                        </div>
                    )}

                    {/* 交易面板区域 */}
                    <div className="flex-1 flex flex-col min-w-0 p-4 overflow-y-auto">
                        {children}
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(content, document.body);
}

export default memo(TradeDrawer);
