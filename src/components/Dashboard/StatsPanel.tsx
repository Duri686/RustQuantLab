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
 * 专业终端风格：单行 3 列布局，高密度数据展示
 */
function StatsPanel({
  latestData,
  analysisResult,
  priceColorClass,
}: StatsPanelProps) {
  /** 格式化 SMA5 显示值 */
  const formatSma5 = (): string => {
    const sma5 = analysisResult?.sma5;
    return sma5 != null ? `$${sma5.toFixed(2)}` : '--';
  };
  return (
    <div
      className="
        shrink-0 h-10 md:h-12 bg-bg-black border-t border-border-dark
        grid grid-cols-3 divide-x divide-border-dark
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
        colorClass="text-warning-alt"
      />

      {/* SMA5 */}
      <StatCell
        label="SMA (5)"
        value={formatSma5()}
        colorClass="text-cyan"
      />
    </div>
  );
}

export default memo(StatsPanel);
