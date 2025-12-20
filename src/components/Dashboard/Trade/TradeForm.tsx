import { memo, useState, useCallback, useMemo } from 'react';
import LeverageSlider from './LeverageSlider';
import WasmPositionCard, { EmptyPositionState } from './PositionCard';
import { useToast } from '../../Toast';
import type {
  Position,
  LiquidationResult,
  OpenPositionResult,
} from '../../../types/trading';

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

/* ============================================
   Props Interface
   ============================================ */

export interface TradeFormProps {
  /** Trading pair symbol */
  symbol?: string;
  /** Current market price */
  currentPrice?: number;

  // ========== Wasm Trading State (from useTradingState) ==========

  /** 钱包余额 (来自 Wasm) */
  balance?: number;
  /** 可用余额 (来自 Wasm) */
  availableBalance?: number;
  /** 当前杠杆 (来自 Wasm) */
  currentLeverage?: number;
  /** 当前仓位 (来自 Wasm，单仓位模式) */
  position?: Position | null;
  /** 风险评估 (来自 Wasm) */
  riskAssessment?: LiquidationResult | null;
  /** 是否有持仓 */
  hasPosition?: boolean;

  // ========== Wasm Actions ==========

  /** 开仓回调 (调用 Wasm placeOrder) */
  onPlaceOrder?: (
    side: 'LONG' | 'SHORT',
    size: number,
    leverage: number,
  ) => OpenPositionResult | null;
  /** 平仓回调 (调用 Wasm closePosition) */
  onClosePosition?: () => void;
  /** 设置杠杆回调 */
  onSetLeverage?: (leverage: number) => boolean;
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

/* ============================================
   Main Component
   ============================================ */

/**
 * TradeForm Component
 *
 * 🧠 Brain Transplant: 交易逻辑已迁移至 Rust Wasm
 * - 余额验证: Wasm 内部处理
 * - 保证金计算: Wasm 内部处理
 * - 开仓验证: Wasm 返回 OpenPositionResult
 */
function TradeForm({
  symbol = 'BTC',
  currentPrice = 40000,
  balance = 10000,
  availableBalance = 10000,
  currentLeverage = 10,
  position = null,
  riskAssessment = null,
  hasPosition = false,
  onPlaceOrder,
  onClosePosition,
  onSetLeverage,
}: TradeFormProps) {
  // Toast
  const toast = useToast();

  // Form State (UI only)
  const [orderType, setOrderType] = useState<OrderType>('Market');
  const [leverage, setLeverage] = useState(currentLeverage);
  const [price, setPrice] = useState(currentPrice.toFixed(2));
  const [size, setSize] = useState('');
  const [sizePercent, setSizePercent] = useState<number | null>(null);

  // Derived values (简化计算，仅用于 UI 展示)
  const sizeValue = parseFloat(size) || 0;
  const priceValue = parseFloat(price) || currentPrice;
  const estimatedCost = (sizeValue * priceValue) / leverage;
  const maxSize = (availableBalance * leverage) / priceValue;

  // 🔴 按钮禁用状态：简化验证，详细验证由 Wasm 处理
  const isSubmitDisabled = useMemo(() => {
    // 已有持仓时禁用开仓（单仓位模式）
    if (hasPosition) return true;
    // 数量为 0
    if (sizeValue <= 0) return true;
    // 估算保证金不足
    if (estimatedCost > availableBalance) return true;
    return false;
  }, [hasPosition, sizeValue, estimatedCost, availableBalance]);

  // 🔴 杠杆变更 Handler - 调用 Wasm
  const handleLeverageChange = useCallback(
    (newLeverage: number) => {
      setLeverage(newLeverage);
      // 调用 Wasm 设置杠杆（如果提供了回调）
      if (onSetLeverage) {
        const success = onSetLeverage(newLeverage);
        if (!success && hasPosition) {
          // 如果失败（持仓中），恢复原值
          setLeverage(currentLeverage);
        }
      }
    },
    [onSetLeverage, hasPosition, currentLeverage],
  );

  // Size Preset Handler
  const handleSizePreset = useCallback(
    (percent: number) => {
      setSizePercent(percent);
      const newSize = ((maxSize * percent) / 100).toFixed(6);
      setSize(newSize);
    },
    [maxSize],
  );

  // 🔴 开仓 Handler - 调用 Wasm placeOrder
  const handleSubmit = useCallback(
    (side: 'LONG' | 'SHORT') => {
      // 基础验证
      if (sizeValue <= 0) {
        toast.warning('请输入下单数量');
        return;
      }
      if (hasPosition) {
        toast.warning('已有持仓，请先平仓');
        return;
      }

      // 🔴 调用 Wasm 开仓，验证由 Wasm 处理
      const result = onPlaceOrder?.(side, sizeValue, leverage);

      if (result) {
        if (result.success) {
          // 清空表单
          setSize('');
          setSizePercent(null);
        }
        // Toast 由 useTradingState hook 的事件处理器触发
      }
    },
    [onPlaceOrder, sizeValue, leverage, hasPosition, toast],
  );

  return (
    <div className="h-full flex flex-col bg-[#0b0e11]">
      {/* ========== Header: Balance Display ========== */}
      <div className="shrink-0 h-11 px-4 flex items-center justify-between border-b border-[#2b2f36]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Balance</span>
          <span className="text-xs font-mono font-medium text-white">
            {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <span className="text-gray-500 ml-1">USDT</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Avail</span>
          <span className="text-xs font-mono font-medium text-[#0ECB81]">
            {availableBalance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      {/* ========== Main Content ========== */}
      <div className="flex-1 min-h-0 flex flex-col px-4 py-4 gap-4">
        {/* Leverage Slider - 🔴 调用 Wasm 设置杠杆 */}
        <div className="shrink-0">
          <LeverageSlider
            value={leverage}
            onChange={handleLeverageChange}
            disabled={hasPosition}
          />
          {hasPosition && (
            <span className="text-[10px] text-gray-600 mt-1 block">
              持仓期间无法修改杠杆
            </span>
          )}
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

        {/* Action Buttons - 🔴 调用 Wasm placeOrder */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <button
            onClick={() => handleSubmit('LONG')}
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
            onClick={() => handleSubmit('SHORT')}
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
            <span className="text-gray-500">Est. Cost</span>
            <span className="text-gray-300">
              {estimatedCost.toFixed(2)}{' '}
              <span className="text-gray-500">USDT</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Max Size</span>
            <span className="text-gray-300">
              {maxSize.toFixed(6)}{' '}
              <span className="text-gray-500">{symbol}</span>
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#2b2f36] shrink-0" />

        {/* ========== Position Display (单仓位模式) ========== */}
        <div className="flex-1 min-h-[120px] flex flex-col">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">Position</span>
              {hasPosition && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[#0ECB81]/20 text-[#0ECB81]">
                  ACTIVE
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-500 font-mono">
              {leverage}x Leverage
            </span>
          </div>

          {/* 🔴 Wasm Position Display */}
          {position ? (
            <WasmPositionCard
              position={position}
              riskAssessment={riskAssessment}
              symbol={symbol}
              currentPrice={currentPrice}
              onClose={onClosePosition}
            />
          ) : (
            <EmptyPositionState />
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(TradeForm);
