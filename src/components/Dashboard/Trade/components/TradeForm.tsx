import { memo, useMemo } from 'react';

/* ============================================
   Types
   ============================================ */

export const ORDER_TYPES = ['Limit', 'Market'] as const;
export const SIZE_PRESETS = [25, 50, 75, 100] as const;

export type OrderType = (typeof ORDER_TYPES)[number];

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
   TradeForm - 订单类型 + 价格/数量输入
   ============================================ */

export interface TradeFormProps {
    symbol: string;
    currentPrice: number;
    availableBalance: number;
    leverage: number;
    orderType: OrderType;
    price: string;
    size: string;
    sizePercent: number | null;
    onOrderTypeChange: (type: OrderType) => void;
    onPriceChange: (value: string) => void;
    onSizeChange: (value: string) => void;
    onSizePreset: (percent: number) => void;
}

function TradeForm({
    symbol,
    currentPrice,
    availableBalance,
    leverage,
    orderType,
    price,
    size,
    sizePercent,
    onOrderTypeChange,
    onPriceChange,
    onSizeChange,
    onSizePreset,
}: TradeFormProps) {
    const priceValue = parseFloat(price) || currentPrice;
    const effectivePrice = orderType === 'Market' ? currentPrice : priceValue;

    // Max 按钮计算
    const TAKER_FEE_RATE = 0.0004;
    const maxNotional = availableBalance / (1 / leverage + TAKER_FEE_RATE);
    const maxSize = effectivePrice > 0 ? maxNotional / effectivePrice : 0;

    // 限价单偏差百分比
    const priceDeviation = useMemo(() => {
        if (orderType !== 'Limit' || !priceValue || !currentPrice) return null;
        const diff = ((priceValue - currentPrice) / currentPrice) * 100;
        if (Math.abs(diff) < 0.01) return { label: '≈ 市价', colorClass: 'text-gray-500' };
        if (diff < 0) return { label: `低于市价 ${Math.abs(diff).toFixed(2)}%`, colorClass: 'text-success' };
        return { label: `高于市价 ${diff.toFixed(2)}%`, colorClass: 'text-danger' };
    }, [orderType, priceValue, currentPrice]);

    return (
        <>
            {/* Order Type Tabs */}
            <div className="flex rounded bg-bg-surface p-0.5 shrink-0">
                {ORDER_TYPES.map((type) => (
                    <button
                        key={type}
                        onClick={() => onOrderTypeChange(type)}
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

            {/* Price Input */}
            <div className="shrink-0">
                {orderType === 'Market' ? (
                    <MarketPriceDisplay price={currentPrice} />
                ) : (
                    <TradeInput
                        label="Price (USDT)"
                        value={price}
                        onChange={onPriceChange}
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

            {/* Size Input + Max Button */}
            <div className="shrink-0">
                <div className="flex gap-2">
                    <div className="flex-1">
                        <TradeInput
                            label={`Size (${symbol})`}
                            value={size}
                            onChange={onSizeChange}
                            suffix={symbol}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            onSizeChange(maxSize.toFixed(4));
                            onSizePreset(100);
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
                        onClick={() => onSizePreset(percent)}
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
        </>
    );
}

export default memo(TradeForm);
