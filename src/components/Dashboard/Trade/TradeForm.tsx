import { memo, useState, useCallback, useMemo } from 'react';
import LeverageSlider from './LeverageSlider';
import WasmPositionCard, { EmptyPositionState } from './PositionCard';
import { useToast } from '../../Toast';
import type {
  Position,
  LiquidationResult,
  OpenPositionResult,
  MarginMode,
  OrderType as OrderTypeEnum,
  PendingOrder,
} from '../../../types/trading';

/* ============================================
   Constants
   ============================================ */

/** Order type options */
const ORDER_TYPES = ['Limit', 'Market'] as const;

/** Size percentage presets */
const SIZE_PRESETS = [25, 50, 75, 100] as const;

// 使用 CSS 变量，移除硬编码颜色常量

/** 保证金模式选项 */
const MARGIN_MODES: { value: MarginMode; label: string; desc: string }[] = [
  { value: 'cross', label: '全仓', desc: '共享保证金' },
  { value: 'isolated', label: '逐仓', desc: '独立保证金' },
];

export type OrderType = (typeof ORDER_TYPES)[number];

/* ============================================
   Props Interface
   ============================================ */

export interface TradeFormProps {
  /** Trading pair symbol */
  symbol?: string;
  /** Current market price */
  currentPrice?: number;

  // ========== Wasm Trading State (from useWasmEngine) ==========

  /** 钱包余额 (来自 Wasm) */
  balance?: number;
  /** 可用余额 (来自 Wasm) */
  availableBalance?: number;
  /** 当前杠杆 (来自 Wasm) */
  currentLeverage?: number;
  /** 当前仓位 (来自 Wasm) */
  position?: Position | null;
  /** 所有活跃仓位 (多仓位模式) */
  positions?: Position[];
  /** 已平仓仓位历史 */
  closedPositions?: Position[];
  /** 风险评估 (来自 Wasm) */
  riskAssessment?: LiquidationResult | null;
  /** 是否有持仓 */
  hasPosition?: boolean;
  /** 当前保证金模式 */
  marginMode?: MarginMode;

  // ========== Wasm Actions ==========

