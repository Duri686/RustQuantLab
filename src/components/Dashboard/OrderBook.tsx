import { memo, useMemo, useState, useEffect, useRef } from 'react';
import type { OrderBookProps } from '../../types/index';

/* ============================================
   Binance 风格颜色常量
   ============================================ */
const COLORS = {
  /** Binance 红（卖单） */
  askRed: '#F6465D',
  /** Binance 绿（买单） */
  bidGreen: '#0ECB81',
  /** 文字灰色 */
  textGray: '#9ca3af',
  /** 暗灰色 */
  textDark: '#6b7280',
} as const;

/** 视图模式类型 */
type ViewMode = 'both' | 'bids' | 'asks';

/* ============================================
   工具栏图标 SVG
   ============================================ */

/** 小数精度图标 */
function DecimalsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="w-4 h-4"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

/** 视图模式切换按钮组件 */
interface ViewModeButtonProps {
  mode: ViewMode;
  active: boolean;
  onClick: () => void;
  title: string;
}

/** 纯 CSS 实现的视图模式按钮 */
function ViewModeButton({ mode, active, onClick, title }: ViewModeButtonProps) {
  // 未选中时颜色降低透明度，但保留红绿色调
  const askColor = active ? COLORS.askRed : 'rgba(246, 70, 93, 0.35)';
  const bidColor = active ? COLORS.bidGreen : 'rgba(14, 203, 129, 0.35)';

  return (
    <button
      onClick={onClick}
      className={`w-6 h-6 rounded flex flex-col items-center justify-center gap-0.5 p-1 transition-colors ${
        active ? 'bg-[#2b2f36]' : 'hover:bg-white/5'
      }`}
      title={title}
    >
      {mode === 'both' && (
        <>
          {/* 上方红条 */}
          <div
            className="w-full h-1.5 rounded-sm"
            style={{ backgroundColor: askColor }}
          />
          {/* 下方绿条 */}
          <div
            className="w-full h-1.5 rounded-sm"
            style={{ backgroundColor: bidColor }}
          />
        </>
      )}
      {mode === 'bids' && (
        /* 绿色方块 */
        <div
          className="w-full h-full rounded-sm"
          style={{ backgroundColor: bidColor }}
        />
      )}
      {mode === 'asks' && (
        /* 红色方块 */
        <div
          className="w-full h-full rounded-sm"
          style={{ backgroundColor: askColor }}
        />
      )}
    </button>
  );
}

/* ============================================
   OrderRow 子组件
   ============================================ */

interface OrderRowProps {
  /** 价格 */
  price: number;
  /** 数量 */
  amount: number;
  /** 累计总量（用于深度条宽度） */
  cumulativeVolume: number;
  /** 最大累计量 */
  maxVolume: number;
  /** 订单类型 */
  type: 'bid' | 'ask';
  /** 价格精度 */
  pricePrecision: number;
}

/**
 * 订单行子组件
 * Binance 风格：3 列网格 + 深度背景条
 */
function OrderRow({
  price,
  amount,
  cumulativeVolume,
  maxVolume,
  type,
  pricePrecision,
}: OrderRowProps) {
  const isBid = type === 'bid';
  const depthPercent = Math.min((cumulativeVolume / maxVolume) * 100, 100);
  const total = price * amount;

  return (
    <div className="relative h-[18px] md:h-5 grid grid-cols-[1fr_1fr_1fr] items-center px-1.5 md:px-2 hover:bg-white/5 cursor-pointer group">
      {/* 深度背景条 */}
      <div
        className="absolute top-0.5 bottom-0.5 right-0 pointer-events-none"
        style={{
          width: `${depthPercent}%`,
          backgroundColor: isBid ? COLORS.bidGreen : COLORS.askRed,
          opacity: 0.12,
        }}
      />

      {/* 价格列 - 左对齐 */}
      <span
        className="relative z-10 font-mono text-[10px] md:text-[11px] tabular-nums text-left"
        style={{ color: isBid ? COLORS.bidGreen : COLORS.askRed }}
      >
        {price.toFixed(pricePrecision)}
      </span>

      {/* 数量列 - 右对齐 */}
      <span
        className="relative z-10 font-mono text-[10px] md:text-[11px] tabular-nums text-right"
        style={{ color: COLORS.textGray }}
      >
        {amount.toFixed(5)}
      </span>

      {/* 总量列 - 右对齐，移动端隐藏 */}
      <span
        className="relative z-10 font-mono text-[10px] md:text-[11px] tabular-nums text-right hidden lg:block"
        style={{ color: COLORS.textGray }}
      >
        {total.toFixed(2)}
      </span>
    </div>
  );
}

