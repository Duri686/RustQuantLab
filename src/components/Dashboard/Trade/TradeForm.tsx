import { memo, useState, useCallback, useMemo } from 'react';
import LeverageSlider from './LeverageSlider';
import PositionCard from './PositionCard';
import { useToast } from '../../Toast';
import type { OrderRecord } from '../../../types';

/* ============================================
   Constants
   ============================================ */

/** Order type options */
const ORDER_TYPES = ['Limit', 'Market'] as const;

/** Size percentage presets */
const SIZE_PRESETS = [25, 50, 75, 100] as const;

/** Binance brand colors */
const COLORS = {
  buyGreen: '#0ECB81',
  sellRed: '#F6465D',
  accent: '#FCD535',
} as const;

export type OrderType = (typeof ORDER_TYPES)[number];
export type MarginMode = 'Cross' | 'Isolated';

/* ============================================
   Props Interface
   ============================================ */

export interface TradeFormProps {
  /** Trading pair symbol */
  symbol?: string;
  /** Current market price */
  currentPrice?: number;
  /** Available balance in USDT */
  availableBalance?: number;
  /** 订单记录列表 */
  orders?: OrderRecord[];
  /** Callback when order is submitted */
  onSubmit?: (order: {
    side: 'buy' | 'sell';
    type: OrderType;
    price: number;
    size: number;
    leverage: number;
    marginMode: MarginMode;
  }) => void;
  /** 平仓回调 */
  onCloseOrder?: (orderId: string) => void;
  /** 追加保证金回调（仅逐仓模式） */
  onAddMargin?: (orderId: string, amount: number) => void;
}

/* ============================================
   Sub-Components
   ============================================ */

/** Styled input with label and suffix */
interface TradeInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix: string;
  placeholder?: string;
  disabled?: boolean;
}

function TradeInput({
  label,
  value,
  onChange,
  suffix,
  placeholder = '0.00',
  disabled = false,
}: TradeInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-gray-400">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full h-10 px-3 pr-14 bg-[#1e2026] border border-[#2b2f36] rounded text-sm font-mono text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FCD535]/50 transition-colors disabled:opacity-50"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-mono">
          {suffix}
        </span>
      </div>
    </div>
  );
}

/** Margin mode toggle button */
interface MarginToggleProps {
  mode: MarginMode;
  onChange: (mode: MarginMode) => void;
}

function MarginToggle({ mode, onChange }: MarginToggleProps) {
  return (
    <button
      onClick={() => onChange(mode === 'Cross' ? 'Isolated' : 'Cross')}
      className="px-2 py-1 text-[10px] font-medium rounded bg-[#1e2026] border border-[#2b2f36] text-gray-400 hover:text-white hover:border-[#3b3f46] transition-colors"
    >
      {mode}
    </button>
  );
}

/* ============================================
   Main Component
   ============================================ */

/**
 * TradeForm Component
 *
 * Professional order entry panel for Perpetual Futures trading.
 * Features leverage control, order inputs, and Buy/Sell actions.
 */