  /** 开仓回调 (调用 Wasm placeOrder，支持市价单和限价单) */
  onPlaceOrder?: (
    side: 'LONG' | 'SHORT',
    size: number,
    leverage: number,
    marginMode?: MarginMode,
    orderType?: OrderTypeEnum,
    price?: number,
    currentPrice?: number,
  ) => OpenPositionResult | null;
  /** 平仓回调 (调用 Wasm closePosition) */
  onClosePosition?: (symbol?: string) => void;
  /** 设置杠杆回调 */
  onSetLeverage?: (leverage: number) => boolean;
  /** 设置保证金模式回调 */
  onSetMarginMode?: (mode: MarginMode) => void;
  /** 活跃挂单列表 */
  pendingOrders?: PendingOrder[];
  /** 取消挂单回调 */
  onCancelOrder?: (orderId: string) => void;
  /** 增加保证金回调 (逐仓模式) */
  onAddMargin?: (positionId: string, amount: number) => void;
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
          className="w-full h-10 px-3 pr-14 bg-bg-surface border border-border-dark rounded text-sm font-mono text-white placeholder:text-gray-600 focus:outline-none focus:border-warning/50 transition-colors disabled:opacity-50"
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
  position: _position = null, // 单仓位场景，使用 positions 替代
  positions = [],
  closedPositions = [],
  riskAssessment = null,
  hasPosition = false,
  marginMode: propMarginMode = 'cross',
  onPlaceOrder,
  onClosePosition,
  onSetLeverage,
  onSetMarginMode,
  pendingOrders = [],
  onCancelOrder,
  onAddMargin,
}: TradeFormProps) {
  // Toast
  const toast = useToast();

  // Form State (UI only)
  const [orderType, setOrderType] = useState<OrderType>('Market');
  const [leverage, setLeverage] = useState(currentLeverage);
  const [price, setPrice] = useState(currentPrice.toFixed(2));
  const [size, setSize] = useState('');
  const [sizePercent, setSizePercent] = useState<number | null>(null);
  const [marginMode, setMarginMode] = useState<MarginMode>(propMarginMode);

  // 当前交易对的仓位 (用于 UI 提示)
  const currentSymbolPosition = positions.find(
    (p) => p.symbol === `${symbol}USDT`,
  );

  // Derived values (简化计算，仅用于 UI 展示)
  const sizeValue = parseFloat(size) || 0;
  const priceValue = parseFloat(price) || currentPrice;
  const estimatedCost = (sizeValue * priceValue) / leverage;
  const maxSize = (availableBalance * leverage) / priceValue;

  // 🔴 按钮禁用状态：简化验证，详细验证由 Wasm 处理
  // One-Way Mode: 同交易对同方向可合并，反方向可减仓，所以不应禁用
  const isSubmitDisabled = useMemo(() => {
    // 数量为 0
    if (sizeValue <= 0) return true;
    // 估算保证金不足 (加仓时需要额外保证金)
    if (estimatedCost > availableBalance) return true;
    return false;
  }, [sizeValue, estimatedCost, availableBalance]);

  // 🔴 保证金模式变更 Handler
  const handleMarginModeChange = useCallback(
    (mode: MarginMode) => {
      setMarginMode(mode);
      onSetMarginMode?.(mode);
    },
    [onSetMarginMode],
  );

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

  // 🔴 开仓 Handler - 调用 Wasm placeOrder (支持市价单和限价单)
  const handleSubmit = useCallback(
    (side: 'LONG' | 'SHORT') => {
      // 基础验证
      if (sizeValue <= 0) {
        toast.warning('请输入下单数量');
        return;
      }

      // 限价单验证
      if (orderType === 'Limit') {
        if (priceValue <= 0) {
          toast.warning('限价单必须指定价格');
          return;
        }
      }
      // One-Way Mode: 允许同交易对同方向加仓/反方向减仓
      // 详细验证由 Wasm 处理

      // 转换订单类型为 Rust 格式 (lowercase)
      const orderTypeForWasm: OrderTypeEnum =
        orderType === 'Limit' ? 'limit' : 'market';
      const priceForWasm = orderType === 'Limit' ? priceValue : undefined;

      // 🔴 调用 Wasm 开仓，验证由 Wasm 处理
      const result = onPlaceOrder?.(
        side,
        sizeValue,
        leverage,
        marginMode,
        orderTypeForWasm,
        priceForWasm,
        currentPrice, // 传递当前市场价格用于确定触发方向
      );

      if (result) {
        if (result.success) {
          // 清空表单
          setSize('');
          setSizePercent(null);
        }
        // Toast 由 useWasmEngine hook 的事件处理器触发
      }
    },
    [
      onPlaceOrder,
      sizeValue,
      leverage,
      marginMode,
      orderType,
      priceValue,
      toast,
    ],
  );

  return (
    <div className="h-full flex flex-col bg-bg-dark">
      {/* ========== Header: Balance Display ========== */}
      <div className="shrink-0 h-11 px-4 flex items-center justify-between border-b border-border-dark">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Balance</span>
          <span className="text-xs font-mono font-medium text-white">
            {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <span className="text-gray-500 ml-1">USDT</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Avail</span>
          <span className="text-xs font-mono font-medium text-success">
            {availableBalance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>

      {/* ========== Main Content ========== */}
      <div className="flex-1 min-h-0 flex flex-col px-4 py-3 gap-3">
        {/* Leverage Slider - 🔴 全仓模式可调整杠杆 */}
        <div className="shrink-0">
          <LeverageSlider
            value={leverage}
            onChange={handleLeverageChange}
            disabled={marginMode === 'isolated' && hasPosition}
          />
          {marginMode === 'isolated' && hasPosition && (
            <span className="text-[10px] text-gray-600 mt-1 block">
              逐仓模式持仓期间无法修改杠杆
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-border-dark shrink-0" />

        {/* 🔴 保证金模式切换 (Cross/Isolated) - 新订单默认模式 */}
        <div className="shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-gray-400">保证金模式</label>
            <span className="text-[10px] text-gray-600">
              {marginMode === 'cross' ? '全仓: 共享余额' : '逐仓: 独立保证金'}
            </span>
          </div>
          <div className="flex rounded bg-bg-surface p-0.5">
            {MARGIN_MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => handleMarginModeChange(mode.value)}
                className={`
                  flex-1 py-2 text-xs font-medium rounded transition-colors
                  ${
                    marginMode === mode.value
                      ? mode.value === 'cross'
                        ? 'bg-success/20 text-success border border-success/30'
                        : 'bg-warning/20 text-warning border border-warning/30'
                      : 'text-gray-500 hover:text-gray-300 border border-transparent'
                  }
                `}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border-dark shrink-0" />

        {/* Order Type Tabs */}
        <div className="flex rounded bg-bg-surface p-0.5 shrink-0">
          {ORDER_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={`
                flex-1 py-2 text-xs font-medium rounded transition-colors
                ${
                  orderType === type
                    ? 'bg-border-dark text-white'
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
                    ? 'bg-warning/20 text-warning border border-warning/50'
                    : 'bg-bg-surface text-gray-500 border border-border-dark hover:text-gray-300'
                }
              `}
            >
              {percent}%
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-border-dark shrink-0" />

        {/* 当前仓位提示 */}
        {currentSymbolPosition && (
          <div className="flex items-center gap-2 text-[10px] shrink-0 -mt-2">
            <span className="text-gray-500">当前持仓:</span>
            <span
              className={
                currentSymbolPosition.side === 'Long'
                  ? 'text-success'
                  : 'text-danger'
              }
            >
              {currentSymbolPosition.side === 'Long' ? '多' : '空'}{' '}
              {currentSymbolPosition.size.toFixed(4)} {symbol}
            </span>
            <span className="text-gray-600">· 同方向加仓</span>
          </div>
        )}

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
                    backgroundColor: 'var(--color-success)',
                    boxShadow: '0 4px 12px color-mix(in srgb, var(--color-success) 25%, transparent)',
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
                    backgroundColor: 'var(--color-danger)',
                    boxShadow: '0 4px 12px color-mix(in srgb, var(--color-danger) 25%, transparent)',
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
        <div className="h-px bg-border-dark shrink-0" />

        {/* ========== Position Display (多仓位模式) ========== */}
        <div className="flex-1 min-h-[120px] flex flex-col">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white">
                Positions
              </span>
              {positions.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-success/20 text-success">
                  {positions.length} ACTIVE
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-500 font-mono">
              {marginMode === 'cross' ? '全仓' : '逐仓'} · {leverage}x
            </span>
          </div>

          {/* 🔴 Wasm Position Display - Hedge Mode 多仓位列表 */}
          {positions.length > 0 ||
          closedPositions.length > 0 ||
          pendingOrders.length > 0 ? (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {/* 🔴 挂单列表 (限价单) */}
              {pendingOrders.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pb-1">
                    <span className="text-[10px] text-warning">挂单</span>
                    <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-warning/20 text-warning">
                      {pendingOrders.length}
                    </span>
                    <div className="flex-1 h-px bg-border-dark" />
                  </div>
                  {pendingOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-2 rounded bg-bg-surface border-l-2 border-warning"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400">{order.symbol}</span>
                          <span
                            className={
                              order.side === 'Long'
                                ? 'text-success'
                                : 'text-danger'
                            }
                          >
                            {order.side === 'Long' ? '多' : '空'}
                          </span>
                          <span className="text-gray-500">
                            {order.leverage}x
                          </span>
                          <span className="px-1 rounded text-[9px] bg-warning/20 text-warning">
                            {order.triggerDirection === 'above'
                              ? '等涨'
                              : '等跌'}
                          </span>
                        </div>
                        <button
                          onClick={() => onCancelOrder?.(order.id)}
                          className="px-1.5 py-0.5 text-[9px] rounded bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white transition-colors"
                        >
                          取消
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-gray-500 mt-1">
                        <span>
                          {order.size.toFixed(4)}{' '}
                          {order.symbol.replace('USDT', '')} @{' '}
                          {order.limitPrice.toFixed(2)}
                        </span>
                        <span className="text-gray-600">
                          冻结 {order.frozenMargin.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {/* 活跃仓位 */}
              {positions.map((pos) => (
                <WasmPositionCard
                  key={pos.id}
                  position={pos}
                  riskAssessment={
                    pos.symbol === `${symbol}USDT` ? riskAssessment : null
                  }
                  symbol={pos.symbol?.replace('USDT', '') || symbol}
                  currentPrice={currentPrice}
                  onClose={() => onClosePosition?.(pos.id)}
                  onAddMargin={onAddMargin}
                />
              ))}
              {/* 历史仓位 (灰色显示) */}
              {closedPositions.length > 0 && (
                <>
                  <div className="flex items-center gap-2 pt-2 pb-1">
                    <span className="text-[10px] text-gray-600">已平仓</span>
                    <div className="flex-1 h-px bg-border-dark" />
                  </div>
                  {closedPositions
                    .slice(-5)
                    .reverse()
                    .map((pos, idx) => (
                      <div
                        key={`closed-${idx}`}
                        className="p-2 rounded bg-bg-surface-elevated/50 border-l-2 border-gray-600 opacity-60"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-500">{pos.symbol}</span>
                            <span
                              className={
                                pos.side === 'Long'
                                  ? 'text-success/60'
                                  : 'text-danger/60'
                              }
                            >
                              {pos.side}
                            </span>
                            <span className="text-gray-600">
                              {pos.leverage}x
                            </span>
                            <span
                              className={`px-1 rounded text-[9px] ${
                                pos.status === 'liquidated'
                                  ? 'bg-danger/20 text-danger'
                                  : 'bg-gray-700 text-gray-400'
                              }`}
                            >
                              {pos.status === 'liquidated'
                                ? '已强平'
                                : '已平仓'}
                            </span>
                          </div>
                          <span
                            className={`font-mono ${
                              (pos.realizedPnl ?? 0) >= 0
                                ? 'text-success/60'
                                : 'text-danger/60'
                            }`}
                          >
                            {(pos.realizedPnl ?? 0) >= 0 ? '+' : ''}
                            {(pos.realizedPnl ?? 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-gray-600 mt-1">
                          <span>
                            Entry: {pos.entryPrice.toFixed(2)} → Exit:{' '}
                            {(pos.exitPrice ?? 0).toFixed(2)}
                          </span>
                          <span>Size: {pos.size.toFixed(4)}</span>
                        </div>
                      </div>
                    ))}
                </>
              )}
            </div>
          ) : (
            <EmptyPositionState />
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(TradeForm);
