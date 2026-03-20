import { memo, useMemo } from 'react';
import type { RiskLevel } from '../../../../types/trading';

interface LiquidationProgressProps {
    /** 距强平百分比 (0-100)，如 15 表示距强平 15% */
    distancePercent: number;
    /** 风险等级 */
    riskLevel: RiskLevel;
    /** 是否显示标签 */
    showLabel?: boolean;
}

/**
 * LiquidationProgress - 强平距离进度条
 * 
 * 可视化展示距离强平的百分比，颜色根据风险等级渐变
 * - Safe: 绿色 (距离远)
 * - Warning: 黄色
 * - Danger: 橙色
 * - Critical: 红色 (即将强平)
 */
function LiquidationProgress({
    distancePercent,
    riskLevel,
    showLabel = true,
}: LiquidationProgressProps) {
    // 计算进度条样式
    const { progressWidth, progressColor, bgColor } = useMemo(() => {
        // 将距离百分比反转为"已用百分比"以便可视化
        // 距离 0% = 100% 已用 (红色), 距离 100% = 0% 已用 (绿色)
        const usedPercent = Math.max(0, Math.min(100, 100 - distancePercent));

        // 根据风险等级确定颜色
        const colorMap: Record<RiskLevel, { progress: string; bg: string }> = {
            Safe: {
                progress: 'bg-linear-to-r from-green-500 to-green-400',
                bg: 'bg-green-500/10'
            },
            Low: {
                progress: 'bg-linear-to-r from-green-400 to-yellow-400',
                bg: 'bg-yellow-500/10'
            },
            Medium: {
                progress: 'bg-linear-to-r from-yellow-400 to-orange-400',
                bg: 'bg-orange-500/10'
            },
            High: {
                progress: 'bg-linear-to-r from-orange-400 to-red-400',
                bg: 'bg-red-500/10'
            },
            Critical: {
                progress: 'bg-linear-to-r from-red-500 to-red-600',
                bg: 'bg-red-500/20'
            },
        };

        return {
            progressWidth: usedPercent,
            progressColor: colorMap[riskLevel].progress,
            bgColor: colorMap[riskLevel].bg,
        };
    }, [distancePercent, riskLevel]);

    return (
        <div className="space-y-1">
            {/* 标签 */}
            {showLabel && (
                <div className="flex justify-between text-xs">
                    <span className="text-gray-500">距强平</span>
                    <span className={
                        riskLevel === 'Critical' ? 'text-red-400 font-medium' :
                            riskLevel === 'High' ? 'text-orange-400' :
                                riskLevel === 'Medium' ? 'text-yellow-400' :
                                    'text-gray-400'
                    }>
                        {distancePercent.toFixed(1)}%
                    </span>
                </div>
            )}

            {/* 进度条 */}
            <div className={`h-2 rounded-full overflow-hidden ${bgColor}`}>
                <div
                    className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                    style={{ width: `${progressWidth}%` }}
                />
            </div>
        </div>
    );
}

export default memo(LiquidationProgress);
