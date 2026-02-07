import { memo, useState, useCallback } from 'react';
import { useInterval } from 'ahooks';
import type { DataSource } from '../../types/index';
import { useFpsMonitor } from '../../hooks/useFpsMonitor';
import { getWasmMemoryUsage } from '../../hooks/tradingEngine/wasmSingleton';
import type { MarketStats } from '../../hooks/useMarketStats';

/* ============================================
   Types
   ============================================ */

export interface HeaderProps {
  /** 数据流是否运行中 */
  isRunning: boolean;
  /** 切换数据流回调 (仅 MOCK 模式) */
  onToggle?: () => void;
  /** 当前价格 */
  price?: number;
  /** 交易对符号 */
  symbol?: string;
  /** 价格趋势 */
  priceTrend?: 'up' | 'down' | 'neutral';
  /** 价格颜色类 */
  priceColorClass?: string;
  /** 当前数据源 */
  dataSource?: DataSource;
  /** 切换数据源回调 */
  onDataSourceChange?: (source: DataSource) => void;
  /** WebSocket 连接状态 */
  connectionStatus?: string;
  isSwitching?: boolean;
  /** 24h 市场统计 */
  marketStats?: MarketStats;
}

/* ============================================
   Icon Components
   ============================================ */

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={`shrink-0 ${className ?? ''}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

/* ============================================
   FPS 性能监控 (DevTools 模式)
   ============================================ */

function FpsMonitor() {
  const { fps, frameTime } = useFpsMonitor();
  const [wasmMemory, setWasmMemory] = useState<{
    bytes: number;
    megabytes: string;
    pages: number;
  } | null>(null);

  useInterval(() => {
    setWasmMemory(getWasmMemoryUsage());
  }, 1000, { immediate: true });

  const fpsColor =
    fps >= 50 ? 'text-success' : fps >= 30 ? 'text-warning-alt' : 'text-danger';

  return (
    <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-bg-surface/80 border border-border-dark text-[9px] font-mono">
      <span className={`${fpsColor} font-semibold`}>{fps} FPS</span>
      <span className="text-gray-600">|</span>
      <span className="text-gray-400">{frameTime}ms</span>
      {wasmMemory && (
        <>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400">WASM {wasmMemory.megabytes}MB</span>
        </>
      )}
    </div>
  );
}

/* ============================================
   Ticker 信息单元
   ============================================ */



/* ============================================
   数据源切换按钮
   ============================================ */

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
    <div className="flex items-center gap-1 px-1 py-0.5 rounded-md bg-bg-surface border border-border-dark">
      <button
        onClick={() => onChange('mock')}
        disabled={disabled}
        className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${!isBinance
          ? 'bg-warning-alt/20 text-warning-alt border border-warning-alt/30'
          : 'text-gray-500 hover:text-gray-300'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        title="模拟数据 (开发模式)"
      >
        <span className="flex items-center gap-1">
          <span>MOCK</span>
          {disabled && !isBinance && (
            <span className="w-3 h-3 border-2 border-border-dark border-t-warning-alt rounded-full animate-spin" />
          )}
        </span>
      </button>
      <button
        onClick={() => onChange('binance')}
        disabled={disabled}
        className={`px-2 py-1 rounded text-[10px] font-mono transition-colors flex items-center gap-1 ${isBinance
          ? 'bg-success/20 text-success border border-success/30'
          : 'text-gray-500 hover:text-gray-300'
          } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        title="Binance 实时数据"
      >
        <span>LIVE</span>
        {isBinance && (
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-gray-500'}`} />
        )}
        {disabled && isBinance && (
          <span className="w-3 h-3 border-2 border-border-dark border-t-success rounded-full animate-spin" />
        )}
      </button>
    </div>
  );
}

/* ============================================
   格式化工具
   ============================================ */



/* ============================================
   Header Component
   ============================================ */

/**
 * 顶部导航栏 (极简版)
 * 价格信息已移至 Tab 行
 */
