/**
 * 全屏加载状态组件
 * 显示 Wasm 引擎初始化过程
 */
function LoadingScreen() {
  return (
    <div className="h-screen w-screen bg-[var(--color-bg-dark)] flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-2 border-[var(--color-warning-alt)] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-mono text-sm">初始化 Wasm 引擎...</p>
      </div>
    </div>
  );
}

export default LoadingScreen;
