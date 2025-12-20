/**
 * Re-Sync 按钮 Props
 */
interface ChartOverlayProps {
  /** 是否显示按钮 */
  visible: boolean;
  /** 点击回调 */
  onReSync: () => void;
}

/**
 * 图表覆盖层组件
 * 显示 Re-Sync 按钮，用于返回实时数据视图
 */
export function ChartOverlay({ visible, onReSync }: ChartOverlayProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onReSync}
      className="absolute top-2 right-16 z-10 flex items-center gap-1.5 px-3 py-1.5 
                 bg-[#00d4ff]/20 hover:bg-[#00d4ff]/30 
                 border border-[#00d4ff]/50 rounded-lg
                 text-[#00d4ff] text-xs font-medium
                 transition-all duration-200 backdrop-blur-sm
                 shadow-lg shadow-[#00d4ff]/10"
      title="返回实时数据"
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
      <span>跟随最新</span>
    </button>
  );
}
