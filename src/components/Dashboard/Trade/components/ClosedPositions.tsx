import { memo, useState, useMemo } from 'react';
import type { Position } from '../../../../types/trading';

/* ============================================
   ClosedPositions - 历史仓位列表 + 筛选
   ============================================ */

type HistoryFilter = 'all' | 'profit' | 'loss';

export interface ClosedPositionsProps {
    positions: Position[];
}

function ClosedPositions({ positions }: ClosedPositionsProps) {
    // 筛选状态 (局部化)
    const [showAll, setShowAll] = useState(false);
    const [filter, setFilter] = useState<HistoryFilter>('all');

    // 根据筛选条件过滤
    const filtered = useMemo(() => {
        if (filter === 'all') return positions;
        return positions.filter((pos) =>
            filter === 'profit'
                ? (pos.realizedPnl ?? 0) >= 0
                : (pos.realizedPnl ?? 0) < 0
        );
    }, [positions, filter]);

    // 根据展开状态决定显示数量
    const displayed = showAll ? filtered : filtered.slice(-5);

    if (positions.length === 0) return null;

    return (
        <>
            {/* 标题栏 + 筛选按钮 */}
            <div className="flex items-center justify-between pt-2 pb-1">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600">已平仓</span>
                    <span className="text-[9px] text-gray-700">({positions.length})</span>
                </div>
                {/* 盈亏筛选按钮 */}
                <div className="flex gap-0.5">
                    {(['all', 'profit', 'loss'] as const).map((f) => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setFilter(f)}
                            className={`px-1.5 py-0.5 text-[9px] rounded transition-colors ${filter === f
                                    ? f === 'profit'
                                        ? 'bg-success/20 text-success'
                                        : f === 'loss'
                                            ? 'bg-danger/20 text-danger'
                                            : 'bg-gray-700 text-white'
                                    : 'text-gray-600 hover:text-gray-400'
                                }`}
                        >
                            {f === 'all' ? '全部' : f === 'profit' ? '盈利' : '亏损'}
                        </button>
                    ))}
                </div>
            </div>

            {/* 历史仓位列表 */}
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
                                    pos.side === 'Long' ? 'text-success/60' : 'text-danger/60'
                                }
                            >
                                {pos.side}
                            </span>
                            <span className="text-gray-600">{pos.leverage}x</span>
                            <span
                                className={`px-1 rounded text-[9px] ${pos.status === 'liquidated'
                                        ? 'bg-danger/20 text-danger'
                                        : 'bg-gray-700 text-gray-400'
                                    }`}
                            >
                                {pos.status === 'liquidated' ? '已强平' : '已平仓'}
                            </span>
                        </div>
                        <span
                            className={`font-mono ${(pos.realizedPnl ?? 0) >= 0 ? 'text-success/60' : 'text-danger/60'
                                }`}
                        >
                            {(pos.realizedPnl ?? 0) >= 0 ? '+' : ''}
                            {(pos.realizedPnl ?? 0).toFixed(2)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-gray-600 mt-1">
                        <span>
                            Entry: {pos.entryPrice.toFixed(2)} → Exit: {(pos.exitPrice ?? 0).toFixed(2)}
                        </span>
                        <span>Size: {pos.size.toFixed(4)}</span>
                    </div>
                </div>
            ))}

            {/* 展开/收起按钮 */}
            {filtered.length > 5 && (
                <button
                    type="button"
                    onClick={() => setShowAll(!showAll)}
                    className="w-full py-1.5 text-[10px] text-gray-500 hover:text-gray-400 
                     transition-colors text-center"
                >
                    {showAll ? `收起 (显示最近 5 条)` : `展开全部 (${filtered.length} 条)`}
                </button>
            )}
        </>
    );
}

export default memo(ClosedPositions);
