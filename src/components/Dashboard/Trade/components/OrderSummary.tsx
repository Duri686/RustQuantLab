import { memo, useMemo } from 'react';
import { estimateMargin, estimateFee, estimateLiquidationPrice } from '../../../../config/tradingConfig';
import type { OrderType } from './TradeForm';
import type { EstimateLiquidationResult } from '../../../../hooks/tradingState/types';

/* ============================================
   Props Interface
   ============================================ */

export interface OrderSummaryProps {
  /** 下单数量 (BTC) */
  size: number;
  /** 价格 (USDT) — 市价单用 currentPrice，限价单用 limitPrice */
  price: number;
  /** 杠杆倍数 */
  leverage: number;
  /** 订单类型 */
  orderType: OrderType;
  /** 可用余额 (USDT) */
  availableBalance: number;
  /** 交易对 symbol (如 BTC) */
  symbol: string;
  /** Wasm 引擎预估强平价格 (可选，无则用 JS 近似) */
  onEstimateLiquidation?: (
    side: 'LONG' | 'SHORT',
    size: number,
    leverage: number,
    marginMode: string,
  ) => EstimateLiquidationResult | null;
  /** 保证金模式 */
  marginMode?: string;
}

/* ============================================
   Component
   ============================================ */

/**
 * OrderSummary — 订单预览面板
 *
 * 显示 Est. Cost / Max Size / Est. Margin / Est. Liq. Price / Fee
 * 当 Margin 接近或超出可用余额时高亮警告
 */
function OrderSummary({
  size,
  price,
  leverage,
  orderType,
  availableBalance,
  symbol,
  onEstimateLiquidation,
  marginMode = 'cross',
}: OrderSummaryProps) {
  const maxSize = leverage > 0 ? (availableBalance * leverage) / price : 0;
  const estCost = leverage > 0 ? (size * price) / leverage : 0;

  const { margin, fee, liqLong, liqShort } = useMemo(() => {
    const m = estimateMargin(size, price, leverage);
    const feeType = orderType === 'Market' ? 'market' : 'limit';
    const f = estimateFee(size, price, feeType);

    // 优先使用 Wasm 引擎计算爆仓价，fallback 到 JS 近似
    let ll = 0;
    let ls = 0;
    if (size > 0) {
      const wasmLong = onEstimateLiquidation?.('LONG', size, leverage, marginMode);
      const wasmShort = onEstimateLiquidation?.('SHORT', size, leverage, marginMode);
      ll = wasmLong?.liquidationPrice ?? estimateLiquidationPrice(price, leverage, 'LONG');
      ls = wasmShort?.liquidationPrice ?? estimateLiquidationPrice(price, leverage, 'SHORT');
    }
    return { margin: m, fee: f, liqLong: ll, liqShort: ls };
  }, [size, price, leverage, orderType, onEstimateLiquidation, marginMode]);

  // 保证金 vs 余额的颜色
  const marginColorClass = useMemo(() => {
    if (margin <= 0) return 'text-gray-300';
    if (margin > availableBalance) return 'text-danger';
    if (margin > availableBalance * 0.8) return 'text-warning';
    return 'text-gray-300';
  }, [margin, availableBalance]);

  const feeLabel = orderType === 'Market' ? 'Fee (Taker)' : 'Fee (Maker)';

  return (
    <div className="space-y-1.5 text-[11px] font-mono shrink-0">
      {/* Est. Cost */}
      <Row label="Est. Cost" value={`${estCost.toFixed(2)}`} suffix="USDT" />

      {/* Max Size */}
      <Row label="Max Size" value={`${maxSize.toFixed(6)}`} suffix={symbol} />

      {/* Est. Margin */}
      {size > 0 && (
        <Row
          label="Est. Margin"
          value={`≈ ${margin.toFixed(2)}`}
          suffix="USDT"
          valueClass={marginColorClass}
        />
      )}

      {/* Est. Liq. Price (Long / Short) */}
      {size > 0 && (
        <>
          <Row
            label="Liq. (Long)"
            value={`≈ ${liqLong.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            valueClass="text-gray-300"
          />
          <Row
            label="Liq. (Short)"
            value={`≈ ${liqShort.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            valueClass="text-gray-300"
          />
        </>
      )}

      {/* Fee */}
      {size > 0 && (
        <Row
          label={feeLabel}
          value={`≈ ${fee.toFixed(2)}`}
          suffix="USDT"
          valueClass="text-gray-300"
        />
      )}
    </div>
  );
}

/* ============================================
   Sub-Component: Row
   ============================================ */

function Row({
  label,
  value,
  suffix,
  valueClass = 'text-gray-300',
}: {
  label: string;
  value: string;
  suffix?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={valueClass}>
        {value}
        {suffix && <span className="text-gray-500 ml-1">{suffix}</span>}
      </span>
    </div>
  );
}

export default memo(OrderSummary);
