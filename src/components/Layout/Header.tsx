import { memo, useState, useEffect } from 'react';
import type { HeaderProps } from '../../types/index';
import { useFpsMonitor } from '../../hooks/useFpsMonitor';
import { getWasmMemoryUsage } from '../../hooks/tradingEngine/wasmSingleton';

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

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 ${className ?? ''}`}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
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
/**
 * FPS 性能监控显示组件
 */
function FpsMonitor() {
  const { fps, frameTime } = useFpsMonitor();
  const [wasmMemory, setWasmMemory] = useState<{
    bytes: number;
    megabytes: string;
    pages: number;
  } | null>(null);

  // 每秒更新一次 WASM 内存
  useEffect(() => {
    const updateMemory = () => {
      const memory = getWasmMemoryUsage();
      setWasmMemory(memory);
    };

    // 立即执行一次
    updateMemory();

    // 每秒更新
    const interval = setInterval(updateMemory, 1000);
    return () => clearInterval(interval);
  }, []);

  // FPS 颜色：绿色 >= 50, 黄色 >= 30, 红色 < 30
  const fpsColor =
    fps >= 50
      ? 'text-[#0ECB81]'
      : fps >= 30
      ? 'text-[#F0B90B]'
      : 'text-[#F6465D]';

  return (
    <div className="hidden md:flex items-center gap-2 px-2 py-0.5 rounded bg-[#1e2026]/80 border border-[#2b2f36] text-[9px] font-mono">
      <span className={`${fpsColor} font-semibold`}>{fps} FPS</span>
      <span className="text-gray-500">|</span>
      <span className="text-gray-400">{frameTime}ms</span>
      {wasmMemory && (
        <>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400">WASM {wasmMemory.megabytes}MB</span>
        </>
      )}
    </div>
  );
}

function Header({
  isRunning,
  onToggle,
  price,
  symbol = 'BTC-USDT',
  priceTrend = 'neutral',
  priceColorClass = 'text-white',
}: HeaderProps) {
  return (
    <header className="h-11 md:h-12 flex-shrink-0 bg-[#0b0e11] border-b border-[#2b2f36] px-2 md:px-4 flex items-center justify-between">
      {/* Logo + FPS Monitor */}
      <div className="flex items-center gap-2 md:gap-3">
        <div className="w-6 h-6 md:w-7 md:h-7 rounded-md bg-[#1e2026] border border-[#2b2f36] flex items-center justify-center">
          <span className="text-sm md:text-base">🦀</span>
        </div>
        <div className="hidden md:block">
          <h1 className="text-sm font-semibold tracking-tight text-white">
            RustQuantLab
          </h1>
          <p className="text-[10px] text-gray-600 font-mono">
            Wasm Trading Engine
          </p>
        </div>
        {/* FPS 监控 - logo 右侧 */}
        <FpsMonitor />
      </div>

      {/* Center: Market Symbol + Price (clamp 流体字体) */}
      <div className="flex items-center gap-1.5 md:gap-2">
        <span className="text-[11px] md:text-sm font-mono font-semibold text-gray-300 truncate max-w-[80px] md:max-w-none">
          {symbol}
        </span>
        <span
          className={`text-[clamp(12px,3vw,14px)] md:text-sm font-mono font-bold tabular-nums ${priceColorClass}`}
        >
          ${price?.toFixed(2) ?? '--'}
        </span>
        {priceTrend === 'up' && (
          <span className="text-[#0ECB81] text-[10px] md:text-xs">▲</span>
        )}
        {priceTrend === 'down' && (
          <span className="text-[#F6465D] text-[10px] md:text-xs">▼</span>
        )}
      </div>

      {/* Right: Status & Controls */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Live 指示器 - 移动端简化为圆点 */}
        <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded-md bg-[#1e2026] border border-[#2b2f36]">
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
          className={`w-7 h-7 md:w-8 md:h-8 rounded-md flex items-center justify-center transition-colors ${
            isRunning
              ? 'bg-[#1e2026] hover:bg-[#2b2f36] text-[#F0B90B] border border-[#2b2f36]'
              : 'bg-[#0ECB81] hover:bg-[#0bb375] text-black'
          }`}
          title={isRunning ? '暂停数据流' : '启动数据流'}
        >
          {isRunning ? (
            <PauseIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
          ) : (
            <PlayIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
          )}
        </button>

        {/* GitHub 链接 */}
        <a
          href="https://github.com/Duri686/RustQuantLab"
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 md:w-8 md:h-8 rounded-md flex items-center justify-center transition-colors bg-[#1e2026] hover:bg-[#2b2f36] text-gray-400 hover:text-white border border-[#2b2f36]"
          title="GitHub 仓库"
        >
          <GitHubIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
        </a>
      </div>
    </header>
  );
}

export default memo(Header);