function Header({
  isRunning,
  onToggle,
  symbol = 'BTC-USDT',
  dataSource = 'mock',
  onDataSourceChange,
  connectionStatus,
  isSwitching,
}: HeaderProps) {
  const [showDevTools, setShowDevTools] = useState(false);

  // 双击 Logo 切换 DevTools
  const handleLogoDoubleClick = useCallback(() => {
    setShowDevTools((prev) => !prev);
  }, []);

  return (
    <header className="shrink-0 bg-bg-dark border-b border-border-dark">
      {/* 主行 */}
      <div className="h-11 md:h-12 px-2 md:px-4 flex items-center gap-2 md:gap-4 min-w-0">
        {/* ========== Logo ========== */}
        <div
          className="flex items-center gap-2 shrink-0 cursor-default select-none"
          onDoubleClick={handleLogoDoubleClick}
          title="双击切换 DevTools"
        >
          <div className="w-6 h-6 md:w-7 md:h-7 rounded-md bg-bg-surface border border-border-dark flex items-center justify-center">
            <span className="text-sm md:text-base">🦀</span>
          </div>
          <h1 className="hidden md:block text-sm font-semibold tracking-tight text-white">
            RustQuantLab
          </h1>
        </div>

        {/* ========== 交易对 (极简) ========== */}
        <div className="flex items-center shrink-0">
          <span className="text-xs md:text-sm font-bold text-white">{symbol}</span>
          <span className="text-[9px] text-gray-500 font-mono ml-1.5">Perpetual</span>
        </div>

        {/* ========== 弹性填充 ========== */}
        <div className="flex-1" />

        {/* ========== 右侧控制区 ========== */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {/* DevTools 面板 */}
          {showDevTools && <FpsMonitor />}

          {/* 数据源切换 */}
          {onDataSourceChange && (
            <div className="hidden sm:block">
              <DataSourceSwitch
                dataSource={dataSource}
                connectionStatus={connectionStatus}
                onChange={onDataSourceChange}
                isSwitching={isSwitching}
              />
            </div>
          )}

          {/* 连接 / 运行状态指示器 */}
          {dataSource === 'binance' ? (
            <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-surface border border-border-dark">
              <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-success animate-pulse' : 'bg-gray-600'}`} />
              <span className={`text-[10px] font-mono ${connectionStatus === 'connected' ? 'text-success' : 'text-gray-500'}`}>
                {connectionStatus === 'connected' ? 'LIVE' : connectionStatus === 'connecting' ? 'CONN...' : 'OFF'}
              </span>
            </div>
          ) : (
            <>
              <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-surface border border-border-dark">
                <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-success animate-pulse' : 'bg-gray-600'}`} />
                <span className={`text-[10px] font-mono ${isRunning ? 'text-success' : 'text-gray-500'}`}>
                  {isRunning ? 'LIVE' : 'PAUSED'}
                </span>
              </div>
              {onToggle && (
                <button
                  onClick={onToggle}
                  disabled={!!isSwitching}
                  className={`w-7 h-7 md:w-8 md:h-8 rounded-md flex items-center justify-center transition-colors ${isRunning
                    ? 'bg-bg-surface hover:bg-border-dark text-warning-alt border border-border-dark'
                    : 'bg-success hover:opacity-80 text-black'
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
            <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-surface border border-border-dark text-[10px] font-mono text-gray-400">
              <span className="w-3 h-3 border-2 border-border-dark border-t-warning-alt rounded-full animate-spin" />
              <span>SWITCHING...</span>
            </div>
          )}

          {/* GitHub */}
          <a
            href="https://github.com/Duri686/RustQuantLab"
            target="_blank"
            rel="noopener noreferrer"
            className="w-7 h-7 md:w-8 md:h-8 rounded-md flex items-center justify-center transition-colors bg-bg-surface hover:bg-border-dark text-gray-400 hover:text-white border border-border-dark"
            title="GitHub 仓库"
          >
            <GitHubIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </a>
        </div>
      </div>


    </header>
  );
}

export default memo(Header);
