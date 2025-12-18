import { memo } from 'react';
import type { HeaderProps } from '../../types/index';

/* ============================================
   Icon Components
   ============================================ */

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className ?? ''}`}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className ?? ''}`}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

/* ============================================
   Header Component
   ============================================ */

/**
 * 顶部导航栏组件
 * 显示 Logo、当前价格、状态指示器和控制按钮
 */
function Header({
  isRunning,
  onToggle,
  price,
  symbol = 'BBB-AAA',
  priceTrend = 'neutral',
  priceColorClass = 'text-white',
}: HeaderProps) {
  return (
    <header className="h-12 flex-shrink-0 bg-[#0b0e11] border-b border-[#2b2f36] px-4 flex items-center justify-between">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-md bg-[#1e2026] border border-[#2b2f36] flex items-center justify-center">
          <span className="text-base">🦀</span>
        </div>
        <div className="hidden sm:block">
          <h1 className="text-sm font-semibold tracking-tight text-white">
            RustQuantLab
          </h1>
          <p className="text-[10px] text-gray-600 font-mono">
            Wasm Trading Engine
          </p>
        </div>
      </div>

      {/* Center: Market Symbol */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono font-semibold text-gray-300">
          {symbol}
        </span>
        <span
          className={`text-sm font-mono font-bold tabular-nums ${priceColorClass}`}
        >
          ${price?.toFixed(2) ?? '--'}
        </span>
        {priceTrend === 'up' && (
          <span className="text-[#0ECB81] text-xs">▲</span>
        )}
        {priceTrend === 'down' && (
          <span className="text-[#F6465D] text-xs">▼</span>
        )}
      </div>

      {/* Right: Status & Controls */}
      <div className="flex items-center gap-3">
        {/* Live 指示器 */}
        <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md bg-[#1e2026] border border-[#2b2f36]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isRunning ? 'bg-[#0ECB81] animate-pulse' : 'bg-gray-600'
            }`}
          />
          <span
            className={`text-[11px] font-mono ${
              isRunning ? 'text-[#0ECB81]' : 'text-gray-500'
            }`}
          >
            {isRunning ? 'LIVE' : 'PAUSED'}
          </span>
        </div>

        {/* 播放/暂停按钮 */}
        <button
          onClick={onToggle}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
            isRunning
              ? 'bg-[#1e2026] hover:bg-[#2b2f36] text-[#F0B90B] border border-[#2b2f36]'
              : 'bg-[#0ECB81] hover:bg-[#0bb375] text-black'
          }`}
          title={isRunning ? '暂停数据流' : '启动数据流'}
        >
          {isRunning ? (
            <PauseIcon className="w-4 h-4" />
          ) : (
            <PlayIcon className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
}

export default memo(Header);
