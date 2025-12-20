import { memo, useState } from 'react';

/* ============================================
   Props Interface
   ============================================ */

export interface MobileTradebarProps {
  /** 当前市场价格 */
  currentPrice?: number;
  /** 买入回调 */
  onBuy?: () => void;
  /** 卖出回调 */
  onSell?: () => void;
}

/* ============================================
   Constants
   ============================================ */

const COLORS = {
  buyGreen: '#0ECB81',
  sellRed: '#F6465D',
} as const;

/** 快捷下单金额滑动范围 */
const MIN_AMOUNT = 100;
const MAX_AMOUNT = 1000;
const STEP_AMOUNT = 50;

/* ============================================
   MobileTradebar Component
   ============================================ */

/**
 * 移动端底部 Sticky 交易栏
 *
 * 仅在移动端 (<1280px) 显示，提供快捷下单功能
 * - 当前价格显示
 * - 快捷金额选择
 * - Buy/Sell 按钮 (min-height 44px 满足触控要求)
 */
function MobileTradebar({
  currentPrice = 40000,
  onBuy,
  onSell,
}: MobileTradebarProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(100);
  const percentage =
    ((selectedAmount - MIN_AMOUNT) / (MAX_AMOUNT - MIN_AMOUNT)) * 100;

  return (
    <div
      className="
        fixed bottom-0 left-0 right-0 z-50
        xl:hidden
        bg-[#0b0e11] border-t border-[#2b2f36]
        px-3 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]
      "
    >
      {/* 上排：价格 + 金额滑动选择 */}
      <div className="flex items-center gap-3 mb-2">
        {/* 当前价格 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-gray-500">Price</span>
          <span className="text-sm font-mono font-semibold text-white tabular-nums">
            $
            {currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* 滑动条 */}
        <div className="flex-1">
          <div className="relative h-2 group">
            <div className="absolute inset-0 rounded-full bg-[#2b2f36]" />
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-all duration-75"
              style={{
                width: `${percentage}%`,
                background: 'linear-gradient(90deg, #FCD535 0%, #F0B90B 100%)',
                boxShadow: '0 0 8px rgba(252, 213, 53, 0.4)',
              }}
            />
            <input
              type="range"
              min={MIN_AMOUNT}
              max={MAX_AMOUNT}
              step={STEP_AMOUNT}
              value={selectedAmount}
              onChange={(e) => setSelectedAmount(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#FCD535] border-2 border-[#0b0e11] shadow-lg transition-all duration-75 pointer-events-none"
              style={{
                left: `calc(${percentage}% - 8px)`,
                boxShadow: '0 0 12px rgba(252, 213, 53, 0.6)',
              }}
            />
          </div>
          <div className="flex justify-between mt-0.5 text-[10px] text-gray-500 font-mono">
            <span>${MIN_AMOUNT}</span>
            <span>${(MIN_AMOUNT + MAX_AMOUNT) / 2}</span>
            <span>${MAX_AMOUNT}</span>
          </div>
        </div>

        {/* 当前选择金额气泡 */}
        <div className="shrink-0 px-2 py-1 rounded bg-[#1e2026] border border-[#2b2f36] text-[10px] font-mono text-gray-300">
          ${selectedAmount}
        </div>
      </div>

      {/* 下排：Buy / Sell 按钮 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onBuy}
          className="
            h-11 min-h-[44px] rounded-lg
            font-semibold text-sm text-white
            transition-all active:scale-[0.98]
          "
          style={{
            backgroundColor: COLORS.buyGreen,
            boxShadow: `0 2px 8px ${COLORS.buyGreen}40`,
          }}
        >
          Buy / Long
        </button>
        <button
          onClick={onSell}
          className="
            h-11 min-h-[44px] rounded-lg
            font-semibold text-sm text-white
            transition-all active:scale-[0.98]
          "
          style={{
            backgroundColor: COLORS.sellRed,
            boxShadow: `0 2px 8px ${COLORS.sellRed}40`,
          }}
        >
          Sell / Short
        </button>
      </div>
    </div>
  );
}

export default memo(MobileTradebar);