function TradeForm({
  symbol = 'BTC',
  currentPrice = 40000,
  availableBalance = 100000,
  orders = [],
  onSubmit,
  onCloseOrder,
  onAddMargin,
}: TradeFormProps) {
  // Toast
  const toast = useToast();

  // Form State
  const [orderType, setOrderType] = useState<OrderType>('Limit');
  const [marginMode, setMarginMode] = useState<MarginMode>('Cross');
  const [leverage, setLeverage] = useState(20);
  const [price, setPrice] = useState(currentPrice.toFixed(2));
  const [size, setSize] = useState('');
  const [sizePercent, setSizePercent] = useState<number | null>(null);

  // Derived values
  const sizeValue = parseFloat(size) || 0;
  const priceValue = parseFloat(price) || currentPrice;
  const cost = (sizeValue * priceValue) / leverage;
  const maxSize = (availableBalance * leverage) / priceValue;

  // 按钮禁用状态
  const isSubmitDisabled = useMemo(() => {
    // 余额为 0
    if (availableBalance <= 0) return true;
    // 数量为 0
    if (sizeValue <= 0) return true;
    // Limit 订单价格为 0
    if (orderType === 'Limit' && priceValue <= 0) return true;
    // 保证金不足
    if (cost > availableBalance) return true;
    return false;
  }, [availableBalance, sizeValue, orderType, priceValue, cost]);

  // Handlers
  const handleSizePreset = useCallback(
    (percent: number) => {
      setSizePercent(percent);
      const newSize = ((maxSize * percent) / 100).toFixed(6);
      setSize(newSize);
    },
    [maxSize],
  );

  const handleSubmit = useCallback(
    (side: 'buy' | 'sell') => {
      // 验证
      if (availableBalance <= 0) {
        toast.error('余额不足，无法下单');
        return;
      }
      if (sizeValue <= 0) {
        toast.warning('请输入下单数量');
        return;
      }
      if (orderType === 'Limit' && priceValue <= 0) {
        toast.warning('请输入有效的限价');
        return;
      }
      if (cost > availableBalance) {
        toast.error(`保证金不足，需要 ${cost.toFixed(2)} USDT`);
        return;
      }

      onSubmit?.({
        side,
        type: orderType,
        price: priceValue,
        size: sizeValue,
        leverage,
        marginMode,
      });

      // 下单成功提示
      toast.success(
        `${side === 'buy' ? '做多' : '做空'} ${sizeValue.toFixed(
          4,
        )} ${symbol} @ ${priceValue.toFixed(2)}`,
      );
    },
    [
      onSubmit,
      orderType,
      priceValue,
      sizeValue,
      leverage,
      marginMode,
      availableBalance,
      cost,
      toast,
      symbol,
    ],
  );

  return (
    <div className="h-full flex flex-col bg-[#0b0e11]">
      {/* ========== Header: Balance + Margin Mode ========== */}
      <div className="shrink-0 h-11 px-4 flex items-center justify-between border-b border-[#2b2f36]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Avail</span>
          <span className="text-xs font-mono font-medium text-white">
            {availableBalance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
            <span className="text-gray-500 ml-1">USDT</span>
          </span>
        </div>
        <MarginToggle mode={marginMode} onChange={setMarginMode} />
      </div>

      {/* ========== Main Content ========== */}
      <div className="flex-1 min-h-0 flex flex-col px-4 py-4 gap-4">
        {/* Leverage Slider */}
        <div className="shrink-0">
          <LeverageSlider value={leverage} onChange={setLeverage} />
        </div>

        {/* Divider */}
        <div className="h-px bg-[#2b2f36] shrink-0" />

        {/* Order Type Tabs */}
        <div className="flex rounded bg-[#1e2026] p-0.5 shrink-0">
          {ORDER_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={`
                flex-1 py-2 text-xs font-medium rounded transition-colors
                ${
                  orderType === type
                    ? 'bg-[#2b2f36] text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }
              `}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Price Input (disabled for Market orders) */}
        <div className="shrink-0">
          <TradeInput
            label="Price (USDT)"
            value={orderType === 'Market' ? 'Market Price' : price}
            onChange={setPrice}
            suffix="USDT"
            disabled={orderType === 'Market'}
          />
        </div>

        {/* Size Input */}
        <div className="shrink-0">
          <TradeInput
            label={`Size (${symbol})`}
            value={size}
            onChange={(v) => {
              setSize(v);
              setSizePercent(null);
            }}
            suffix={symbol}
          />
        </div>

        {/* Size Percentage Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {SIZE_PRESETS.map((percent) => (
            <button
              key={percent}
              onClick={() => handleSizePreset(percent)}
              className={`
                flex-1 py-1.5 text-[10px] font-mono rounded transition-colors
                ${
                  sizePercent === percent
                    ? 'bg-[#FCD535]/20 text-[#FCD535] border border-[#FCD535]/50'
                    : 'bg-[#1e2026] text-gray-500 border border-[#2b2f36] hover:text-gray-300'
                }
              `}
            >
              {percent}%
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-[#2b2f36] shrink-0" />

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <button
            onClick={() => handleSubmit('buy')}
            disabled={isSubmitDisabled}
            className={`h-11 rounded font-semibold text-sm transition-all ${
              isSubmitDisabled
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'text-white hover:brightness-110 active:scale-[0.98]'
            }`}
            style={
              isSubmitDisabled
                ? undefined
                : {
                    backgroundColor: COLORS.buyGreen,
                    boxShadow: `0 4px 12px ${COLORS.buyGreen}40`,
                  }
            }
          >
            Buy / Long
          </button>
          <button
            onClick={() => handleSubmit('sell')}
            disabled={isSubmitDisabled}
            className={`h-11 rounded font-semibold text-sm transition-all ${
              isSubmitDisabled
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'text-white hover:brightness-110 active:scale-[0.98]'
            }`}
            style={
              isSubmitDisabled
                ? undefined
                : {
                    backgroundColor: COLORS.sellRed,
                    boxShadow: `0 4px 12px ${COLORS.sellRed}40`,
                  }
            }
          >
            Sell / Short
          </button>
        </div>

        {/* Order Summary */}
        <div className="space-y-1.5 text-[11px] font-mono shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Cost</span>
            <span className="text-gray-300">
              {cost.toFixed(2)} <span className="text-gray-500">USDT</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Max</span>
            <span className="text-gray-300">
              {maxSize.toFixed(6)}{' '}
              <span className="text-gray-500">{symbol}</span>
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#2b2f36] shrink-0" />

        {/* ========== Positions List ========== */}
        <div className="flex-1 min-h-[120px] flex flex-col">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">
                Positions
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#2b2f36] text-gray-400">
                {orders.filter((o) => !o.closed).length}
              </span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">
              Total: {orders.length}
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-full bg-[#1e2026] flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 12H4M12 4v16"
                  />
                </svg>
              </div>
              <span className="text-xs text-gray-600">No open positions</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
              {orders.map((order) => (
                <PositionCard
                  key={order.id}
                  order={order}
                  symbol={symbol}
                  currentPrice={currentPrice}
                  availableBalance={availableBalance}
                  onClose={() => onCloseOrder?.(order.id)}
                  onAddMargin={(amount) => {
                    if (amount > availableBalance) {
                      toast.error('余额不足，无法追加保证金');
                      return;
                    }
                    onAddMargin?.(order.id, amount);
                    toast.success(`追加保证金 ${amount.toFixed(2)} USDT`);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(TradeForm);
