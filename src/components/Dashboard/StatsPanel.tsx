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
 */
function StatCell({
  label,
  value,
  colorClass = 'text-white',
  suffix,
}: StatCellProps) {
  return (
    <div className="flex flex-col justify-center px-4 py-1 h-full">
      <span className="text-[9px] text-gray-500 uppercase tracking-wider leading-none mb-1">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span
          className={`text-base font-bold font-mono tabular-nums leading-none ${colorClass}`}
          style={{ textShadow: '0 0 8px currentColor' }}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-[9px] text-gray-600 font-mono">{suffix}</span>
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
  // DEBUG: 检查 Rust 返回的字段名（开发时启用）
  // console.log('Rust Analysis:', analysisResult);

  /**
   * 获取 SMA5 显示值
   * 兼容 sma5 和 sma_5 两种命名（Rust serde 可能输出不同格式）
   */
  const getSma5Value = (): string => {
    if (!analysisResult) return '--';
    // 优先尝试 camelCase (sma5)，再尝试 snake_case (sma_5)
    // Rust serde rename_all="camelCase" 会把 sma_5 转成 sma5
    const result = analysisResult as unknown as Record<string, unknown>;
    const sma5 = result.sma5 ?? result.sma_5;
    if (sma5 == null) {
      // 数据不足时显示计算中
      return isRunning ? 'Calc...' : '--';
    }
    return `$${(sma5 as number).toFixed(2)}`;
  };
  return (
    <div className="shrink-0 h-16 bg-[#0d0d0d] border-t border-[#2b2f36] grid grid-cols-4 divide-x divide-[#2b2f36]">
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
        value={getSma5Value()}
        colorClass="text-[#00B8D9]"
      />

      {/* Candles / Status */}
      <div className="flex items-center justify-between px-4">
        <div className="flex flex-col justify-center h-full">
          <span className="text-[9px] text-gray-500 uppercase tracking-wider leading-none mb-1">
            Candles
          </span>
          <span
            className="text-base font-bold font-mono tabular-nums leading-none text-[#E040FB]"
            style={{ textShadow: '0 0 8px #E040FB' }}
          >
            {candleCount}
          </span>
        </div>
        {/* 状态指示器 */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isRunning ? 'bg-[#0ECB81] animate-pulse' : 'bg-gray-600'
            }`}
          />
          <span
            className={`text-[10px] font-mono ${
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
