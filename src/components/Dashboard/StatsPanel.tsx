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
    <div className="flex flex-col items-center justify-center px-1.5 md:px-3 py-1 h-full min-w-20 md:min-w-0 shrink-0 md:shrink">
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
 * Binance Futures 风格：单行 7 列布局
 * Mark Price / Index Price / Funding Rate / 24h Change / 24h Vol / Taker Buy / Spread
 */
function StatsPanel({
  analysisResult,
  marketStats,
}: StatsPanelProps) {
  const changePercent = marketStats?.priceChangePercent ?? 0;
  const changeColor = changePercent >= 0 ? 'text-success' : 'text-danger';
  const changeSign = changePercent >= 0 ? '+' : '';

  // 格式化大数字（成交量/额）
  const fmtBig = (n: number): string => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toFixed(2);
  };

  const takerRatio = marketStats?.takerBuyRatio;
  const takerPct = takerRatio != null ? (takerRatio * 100).toFixed(1) : '--';

  return (
    <div
      className="
        shrink-0 bg-bg-black border-t border-border-dark
        hidden md:grid md:grid-cols-7 divide-x divide-border-dark
        overflow-x-auto scrollbar-hide
        py-2
      "
      style={{
        paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
      }}
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

      {/* 24h Volume */}
      <StatCell
        label="24h Vol"
        value={fmtBig(marketStats?.volume24h ?? 0)}
        suffix={`≈$${fmtBig(marketStats?.turnover24h ?? 0)}`}
        suffixColorClass="text-gray-500"
      />

      {/* Taker Buy Ratio */}
      <div className="flex flex-col items-center justify-center px-1.5 md:px-3 py-1 h-full">
        <span className="text-[8px] md:text-[9px] text-gray-500 uppercase tracking-wider leading-none mb-0.5 md:mb-1">
          Buy / Sell
        </span>
        <div className="flex items-center gap-1">
          <div className="w-14 h-1.5 rounded-full overflow-hidden bg-danger/40">
            <div
              className="h-full rounded-full bg-success transition-all duration-500 ease-out"
              style={{ width: takerRatio != null ? `${takerRatio * 100}%` : '50%' }}
            />
          </div>
          <span className="text-[10px] font-mono font-bold tabular-nums text-success leading-none">
            {takerPct}%
          </span>
        </div>
      </div>

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