/* ============================================
   OrderBook 主组件
   ============================================ */

/** 小数精度选项 */
const PRECISION_OPTIONS = [0.01, 0.1, 1, 10] as const;

/** 订单簿显示行数配置 */
const VISIBLE_ROWS_MOBILE = 5;
const VISIBLE_ROWS_DESKTOP = 50;

/**
 * 自定义 Hook: 检测是否为移动端视口
 * 断点: 768px (md breakpoint)
 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // 初始化检测
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();

    // 监听窗口大小变化
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

function OrderBook({
  bids = [],
  asks = [],
  price,
  priceTrend = 'neutral',
}: OrderBookProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [precisionIndex, setPrecisionIndex] = useState(0);
  const isMobile = useIsMobile();
  const asksContainerRef = useRef<HTMLDivElement>(null);

  // 响应式行数：移动端 5 行，桌面端 50 行
  const visibleRows = isMobile ? VISIBLE_ROWS_MOBILE : VISIBLE_ROWS_DESKTOP;

  const pricePrecision =
    PRECISION_OPTIONS[precisionIndex] === 0.01
      ? 2
      : PRECISION_OPTIONS[precisionIndex] === 0.1
      ? 1
      : 0;

  /**
   * 计算累计量和最大累计量
   * 响应式：移动端显示 5 行，桌面端显示 50 行
   */
  const { processedBids, processedAsks, maxCumulativeVolume } = useMemo(() => {
    // 处理买单（降序，累计从上到下）
    let bidCumulative = 0;
    const processedBids = bids.slice(0, visibleRows).map(([p, q]) => {
      bidCumulative += q;
      return { price: p, amount: q, cumulative: bidCumulative };
    });

    // 处理卖单：升序取数据，累计从低价开始，然后 reverse 用于显示（高价在上）
    const asksSlice = asks.slice(0, visibleRows);
    let askCumulative = 0;
    const processedAsks = asksSlice
      .map(([p, q]) => {
        askCumulative += q;
        return { price: p, amount: q, cumulative: askCumulative };
      })
      .reverse(); // 反转后：高价在上，低价在下（靠近 spread）

    const maxCumulative = Math.max(bidCumulative, askCumulative, 1);

    return {
      processedBids,
      processedAsks,
      maxCumulativeVolume: maxCumulative,
    };
  }, [bids, asks, visibleRows]);

  // 卖单区域自动滚动到底部
  useEffect(() => {
    if (asksContainerRef.current) {
      asksContainerRef.current.scrollTop = asksContainerRef.current.scrollHeight;
    }
  }, [processedAsks]);

  /**
   * 获取价格趋势颜色
   */
  const priceColor = useMemo(() => {
    if (priceTrend === 'up') return COLORS.bidGreen;
    if (priceTrend === 'down') return COLORS.askRed;
    return '#ffffff';
  }, [priceTrend]);

  /**
   * 切换小数精度
   */
  const cyclePrecision = () => {
    setPrecisionIndex((prev) => (prev + 1) % PRECISION_OPTIONS.length);
  };

  return (
    <div className="bg-terminal-bg flex flex-col h-full overflow-hidden">
      {/* ========== 工具栏 ========== */}
      <div className="shrink-0 h-8 md:h-9 px-2 md:px-3 flex items-center justify-between border-b border-[#2b2f36]">
        {/* 小数精度选择器 */}
        <button
          onClick={cyclePrecision}
          className="flex items-center gap-1 md:gap-1.5 text-[10px] md:text-[11px] font-mono text-gray-400 hover:text-white transition-colors px-1.5 md:px-2 py-1 rounded hover:bg-white/5"
        >
          <DecimalsIcon />
          <span>{PRECISION_OPTIONS[precisionIndex].toFixed(2)}</span>
          <svg
            viewBox="0 0 12 12"
            className="w-2.5 h-2.5 md:w-3 md:h-3 opacity-50"
          >
            <path
              d="M3 5l3 3 3-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </button>

        {/* 视图模式切换 */}
        <div className="flex items-center gap-0.5">
          <ViewModeButton
            mode="both"
            active={viewMode === 'both'}
            onClick={() => setViewMode('both')}
            title="显示买卖双方"
          />
          <ViewModeButton
            mode="bids"
            active={viewMode === 'bids'}
            onClick={() => setViewMode('bids')}
            title="仅显示买单"
          />
          <ViewModeButton
            mode="asks"
            active={viewMode === 'asks'}
            onClick={() => setViewMode('asks')}
            title="仅显示卖单"
          />
        </div>
      </div>

      {/* ========== 表头 ========== */}
      <div className="shrink-0 h-5 md:h-6 grid grid-cols-[1fr_1fr_1fr] px-2 items-center text-[9px] md:text-[10px] text-gray-500 border-b border-[#2b2f36] bg-[#0d0d0d]">
        <span className="text-left">Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right hidden lg:block">Total</span>
      </div>

      {/* ========== 卖单区域 ========== */}
      {/* 移动端固定高度 (5行 x 18px = 90px)，桌面端 flex-1 */}
      {/* 双层结构：外层滚动容器 + 内层底部对齐，与买单区域滚动行为一致 */}
      {(viewMode === 'both' || viewMode === 'asks') && (
        <div ref={asksContainerRef} className="h-[90px] md:flex-1 md:h-auto overflow-y-auto min-h-0">
          <div className="flex flex-col justify-end min-h-full">
            {processedAsks.map((ask, idx) => (
              <OrderRow
                key={`ask-${idx}`}
                price={ask.price}
                amount={ask.amount}
                cumulativeVolume={ask.cumulative}
                maxVolume={maxCumulativeVolume}
                type="ask"
                pricePrecision={pricePrecision}
              />
            ))}
          </div>
        </div>
      )}

      {/* ========== 中间价格 Ticker (Sticky) ========== */}
      <div className="shrink-0 h-8 md:h-10 px-2 md:px-3 bg-[#131722] flex items-center gap-1.5 md:gap-2 border-y border-[#2b2f36]">
        {/* 当前价格 - 使用 clamp 流体字体 */}
        <span
          className="font-mono text-[clamp(14px,4vw,18px)] md:text-lg font-semibold tabular-nums flex items-center gap-1"
          style={{ color: priceColor }}
        >
          {price?.toFixed(2) ?? '-.--'}
          {priceTrend === 'up' && (
            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 md:w-3 md:h-3">
              <path d="M6 2l4 8H2z" fill={COLORS.bidGreen} />
            </svg>
          )}
          {priceTrend === 'down' && (
            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 md:w-3 md:h-3">
              <path d="M6 10l4-8H2z" fill={COLORS.askRed} />
            </svg>
          )}
        </span>
        {/* 美元等值 */}
        <span className="font-mono text-[10px] md:text-xs text-gray-500 tabular-nums">
          ≈ $
          {price?.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) ?? '-.--'}
        </span>
      </div>

      {/* ========== 买单区域 ========== */}
      {/* 移动端固定高度 (5行 x 18px = 90px)，桌面端 flex-1 */}
      {(viewMode === 'both' || viewMode === 'bids') && (
        <div className="h-[90px] md:flex-1 md:h-auto overflow-y-auto min-h-0">
          {processedBids.map((bid, idx) => (
            <OrderRow
              key={`bid-${idx}`}
              price={bid.price}
              amount={bid.amount}
              cumulativeVolume={bid.cumulative}
              maxVolume={maxCumulativeVolume}
              type="bid"
              pricePrecision={pricePrecision}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(OrderBook);
