import { memo } from 'react';
import type { StatsPanelProps } from '../../types/index';
import { UI_TEXT } from '../../constants/ui-glossary';

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
  /** 副标签颜色 */
  suffixColorClass?: string;
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
  suffixColorClass = 'text-gray-600',
}: StatCellProps) {
  return (
    <div className="flex flex-col justify-center px-1.5 md:px-3 py-1 h-full min-w-20 md:min-w-0 shrink-0 md:shrink">
      <span className="text-[8px] md:text-[9px] text-gray-500 uppercase tracking-wider leading-none mb-0.5 md:mb-1">
        {label}
      </span>
      <div className="flex items-baseline gap-0.5 md:gap-1">
        <span
          className={`text-[10px] md:text-xs font-bold font-mono tabular-nums leading-none ${colorClass}`}
        >
          {value}
        </span>
        {suffix && (
          <span className={`text-[8px] md:text-[9px] font-mono ${suffixColorClass}`}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/* ============================================
   格式化工具
   ============================================ */

function formatFundingCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ============================================
   StatsPanel Component (合约交易信息条)
   ============================================ */

/**
 * 合约交易信息条
 * Binance Futures 风格：单行 5 列布局
 * Mark Price / Index Price / Funding Rate / 24h Change / Spread
 */
function StatsPanel({
  analysisResult,
  marketStats,
}: StatsPanelProps) {
  const changePercent = marketStats?.priceChangePercent ?? 0;
  const changeColor = changePercent >= 0 ? 'text-success' : 'text-danger';
  const changeSign = changePercent >= 0 ? '+' : '';

  return (
    <div
      className="
        shrink-0 h-10 md:h-12 bg-bg-black border-t border-border-dark
        flex md:grid md:grid-cols-5 divide-x divide-border-dark
        overflow-x-auto scrollbar-hide
      "
    >
      {/* Mark Price */}
      <StatCell
        label="Mark Price"
        value={`$${(marketStats?.markPrice ?? 0).toFixed(2)}`}
        colorClass="text-warning-alt"
      />

      {/* Index Price */}
      <StatCell
        label="Index Price"
        value={`$${(marketStats?.indexPrice ?? 0).toFixed(2)}`}
      />

      {/* Funding Rate / Countdown */}
      <StatCell
        label={`${UI_TEXT.market.fundingRate} / ${UI_TEXT.market.countdown}`}
        value={`${((marketStats?.fundingRate ?? 0) * 100).toFixed(4)}%`}
        suffix={formatFundingCountdown(marketStats?.fundingCountdown ?? 0)}
        colorClass={(marketStats?.fundingRate ?? 0) >= 0 ? 'text-success' : 'text-danger'}
        suffixColorClass="text-warning-alt"
      />

      {/* 24h Change */}
      <StatCell
        label={UI_TEXT.market.change24h}
        value={`${changeSign}${changePercent.toFixed(2)}%`}
        suffix={`${changeSign}${(marketStats?.priceChange ?? 0).toFixed(2)}`}
        colorClass={changeColor}
      />

      {/* Spread */}
      <StatCell
        label="Spread"
        value={`$${analysisResult?.spread?.toFixed(4) ?? '--'}`}
        colorClass="text-cyan"
      />
    </div>
  );
}

export default memo(StatsPanel);
