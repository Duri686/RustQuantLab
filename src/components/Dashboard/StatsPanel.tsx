import { memo } from 'react';
import type { StatsPanelProps } from '../../types/index';

/* ============================================
   StatCell Sub-Component (高密度信息单元)
   ============================================ */

interface StatCellProps {
  /** 标签名 */
  label: string;
  /** 数值 */
  value: string;
  /** 数值颜色 */
  colorClass?: string;
  /** 副标签 */
  suffix?: string;
}

/**
 * 高密度指标单元格
 * 紧凑布局：上方小标签，下方大数字
 * 移动端使用更小的字体和间距
 */
function StatCell({
  label,
  value,
  colorClass = 'text-white',
  suffix,
}: StatCellProps) {
  return (
    <div className="flex flex-col justify-center px-2 md:px-4 py-1 h-full">
      <span className="text-[8px] md:text-[9px] text-gray-500 uppercase tracking-wider leading-none mb-0.5 md:mb-1">
        {label}
      </span>
      <div className="flex items-baseline gap-0.5 md:gap-1">
        <span
          className={`text-[clamp(12px,3vw,16px)] md:text-base font-bold font-mono tabular-nums leading-none ${colorClass}`}
          style={{ textShadow: '0 0 8px currentColor' }}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-[8px] md:text-[9px] text-gray-600 font-mono">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/* ============================================
   StatsPanel Component (高密度水平信息条)
   ============================================ */

/**
 * Rust 分析信息条组件
 * 专业终端风格：固定高度，4 列网格，高密度数据展示
 */
function StatsPanel({
  latestData,
  analysisResult,
  priceColorClass,
  candleCount,
  isRunning,
}: StatsPanelProps) {
  /**
   * 格式化 SMA5 显示值
   * 严格使用 WasmAnalysisResult.sma5 字段 (camelCase)
   */
  const formatSma5 = (): string => {
    if (!analysisResult) return '--';
    const { sma5 } = analysisResult;
    if (sma5 == null) {
      return isRunning ? 'Calc...' : '--';
    }
    return `$${sma5.toFixed(2)}`;
  };
  return (
    <div
      className="
        shrink-0 h-auto md:h-16 bg-[#0d0d0d] border-t border-[#2b2f36]
        grid grid-cols-2 md:grid-cols-4
        divide-x divide-[#2b2f36]
      "
    >
      {/* Last Price */}
      <StatCell
        label="Last Price"
        value={`$${latestData?.price.toFixed(2) ?? '--'}`}
        colorClass={priceColorClass}
      />

      {/* Spread */}
      <StatCell
        label="Spread"
        value={`$${analysisResult?.spread?.toFixed(4) ?? '--'}`}
        colorClass="text-[#F0B90B]"
      />

      {/* SMA5 */}
      <StatCell
        label="SMA (5)"
        value={formatSma5()}
        colorClass="text-[#00B8D9]"
      />

      {/* Candles / Status - 移动端简化 */}
      <div className="flex items-center justify-between px-2 md:px-4 py-1 md:py-0">
        <div className="flex flex-col justify-center h-full">
          <span className="text-[8px] md:text-[9px] text-gray-500 uppercase tracking-wider leading-none mb-0.5 md:mb-1">
            Candles
          </span>
          <span
            className="text-[clamp(12px,3vw,16px)] md:text-base font-bold font-mono tabular-nums leading-none text-[#E040FB]"
            style={{ textShadow: '0 0 8px #E040FB' }}
          >
            {candleCount}
          </span>
        </div>
        {/* 状态指示器 */}
        <div className="flex items-center gap-1 md:gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isRunning ? 'bg-[#0ECB81] animate-pulse' : 'bg-gray-600'
            }`}
          />
          <span
            className={`text-[9px] md:text-[10px] font-mono ${
              isRunning ? 'text-[#0ECB81]' : 'text-gray-500'
            }`}
          >
            {isRunning ? 'LIVE' : 'OFF'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default memo(StatsPanel);
