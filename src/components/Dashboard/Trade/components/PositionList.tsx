import { memo } from 'react';
import WasmPositionCard, { EmptyPositionState } from '../PositionCard';
import ClosedPositions from './ClosedPositions';
import type {
    Position,
    LiquidationResult,
    MarginMode,
    PendingOrder,
} from '../../../../types/trading';

/* ============================================
   PositionList - 活跃仓位 + 挂单列表
   ============================================ */

export interface PositionListProps {
    positions: Position[];
    closedPositions: Position[];
    pendingOrders: PendingOrder[];
    symbol: string;
    currentPrice: number;
    riskAssessment: LiquidationResult | null;
    marginMode: MarginMode;
    leverage: number;
    onClosePosition?: (id: string) => void;
    onCancelOrder?: (id: string) => void;
    onAddMargin?: (positionId: string, amount: number) => void;
}

function PositionList({
    positions,
    closedPositions,
    pendingOrders,
    symbol,
    currentPrice,
    riskAssessment,
    marginMode,
    leverage,
    onClosePosition,
    onCancelOrder,
    onAddMargin,
}: PositionListProps) {
    const hasAnyContent =
        positions.length > 0 ||
        closedPositions.length > 0 ||
        pendingOrders.length > 0;

    return (
        <div className="flex-1 min-h-30 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">Positions</span>
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

            {hasAnyContent ? (
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
                                                    order.side === 'Long' ? 'text-success' : 'text-danger'
                                                }
                                            >
                                                {order.side === 'Long' ? '多' : '空'}
                                            </span>
                                            <span className="text-gray-500">{order.leverage}x</span>
                                            <span className="px-1 rounded text-[9px] bg-warning/20 text-warning">
                                                {order.triggerDirection === 'above' ? '等涨' : '等跌'}
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
                                            {order.size.toFixed(4)} {order.symbol.replace('USDT', '')} @{' '}
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

                    {/* 历史仓位 */}
                    <ClosedPositions positions={closedPositions} />
                </div>
            ) : (
                <EmptyPositionState />
            )}
        </div>
    );
}

export default memo(PositionList);
