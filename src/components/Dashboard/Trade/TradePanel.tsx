import { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { animated } from '@react-spring/web';
import { useBottomSheet } from '../../../hooks/ui/useBottomSheet';
import LeverageSlider from './LeverageSlider';
import WasmPositionCard, { EmptyPositionState } from './PositionCard';
import OrderSummary from './components/OrderSummary';
import ActionButtons from './components/ActionButtons';
import PositionContext from './components/PositionContext';
import HighLeverageConfirm from './components/HighLeverageConfirm';
import { useToast } from '../../Toast';
import { LEVERAGE_CONFIG, MARGIN_MODE_CONFIG } from '../../../config/tradingConfig';
import { UI_TEXT } from '../../../constants/ui-glossary';
import type {
  Position,
  LiquidationResult,
  OpenPositionResult,
  MarginMode,
  OrderType as OrderTypeEnum,
  PendingOrder,
} from '../../../types/trading';
import type { EstimateLiquidationResult } from '../../../hooks/tradingState/types';

/* ============================================
   Constants
   ============================================ */

const ORDER_TYPES = ['Limit', 'Market'] as const;
const SIZE_PRESETS = [25, 50, 75, 100] as const;

export type OrderType = (typeof ORDER_TYPES)[number];

/* ============================================
   Props Interface
   ============================================ */

export interface TradePanelProps {
  /** 交易对 symbol */
  symbol?: string;
  /** 当前市场价格 */
  currentPrice?: number;

  // ========== Wasm Trading State ==========
  balance?: number;
  availableBalance?: number;
  currentLeverage?: number;
  positions?: Position[];
  closedPositions?: Position[];
  riskAssessment?: LiquidationResult | null;
  hasPosition?: boolean;
  marginMode?: MarginMode;

  // ========== Wasm Actions ==========
  onPlaceOrder?: (
    side: 'LONG' | 'SHORT',
    size: number,
    leverage: number,
    marginMode?: MarginMode,
    orderType?: OrderTypeEnum,
    price?: number,
    currentPrice?: number,
  ) => OpenPositionResult | null;
  onClosePosition?: (symbol?: string) => void;
  onSetLeverage?: (leverage: number) => boolean;
  /** Wasm 引擎预估强平价格 */
  onEstimateLiquidation?: (
    side: 'LONG' | 'SHORT',
    size: number,
    leverage: number,
    marginMode: string,
  ) => EstimateLiquidationResult | null;
  pendingOrders?: PendingOrder[];
  onCancelOrder?: (orderId: string) => void;
  onAddMargin?: (positionId: string, amount: number) => void;
}

/* ============================================
   Sub-Component: TradeInput
   ============================================ */

interface TradeInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix: string;
  placeholder?: string;
  disabled?: boolean;
  /** 输入框下方的辅助提示 */
  hint?: React.ReactNode;
}

function TradeInput({
  label,
  value,
  onChange,
  suffix,
  placeholder = '0.00',
  disabled = false,
  hint,
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
      {hint && <div className="text-[10px]">{hint}</div>}
    </div>
  );
}

/* ============================================
   Sub-Component: MarketPriceDisplay
   ============================================ */

interface MarketPriceDisplayProps {
  price: number;
  symbol?: string;
}

/**
 * MarketPriceDisplay - 市价单价格展示
 *
 * 替换 disabled 输入框为信息展示卡片，更清晰地表明不可编辑
 */
const MarketPriceDisplay = memo(function MarketPriceDisplay({
  price,
  symbol = 'USDT',
}: MarketPriceDisplayProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-gray-400">Price ({symbol})</label>
      <div className="flex items-center justify-between h-10 px-3 bg-bg-surface/50 rounded border border-border-dark">
        <span className="text-sm text-gray-400">Market Price</span>
        <span className="text-sm font-mono font-medium text-white">
          ≈ {price.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
    </div>
  );
});

/* ============================================
   Main Component
   ============================================ */

/**
 * TradePanel — 统一交易面板
 *
 * 替代 TradeForm (PC) + MobileTradebar (Mobile)
 * - Mobile: 底部 sticky bar（收起态）+ bottom sheet（展开态）
 * - Desktop: 固定侧边栏（始终展开态）
 */
