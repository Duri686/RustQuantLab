import { memo, useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

/* ============================================
   Toast Types
   ============================================ */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  /** 唯一标识 */
  id: string;
  /** Toast 类型 */
  type: ToastType;
  /** 消息内容 */
  message: string;
  /** 持续时间 (ms)，0 表示不自动关闭 */
  duration?: number;
  /** 关闭回调 */
  onClose: (id: string) => void;
}

/* ============================================
   Style Config
   ============================================ */

const TOAST_STYLES: Record<
  ToastType,
  { bg: string; border: string; icon: string }
> = {
  success: {
    bg: 'bg-[var(--color-success)]/10',
    border: 'border-[var(--color-success)]/30',
    icon: 'var(--color-success)',
  },
  error: {
    bg: 'bg-[var(--color-danger)]/10',
    border: 'border-[var(--color-danger)]/30',
    icon: 'var(--color-danger)',
  },
  warning: {
    bg: 'bg-[var(--color-warning)]/10',
    border: 'border-[var(--color-warning)]/30',
    icon: 'var(--color-warning)',
  },
  info: {
    bg: 'bg-[var(--color-info)]/10',
    border: 'border-[var(--color-info)]/30',
    icon: 'var(--color-info)',
  },
};

const ICONS: Record<ToastType, typeof AlertCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

/* ============================================
   Toast Component
   ============================================ */

function Toast({ id, type, message, duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const style = TOAST_STYLES[type];
  const Icon = ICONS[type];

  // 入场动画
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // 自动关闭
  useEffect(() => {
    if (duration <= 0) return;

    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => onClose(id), 200);
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm
        ${style.bg} ${style.border}
        transition-all duration-200 ease-out
        ${
          isVisible && !isLeaving
            ? 'opacity-100 translate-x-0'
            : 'opacity-0 translate-x-4'
        }
      `}
    >
      <Icon size={18} className="shrink-0" style={{ color: style.icon }} />
      <span className="text-sm text-white flex-1">{message}</span>
      <button
        onClick={handleClose}
        className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
      >
        <X size={14} className="text-gray-400" />
      </button>
    </div>
  );
}

export default memo(Toast);
