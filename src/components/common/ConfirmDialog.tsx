import { memo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/* ============================================
   Types
   ============================================ */
interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'normal';
    onConfirm: () => void;
    onCancel: () => void;
}

/* ============================================
   Constants
   ============================================ */
const VARIANT_STYLES = {
    danger: {
        icon: '⚠️',
        confirmBtn: 'bg-red-600 hover:bg-red-700 text-white',
        iconBg: 'bg-red-500/10',
    },
    warning: {
        icon: '⚡',
        confirmBtn: 'bg-yellow-600 hover:bg-yellow-700 text-white',
        iconBg: 'bg-yellow-500/10',
    },
    normal: {
        icon: '❓',
        confirmBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
        iconBg: 'bg-blue-500/10',
    },
} as const;

/* ============================================
   Component
   ============================================ */
function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmText = '确认',
    cancelText = '取消',
    variant = 'normal',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    // ESC 键关闭
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel();
        },
        [onCancel]
    );

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    const styles = VARIANT_STYLES[variant];

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={onCancel}
        >
            {/* 背景遮罩 */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* 弹窗内容 */}
            <div
                className="relative bg-gray-900 rounded-xl border border-gray-700 
                   shadow-2xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 图标 */}
                <div className={`w-12 h-12 ${styles.iconBg} rounded-full 
                        flex items-center justify-center text-2xl mx-auto mb-4`}>
                    {styles.icon}
                </div>

                {/* 标题 */}
                <h3 className="text-lg font-semibold text-white text-center mb-2">
                    {title}
                </h3>

                {/* 消息 */}
                <p className="text-sm text-gray-400 text-center mb-6">
                    {message}
                </p>

                {/* 按钮组 */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 
                       bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg 
                        transition-colors ${styles.confirmBtn}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default memo(ConfirmDialog);
