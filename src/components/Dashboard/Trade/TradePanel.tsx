import { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { animated } from '@react-spring/web';
import { useBottomSheet } from '../../../hooks/ui/useBottomSheet';
import { useToast } from '../../Toast';
import { LEVERAGE_CONFIG } from '../../../config/tradingConfig';
import { UI_TEXT } from '../../../constants/ui-glossary';

// Components
import BalanceHeader from './components/BalanceHeader';
import MarginSettings from './components/MarginSettings';
import TradeForm, { type OrderType } from './components/TradeForm';
import PositionList from './components/PositionList';
import OrderSummary from './components/OrderSummary';
import ActionButtons from './components/ActionButtons';
import PositionContext from './components/PositionContext';
import HighLeverageConfirm from './components/HighLeverageConfirm';

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
   Props Interface
   ============================================ */

export interface TradePanelProps {
  symbol?: string;
  currentPrice?: number;
  balance?: number;
  availableBalance?: number;
  currentLeverage?: number;
  positions?: Position[];
  closedPositions?: Position[];
  riskAssessment?: LiquidationResult | null;
  hasPosition?: boolean;
  marginMode?: MarginMode;
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
  onEstimateLiquidation?: (
    side: 'LONG' | 'SHORT',
    size: number,
    leverage: number,
    marginMode: string,
  ) => EstimateLiquidationResult | null;
  pendingOrders?: PendingOrder[];
  onCancelOrder?: (orderId: string) => void;
  onAddMargin?: (positionId: string, amount: number) => void;
  fullscreen?: boolean;
  onSwitchToChart?: () => void;
}

/* ============================================
   TradePanel - Layout Orchestrator
   ============================================ */

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
  fullscreen = false,
  onSwitchToChart,
}: TradePanelProps) {
  const toast = useToast();

  // ========== Core State ==========
  const [orderType, setOrderType] = useState<OrderType>('Market');
  const [leverage, setLeverage] = useState(currentLeverage);
  const [price, setPrice] = useState(currentPrice.toFixed(2));
  const [size, setSize] = useState('');
  const [sizePercent, setSizePercent] = useState<number | null>(null);
  const [marginMode, setMarginMode] = useState<MarginMode>(propMarginMode);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [leverageConfirm, setLeverageConfirm] = useState<{
    open: boolean;
    pendingSide: 'LONG' | 'SHORT' | null;
  }>({ open: false, pendingSide: null });

  // Sync external props
  useEffect(() => { setLeverage(currentLeverage); }, [currentLeverage]);
  useEffect(() => {
    if (orderType === 'Market') setPrice(currentPrice.toFixed(2));
  }, [currentPrice, orderType]);
  useEffect(() => { setMarginMode(propMarginMode); }, [propMarginMode]);

  // Bottom Sheet
  const { bindDrag, bindSwipeUp, sheetStyle, backdropStyle } = useBottomSheet({
    open: isSheetOpen,
    onOpenChange: setIsSheetOpen,
  });

  // ========== Derived Values ==========
  const currentSymbolPosition = positions.find((p) => p.symbol === `${symbol}USDT`);
  const sizeValue = parseFloat(size) || 0;
  const priceValue = parseFloat(price) || currentPrice;
  const effectivePrice = orderType === 'Market' ? currentPrice : priceValue;
  const TAKER_FEE_RATE = 0.0004;
  const maxNotional = availableBalance / (1 / leverage + TAKER_FEE_RATE);
  const maxSize = effectivePrice > 0 ? maxNotional / effectivePrice : 0;
  const estimatedCost = leverage > 0 ? (sizeValue * effectivePrice) / leverage : 0;

  const isSubmitDisabled = useMemo(() => {
    if (sizeValue <= 0) return true;
    if (estimatedCost > availableBalance) return true;
    return false;
  }, [sizeValue, estimatedCost, availableBalance]);

  // ========== Handlers ==========
  const handleLeverageChange = useCallback(
    (newLeverage: number) => {
      setLeverage(newLeverage);
      if (onSetLeverage) {
        const success = onSetLeverage(newLeverage);
        if (!success && hasPosition) setLeverage(currentLeverage);
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
          setIsSheetOpen(false);
          return true;
        }
        return null;
      }
      return true;
    },
    [onPlaceOrder, sizeValue, leverage, marginMode, orderType, priceValue, currentPrice, toast],
  );

  const handleSubmit = useCallback(
    (side: 'LONG' | 'SHORT'): boolean | null => {
      if (leverage > LEVERAGE_CONFIG.warningThreshold) {
        setLeverageConfirm({ open: true, pendingSide: side });
        return false;
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

  // ========== Form Content (Shared) ==========
  const formContent = (
    <div className="flex-1 min-h-0 flex flex-col px-4 py-3 gap-3">
      <MarginSettings
        leverage={leverage}
        marginMode={marginMode}
        hasPosition={hasPosition}
        onLeverageChange={handleLeverageChange}
        onMarginModeChange={setMarginMode}
      />

      <div className="h-px bg-border-dark shrink-0" />

      <TradeForm
        symbol={symbol}
        currentPrice={currentPrice}
        availableBalance={availableBalance}
        leverage={leverage}
        orderType={orderType}
        price={price}
        size={size}
        sizePercent={sizePercent}
        onOrderTypeChange={setOrderType}
        onPriceChange={setPrice}
        onSizeChange={(v) => { setSize(v); setSizePercent(null); }}
        onSizePreset={handleSizePreset}
      />

      <div className="h-px bg-border-dark shrink-0" />

      <PositionContext position={currentSymbolPosition ?? null} symbol={symbol} />

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

      <div data-tour="open-position">
        <ActionButtons
          disabled={isSubmitDisabled}
          currentPosition={currentSymbolPosition}
          onSubmit={handleSubmit}
        />
      </div>

      <div className="h-px bg-border-dark shrink-0" />

      <PositionList
        positions={positions}
        closedPositions={closedPositions}
        pendingOrders={pendingOrders}
        symbol={symbol}
        currentPrice={currentPrice}
        riskAssessment={riskAssessment}
        marginMode={marginMode}
        leverage={leverage}
        onClosePosition={onClosePosition}
        onCancelOrder={onCancelOrder}
        onAddMargin={onAddMargin}
      />
    </div>
  );

  return (
    <>
      {/* Fullscreen Mode */}
      {fullscreen && (
        <div className="flex flex-col h-full bg-bg-dark overflow-y-auto">
          <BalanceHeader
            balance={balance}
            availableBalance={availableBalance}
            onSwitchToChart={onSwitchToChart}
            showChartButton={!!onSwitchToChart}
          />
          {formContent}
        </div>
      )}

      {/* Desktop Sidebar */}
      {!fullscreen && (
        <div className="hidden xl:flex flex-col h-full bg-bg-dark">
          <BalanceHeader balance={balance} availableBalance={availableBalance} />
          {formContent}
        </div>
      )}

      {/* Mobile Sticky Bar */}
      {!fullscreen && (
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
            <div className="flex-1 min-w-0">
              <span className="text-sm font-mono font-semibold text-white tabular-nums">
                ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <button
              onClick={() => setIsSheetOpen(true)}
              className="px-3 py-2 text-[10px] text-gray-400 border border-border-dark rounded hover:text-white transition-colors"
            >
              ▲ 展开
            </button>
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
      )}

      {/* Mobile Bottom Sheet */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <animated.div
            className="absolute inset-0 bg-black/50"
            style={{ opacity: backdropStyle.opacity }}
            onClick={() => setIsSheetOpen(false)}
          />
          <animated.div
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] flex flex-col bg-bg-dark rounded-t-2xl border-t border-border-dark overflow-hidden"
            style={{ y: sheetStyle.y }}
          >
            <div
              {...bindDrag()}
              className="shrink-0 flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
            >
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>
            <BalanceHeader
              balance={balance}
              availableBalance={availableBalance}
              showCloseButton
              onClose={() => setIsSheetOpen(false)}
            />
            <div className="flex-1 overflow-y-auto">{formContent}</div>
          </animated.div>
        </div>
      )}

      {/* High Leverage Confirm */}
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
