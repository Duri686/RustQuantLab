import { memo } from 'react';
import { CandlestickChart, Layers } from 'lucide-react';

/* ============================================
   BalanceHeader - 余额显示头部
   Desktop / Mobile Fullscreen / Sheet 共用
   ============================================ */

export interface BalanceHeaderProps {
    balance: number;
    availableBalance: number;
    /** 图表切换回调 (仅 Fullscreen 模式显示) */
    onSwitchToChart?: () => void;
    /** 是否显示图表切换按钮 */
    showChartButton?: boolean;
    /** 是否显示关闭按钮 */
    showCloseButton?: boolean;
    onClose?: () => void;
}

function BalanceHeader({
    balance,
    availableBalance,
    onSwitchToChart,
    showChartButton = false,
    showCloseButton = false,
    onClose,
}: BalanceHeaderProps) {
    return (
        <div className="shrink-0 h-11 px-4 flex items-center justify-between border-b border-border-dark">
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">Balance</span>
                <span className="text-xs font-mono font-medium text-white">
                    {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    <span className="text-gray-500 ml-1">USDT</span>
                </span>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">Avail</span>
                    <span className="text-xs font-mono font-medium text-success">
                        {availableBalance.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                        })}
                    </span>
                </div>

                {/* 图表切换按钮组 (Fullscreen only) */}
                {showChartButton && onSwitchToChart && (
                    <div className="flex rounded bg-bg-surface p-0.5">
                        <button
                            onClick={onSwitchToChart}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                            title="K线图表"
                        >
                            <CandlestickChart size={12} />
                            <span className="hidden xs:inline">图表</span>
                        </button>
                        <button
                            onClick={onSwitchToChart}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                            title="深度图"
                        >
                            <Layers size={12} />
                            <span className="hidden xs:inline">深度</span>
                        </button>
                    </div>
                )}

                {/* 关闭按钮 (Sheet only) */}
                {showCloseButton && onClose && (
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white text-sm transition-colors"
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
}

export default memo(BalanceHeader);
