import { memo } from 'react';
import LeverageSlider from '../LeverageSlider';
import { MARGIN_MODE_CONFIG } from '../../../../config/tradingConfig';
import type { MarginMode } from '../../../../types/trading';

/* ============================================
   MarginSettings - 杠杆 + 保证金模式设置
   ============================================ */

export interface MarginSettingsProps {
    leverage: number;
    marginMode: MarginMode;
    hasPosition: boolean;
    onLeverageChange: (value: number) => void;
    onMarginModeChange: (mode: MarginMode) => void;
}

function MarginSettings({
    leverage,
    marginMode,
    hasPosition,
    onLeverageChange,
    onMarginModeChange,
}: MarginSettingsProps) {
    const isLeverageDisabled = marginMode === 'isolated' && hasPosition;

    return (
        <>
            {/* Leverage Slider */}
            <div className="shrink-0" data-tour="leverage">
                <LeverageSlider
                    value={leverage}
                    onChange={onLeverageChange}
                    disabled={isLeverageDisabled}
                />
                {isLeverageDisabled && (
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
                            onClick={() => onMarginModeChange(mode.value)}
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
        </>
    );
}

export default memo(MarginSettings);
