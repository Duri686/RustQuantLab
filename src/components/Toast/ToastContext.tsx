import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import Toast, { type ToastType } from './Toast';

/* ============================================
   Types
   ============================================ */

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  /** 显示 Toast */
  showToast: (type: ToastType, message: string, duration?: number) => void;
  /** 快捷方法 */
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

/* ============================================
   Context
   ============================================ */

const ToastContext = createContext<ToastContextValue | null>(null);

/* ============================================
   Provider
   ============================================ */

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (type: ToastType, message: string, duration = 3000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 快捷方法
  const success = useCallback(
    (message: string, duration?: number) =>
      showToast('success', message, duration),
    [showToast],
  );
  const error = useCallback(
    (message: string, duration?: number) =>
      showToast('error', message, duration),
    [showToast],
  );
  const warning = useCallback(
    (message: string, duration?: number) =>
      showToast('warning', message, duration),
    [showToast],
  );
  const info = useCallback(
    (message: string, duration?: number) =>
      showToast('info', message, duration),
    [showToast],
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}

      {/* Toast 容器 */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              id={toast.id}
              type={toast.type}
              message={toast.message}
              duration={toast.duration}
              onClose={removeToast}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ============================================
   Hook
   ============================================ */

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