function TradePanel({
  symbol = 'BTC',
  currentPrice = 40000,
  balance = 10000,
  availableBalance = 10000,
  currentLeverage = 10,
  positions = [],
  closedPositions = [],
  riskAssessment = null,
  hasPosition = false,
  marginMode: propMarginMode = 'cross',
  onPlaceOrder,
  onClosePosition,
  onSetLeverage,
  onEstimateLiquidation,
  pendingOrders = [],
  onCancelOrder,
  onAddMargin,
}: TradePanelProps) {
  const toast = useToast();

  // ========== Form State ==========
  const [orderType, setOrderType] = useState<OrderType>('Market');
  const [leverage, setLeverage] = useState(currentLeverage);
  const [price, setPrice] = useState(currentPrice.toFixed(2));
  const [size, setSize] = useState('');
  const [sizePercent, setSizePercent] = useState<number | null>(null);
  const [marginMode, setMarginMode] = useState<MarginMode>(propMarginMode);

  // Task 3 & 4: 历史仓位展开和筛选状态
  const [showAllHistory, setShowAllHistory] = useState(false);
  type HistoryFilter = 'all' | 'profit' | 'loss';
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

  // Bug #6 fix: 外部 prop 变化时同步内部 state
  useEffect(() => { setLeverage(currentLeverage); }, [currentLeverage]);
  useEffect(() => {
    if (orderType === 'Market') setPrice(currentPrice.toFixed(2));
  }, [currentPrice, orderType]);
  useEffect(() => { setMarginMode(propMarginMode); }, [propMarginMode]);

  // Mobile bottom sheet 展开状态
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Bottom Sheet 手势 (useDrag + react-spring)
  const { bindDrag, bindSwipeUp, sheetStyle, backdropStyle } = useBottomSheet({
    open: isSheetOpen,
    onOpenChange: setIsSheetOpen,
  });

  // 高杠杆确认弹窗
  const [leverageConfirm, setLeverageConfirm] = useState<{
    open: boolean;
    pendingSide: 'LONG' | 'SHORT' | null;
  }>({ open: false, pendingSide: null });

  // ========== Derived Values ==========
  const currentSymbolPosition = positions.find(
    (p) => p.symbol === `${symbol}USDT`,
  );
  const sizeValue = parseFloat(size) || 0;
  const priceValue = parseFloat(price) || currentPrice;
  const effectivePrice = orderType === 'Market' ? currentPrice : priceValue;
  // Max 按钮计算：预留 0.04% taker fee 空间，避免总成本超过可用余额
  const TAKER_FEE_RATE = 0.0004;
  const maxNotional = availableBalance / (1 / leverage + TAKER_FEE_RATE);
  const maxSize = effectivePrice > 0 ? maxNotional / effectivePrice : 0;
  const estimatedCost = leverage > 0 ? (sizeValue * effectivePrice) / leverage : 0;

  const isSubmitDisabled = useMemo(() => {
    if (sizeValue <= 0) return true;
    if (estimatedCost > availableBalance) return true;
    return false;
  }, [sizeValue, estimatedCost, availableBalance]);

  // 限价单偏差百分比 (Phase 2-1)
  const priceDeviation = useMemo(() => {
    if (orderType !== 'Limit' || !priceValue || !currentPrice) return null;
    const diff = ((priceValue - currentPrice) / currentPrice) * 100;
    if (Math.abs(diff) < 0.01) return { label: '≈ 市价', colorClass: 'text-gray-500' };
    if (diff < 0) return { label: `低于市价 ${Math.abs(diff).toFixed(2)}%`, colorClass: 'text-success' };
    return { label: `高于市价 ${diff.toFixed(2)}%`, colorClass: 'text-danger' };
  }, [orderType, priceValue, currentPrice]);

  // ========== Handlers ==========
  const handleMarginModeChange = useCallback(
    (mode: MarginMode) => {
      setMarginMode(mode);
    },
    [],
  );

  const handleLeverageChange = useCallback(
    (newLeverage: number) => {
      setLeverage(newLeverage);
      if (onSetLeverage) {
        const success = onSetLeverage(newLeverage);
        if (!success && hasPosition) {
          setLeverage(currentLeverage);
        }
      }
    },
    [onSetLeverage, hasPosition, currentLeverage],
  );

  const handleSizePreset = useCallback(
    (percent: number) => {
      setSizePercent(percent);
      const newSize = ((maxSize * percent) / 100).toFixed(6);
      setSize(newSize);
    },
    [maxSize],
  );

  // 实际执行下单 (由 ActionButtons 或确认弹窗触发)
  const executeOrder = useCallback(
    (side: 'LONG' | 'SHORT'): boolean | null => {
      if (sizeValue <= 0) {
        toast.warning('请输入下单数量');
        return false;
      }
      if (orderType === 'Limit' && priceValue <= 0) {
        toast.warning('限价单必须指定价格');
        return false;
      }

      const orderTypeForWasm: OrderTypeEnum = orderType === 'Limit' ? 'limit' : 'market';
      const priceForWasm = orderType === 'Limit' ? priceValue : undefined;

      const result = onPlaceOrder?.(
        side,
        sizeValue,
        leverage,
        marginMode,
        orderTypeForWasm,
        priceForWasm,
        currentPrice,
      );

      if (result) {
        if (result.success) {
          setSize('');
          setSizePercent(null);
          // 移动端下单成功后收起 sheet
          setIsSheetOpen(false);
          return true;
        }
        return null; // 失败
      }
      return true; // 无回调视为成功
    },
    [onPlaceOrder, sizeValue, leverage, marginMode, orderType, priceValue, currentPrice, toast],
  );

  // 下单入口 (检查高杠杆确认)
  const handleSubmit = useCallback(
    (side: 'LONG' | 'SHORT'): boolean | null => {
      // 高杠杆 (>50x) 需要确认
      if (leverage > LEVERAGE_CONFIG.warningThreshold) {
        setLeverageConfirm({ open: true, pendingSide: side });
        return false; // 暂停，等待确认
      }
      return executeOrder(side);
    },
    [leverage, executeOrder],
  );

  const handleLeverageConfirm = useCallback(() => {
    const side = leverageConfirm.pendingSide;
    setLeverageConfirm({ open: false, pendingSide: null });
    if (side) executeOrder(side);
  }, [leverageConfirm.pendingSide, executeOrder]);

  const handleLeverageCancel = useCallback(() => {
    setLeverageConfirm({ open: false, pendingSide: null });
  }, []);

  // ========== 表单主体 (Desktop sidebar / Mobile sheet 展开态共用) ==========
  const formContent = (
    <div className="flex-1 min-h-0 flex flex-col px-4 py-3 gap-3">
      {/* Leverage Slider */}
      <div className="shrink-0" data-tour="leverage">
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

      <div className="h-px bg-border-dark shrink-0" />

      {/* 保证金模式切换 */}
      <div className="shrink-0" data-tour="margin-mode">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-gray-400">保证金模式</label>
          <span className="text-[10px] text-gray-600">
            {marginMode === 'cross' ? '全仓: 共享余额' : '逐仓: 独立保证金'}
          </span>
        </div>
        <div className="flex rounded bg-bg-surface p-0.5">
          {MARGIN_MODE_CONFIG.map((mode) => (
            <button
              key={mode.value}
              onClick={() => handleMarginModeChange(mode.value)}
              className={`
                flex-1 py-2 text-xs font-medium rounded transition-colors
                ${marginMode === mode.value
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

      <div className="h-px bg-border-dark shrink-0" />

      {/* Order Type Tabs */}
      <div className="flex rounded bg-bg-surface p-0.5 shrink-0">
        {ORDER_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setOrderType(type)}
            className={`
              flex-1 py-2 text-xs font-medium rounded transition-colors
              ${orderType === type
                ? 'bg-border-dark text-white'
                : 'text-gray-500 hover:text-gray-300'
              }
            `}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Price Input - Task 2: 市价单使用专用展示组件 */}
      <div className="shrink-0">
        {orderType === 'Market' ? (
          <MarketPriceDisplay price={currentPrice} />
        ) : (
          <TradeInput
            label="Price (USDT)"
            value={price}
            onChange={setPrice}
            suffix="USDT"
            hint={
              priceDeviation ? (
                <span className={priceDeviation.colorClass}>
                  {priceDeviation.label} ({currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                </span>
              ) : undefined
            }
          />
        )}
      </div>

      {/* Size Input - Task 1: 添加 Max 按钮 */}
      <div className="shrink-0">
        <div className="flex gap-2">
          <div className="flex-1">
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
          <button
            type="button"
            onClick={() => {
              setSize(maxSize.toFixed(4));
              setSizePercent(100);
            }}
            className="self-end h-10 px-3 text-xs font-medium text-warning 
                       bg-warning/10 hover:bg-warning/20 
                       rounded border border-warning/30 transition-colors"
          >
            Max
          </button>
        </div>
      </div>

      {/* Size Percentage Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {SIZE_PRESETS.map((percent) => (
          <button
            key={percent}
            onClick={() => handleSizePreset(percent)}
            className={`
              flex-1 py-1.5 text-[10px] font-mono rounded transition-colors
              ${sizePercent === percent
                ? 'bg-warning/20 text-warning border border-warning/50'
                : 'bg-bg-surface text-gray-500 border border-border-dark hover:text-gray-300'
              }
            `}
          >
            {percent}%
          </button>
        ))}
      </div>

      <div className="h-px bg-border-dark shrink-0" />

      {/* 持仓上下文 Banner */}
      <PositionContext position={currentSymbolPosition ?? null} symbol={symbol} />

      {/* Order Summary (增强: Margin / Fee / Liq. Price) */}
      <OrderSummary
        size={sizeValue}
        price={effectivePrice}
        leverage={leverage}
        orderType={orderType}
        availableBalance={availableBalance}
        symbol={symbol}
        onEstimateLiquidation={onEstimateLiquidation}
        marginMode={marginMode}
      />

      <div className="h-px bg-border-dark shrink-0" />

      {/* Action Buttons (增强: Loading/Success/Error 反馈) */}
      <div data-tour="open-position">
        <ActionButtons
          disabled={isSubmitDisabled}
          currentPosition={currentSymbolPosition}
          onSubmit={handleSubmit}
        />
      </div>

      <div className="h-px bg-border-dark shrink-0" />

      {/* ========== Position Display ========== */}
      <div className="flex-1 min-h-30 flex flex-col">
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

        {positions.length > 0 ||
          closedPositions.length > 0 ||
          pendingOrders.length > 0 ? (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {/* 挂单列表 */}
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
            {/* 历史仓位 - Task 3 & 4: 展开/筛选功能 */}
            {closedPositions.length > 0 && (
              <>
                {/* 标题栏 + 筛选按钮 */}
                <div className="flex items-center justify-between pt-2 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600">已平仓</span>
                    <span className="text-[9px] text-gray-700">
                      ({closedPositions.length})
                    </span>
                  </div>
                  {/* 盈亏筛选按钮 */}
                  <div className="flex gap-0.5">
                    {(['all', 'profit', 'loss'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setHistoryFilter(filter)}
                        className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${historyFilter === filter
                          ? filter === 'profit'
                            ? 'bg-success/20 text-success'
                            : filter === 'loss'
                              ? 'bg-danger/20 text-danger'
                              : 'bg-gray-700 text-white'
                          : 'text-gray-600 hover:text-gray-400'
                          }`}
                      >
                        {filter === 'all' ? '全部' : filter === 'profit' ? '盈利' : '亏损'}
                      </button>
                    ))}
                  </div>
                </div>
                {/* 历史仓位列表 */}
                {(() => {
                  // 根据筛选条件过滤
                  const filtered = historyFilter === 'all'
                    ? closedPositions
                    : closedPositions.filter((pos) =>
                      historyFilter === 'profit'
                        ? (pos.realizedPnl ?? 0) >= 0
                        : (pos.realizedPnl ?? 0) < 0
                    );
                  // 根据展开状态决定显示数量
                  const displayed = showAllHistory
                    ? filtered
                    : filtered.slice(-5);

                  return (
                    <>
                      {displayed.reverse().map((pos, idx) => (
                        <div
                          key={`closed-${pos.id ?? idx}`}
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
                                className={`px-1 rounded text-[9px] ${pos.status === 'liquidated'
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
                              className={`font-mono ${(pos.realizedPnl ?? 0) >= 0
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
                      {/* 展开/收起按钮 */}
                      {filtered.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllHistory(!showAllHistory)}
                          className="w-full py-1.5 text-[10px] text-gray-500 hover:text-gray-400 
                                     transition-colors text-center"
                        >
                          {showAllHistory
                            ? `收起 (显示最近 5 条)`
                            : `展开全部 (${filtered.length} 条)`}
                        </button>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        ) : (
          <EmptyPositionState />
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ========== Desktop: 侧边栏 (xl+) ========== */}
      <div className="hidden xl:flex flex-col h-full bg-bg-dark">
        {/* Header: Balance */}
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
        {formContent}
      </div>

      {/* ========== Mobile: 收起态 Sticky Bar (< xl) ========== */}
      <div
        {...bindSwipeUp()}
        className="
          fixed bottom-0 left-0 right-0 z-50
          xl:hidden
          bg-bg-dark border-t border-border-dark
          px-3 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]
          touch-none
        "
      >
        <div className="flex items-center gap-2">
          {/* 价格 */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-mono font-semibold text-white tabular-nums">
              ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* 展开按钮 (保留作为 fallback) */}
          <button
            onClick={() => setIsSheetOpen(true)}
            className="px-3 py-2 text-[10px] text-gray-400 border border-border-dark rounded hover:text-white transition-colors"
          >
            ▲ 展开
          </button>

          {/* 快捷 Buy/Sell */}
          <button
            onClick={() => {
              if (leverage > LEVERAGE_CONFIG.warningThreshold) {
                setLeverageConfirm({ open: true, pendingSide: 'LONG' });
              } else {
                onPlaceOrder?.('LONG', 0.01, leverage, marginMode, 'market', undefined, currentPrice);
              }
            }}
            className="h-10 px-4 touch-target rounded-lg font-semibold text-xs text-white bg-success active:scale-[0.98] transition-all"
          >
            {UI_TEXT.actions.buyLong}
          </button>
          <button
            onClick={() => {
              if (leverage > LEVERAGE_CONFIG.warningThreshold) {
                setLeverageConfirm({ open: true, pendingSide: 'SHORT' });
              } else {
                onPlaceOrder?.('SHORT', 0.01, leverage, marginMode, 'market', undefined, currentPrice);
              }
            }}
            className="h-10 px-4 touch-target rounded-lg font-semibold text-xs text-white bg-danger active:scale-[0.98] transition-all"
          >
            {UI_TEXT.actions.sellShort}
          </button>
        </div>
      </div>

      {/* ========== Mobile: Bottom Sheet 展开态 (Spring 动画) ========== */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          {/* Backdrop (Spring 透明度) */}
          <animated.div
            className="absolute inset-0 bg-black/50"
            style={{ opacity: backdropStyle.opacity }}
            onClick={() => setIsSheetOpen(false)}
          />
          {/* Sheet (Spring translateY) */}
          <animated.div
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] flex flex-col bg-bg-dark rounded-t-2xl border-t border-border-dark overflow-hidden"
            style={{ y: sheetStyle.y }}
          >
            {/* Drag Handle (手势拖拽区域) */}
            <div
              {...bindDrag()}
              className="shrink-0 flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
            >
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>

            {/* Header: Balance */}
            <div className="shrink-0 h-11 px-4 flex items-center justify-between border-b border-border-dark">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">Balance</span>
                <span className="text-xs font-mono font-medium text-white">
                  {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  <span className="text-gray-500 ml-1">USDT</span>
                </span>
              </div>
              <button
                onClick={() => setIsSheetOpen(false)}
                className="text-gray-500 hover:text-white text-sm transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto">
              {formContent}
            </div>
          </animated.div>
        </div>
      )}

      {/* 高杠杆确认弹窗 */}
      <HighLeverageConfirm
        leverage={leverage}
        open={leverageConfirm.open}
        onConfirm={handleLeverageConfirm}
        onCancel={handleLeverageCancel}
      />
    </>
  );
}

export default memo(TradePanel);
