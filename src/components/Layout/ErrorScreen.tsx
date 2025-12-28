/**
 * ErrorScreen Props
 */
interface ErrorScreenProps {
  /** 错误信息 */
  message: string;
}

/**
 * 全屏错误状态组件
 * 显示 Wasm 加载失败信息
 */
function ErrorScreen({ message }: ErrorScreenProps) {
  return (
    <div className="h-screen w-screen bg-[var(--color-bg-dark)] flex items-center justify-center p-6">
      <div className="bg-[var(--color-bg-surface)] border border-[var(--color-danger)]/30 rounded-lg p-8 max-w-md text-center">
        <div className="text-[var(--color-danger)] text-4xl mb-4">⚠</div>
        <h2 className="text-[var(--color-danger)] text-xl font-bold mb-2">加载失败</h2>
        <p className="text-gray-400 mb-4">{message}</p>
        <p className="text-gray-600 text-sm font-mono">
          请运行{' '}
          <code className="bg-[var(--color-border-dark)] px-2 py-1 rounded">
            npm run build:wasm
          </code>
        </p>
      </div>
    </div>
  );
}

export default ErrorScreen;
