import { memo, useState, useEffect } from 'react';
import type { HeaderProps, DataSource } from '../../types/index';
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
      ? 'text-[var(--color-success)]'
      : fps >= 30
      ? 'text-[var(--color-warning-alt)]'
      : 'text-[var(--color-danger)]';

  return (
    <div className="hidden md:flex items-center gap-2 px-2 py-0.5 rounded bg-[var(--color-bg-surface)]/80 border border-[var(--color-border-dark)] text-[9px] font-mono">
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

/**
 * 数据源切换按钮
 */
function DataSourceSwitch({
  dataSource,
  connectionStatus,
  onChange,
  isSwitching,
}: {
  dataSource: DataSource;
  connectionStatus?: string;
  onChange: (source: DataSource) => void;
  isSwitching?: boolean;
}) {
  const isBinance = dataSource === 'binance';
  const isConnected = connectionStatus === 'connected';
  const disabled = !!isSwitching;

  return (
    <div className="hidden sm:flex items-center gap-1 px-1 py-0.5 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-dark)]">
      {/* Mock 按钮 */}
      <button
        onClick={() => onChange('mock')}
        disabled={disabled}
        className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
          !isBinance
            ? 'bg-[var(--color-warning-alt)]/20 text-[var(--color-warning-alt)] border border-[var(--color-warning-alt)]/30'
            : 'text-gray-500 hover:text-gray-300'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        title="模拟数据 (开发模式)"
      >
        <span className="flex items-center gap-1">
          <span>MOCK</span>
          {disabled && !isBinance && (
            <span className="w-3 h-3 border-2 border-[var(--color-border-dark)] border-t-[var(--color-warning-alt)] rounded-full animate-spin" />
          )}
        </span>
      </button>

      {/* Binance 按钮 */}
      <button
        onClick={() => onChange('binance')}
        disabled={disabled}
        className={`px-2 py-1 rounded text-[10px] font-mono transition-colors flex items-center gap-1 ${
          isBinance
            ? 'bg-[var(--color-success)]/20 text-[var(--color-success)] border border-[var(--color-success)]/30'
            : 'text-gray-500 hover:text-gray-300'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        title="Binance 实时数据"
      >
        <span>LIVE</span>
        {isBinance && (
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected
                ? 'bg-[var(--color-success)] animate-pulse'
                : 'bg-gray-500'
            }`}
          />
        )}
        {disabled && isBinance && (
          <span className="w-3 h-3 border-2 border-[var(--color-border-dark)] border-t-[var(--color-success)] rounded-full animate-spin" />
        )}
      </button>
    </div>
  );
}

function Header({
  isRunning,
  onToggle,
  price: _price,
  symbol: _symbol = 'BTC-USDT',
  priceTrend: _priceTrend = 'neutral',
  priceColorClass: _priceColorClass = 'text-white',
  dataSource = 'mock',
  onDataSourceChange,
  connectionStatus,
  isSwitching,
}: HeaderProps) {
  return (
    <header className="h-11 md:h-12 flex-shrink-0 bg-[var(--color-bg-dark)] border-b border-[var(--color-border-dark)] px-2 md:px-4 flex items-center justify-between">
      {/* Logo + FPS Monitor */}
      <div className="flex items-center gap-2 md:gap-3">
        <div className="w-6 h-6 md:w-7 md:h-7 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-dark)] flex items-center justify-center">
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

      {/* Center: (removed) */}
      <div />

      {/* Right: Status & Controls */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* 数据源切换 */}
        {onDataSourceChange && (
          <DataSourceSwitch
            dataSource={dataSource}
            connectionStatus={connectionStatus}
            onChange={onDataSourceChange}
            isSwitching={isSwitching}
          />
        )}

        {/* Live 指示器 - 移动端简化为圆点 */}
        {/* LIVE 模式下显示连接状态，MOCK 模式下显示运行状态 */}
        {dataSource === 'binance' ? (
          <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-dark)]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === 'connected'
                  ? 'bg-[var(--color-success)] animate-pulse'
                  : 'bg-gray-600'
              }`}
            />
            <span
              className={`text-[11px] font-mono ${
                connectionStatus === 'connected'
                  ? 'text-[var(--color-success)]'
                  : 'text-gray-500'
              }`}
            >
              {connectionStatus === 'connected'
                ? 'LIVE'
                : connectionStatus === 'connecting'
                ? 'CONNECTING'
                : 'DISCONNECTED'}
            </span>
          </div>
        ) : (
          <>
            <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-dark)]">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isRunning
                    ? 'bg-[var(--color-success)] animate-pulse'
                    : 'bg-gray-600'
                }`}
              />
              <span
                className={`text-[11px] font-mono ${
                  isRunning ? 'text-[var(--color-success)]' : 'text-gray-500'
                }`}
              >
                {isRunning ? 'LIVE' : 'PAUSED'}
              </span>
            </div>

            {/* 播放/暂停按钮 - 仅在 MOCK 模式下显示，且 onToggle 存在 */}
            {onToggle && (
              <button
                onClick={onToggle}
                disabled={!!isSwitching}
                className={`w-7 h-7 md:w-8 md:h-8 rounded-md flex items-center justify-center transition-colors ${
                  isRunning
                    ? 'bg-[var(--color-bg-surface)] hover:bg-[var(--color-border-dark)] text-[var(--color-warning-alt)] border border-[var(--color-border-dark)]'
                    : 'bg-[var(--color-success)] hover:opacity-80 text-black'
                } ${isSwitching ? 'opacity-60 cursor-not-allowed' : ''}`}
                title={isRunning ? '暂停数据流' : '启动数据流'}
              >
                {isRunning ? (
                  <PauseIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                ) : (
                  <PlayIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                )}
              </button>
            )}
          </>
        )}

        {/* 切换中提示 */}
        {isSwitching && (
          <div className="hidden md:flex items-center gap-2 px-2 py-1 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border-dark)] text-[11px] font-mono text-gray-400">
            <span className="w-3 h-3 border-2 border-[var(--color-border-dark)] border-t-[var(--color-warning-alt)] rounded-full animate-spin" />
            <span>SWITCHING...</span>
          </div>
        )}

        {/* GitHub 链接 */}
        <a
          href="https://github.com/Duri686/RustQuantLab"
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 md:w-8 md:h-8 rounded-md flex items-center justify-center transition-colors bg-[var(--color-bg-surface)] hover:bg-[var(--color-border-dark)] text-gray-400 hover:text-white border border-[var(--color-border-dark)]"
          title="GitHub 仓库"
        >
          <GitHubIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
        </a>
      </div>
    </header>
  );
}

export default memo(Header);
