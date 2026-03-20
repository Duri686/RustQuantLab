import { memo, useMemo, ReactNode } from 'react';
import { AlertTriangle, CheckCircle, Ban } from 'lucide-react';
import type { RiskLevel } from '../../../../types/trading';

interface MarginRatioGaugeProps {
    /** 保证金率百分比 (0-100+) */
    marginRatio: number;
    /** 维持保证金率 (用于显示警戒线) */
    maintenanceMarginRate?: number;
    /** 风险等级 */
    riskLevel: RiskLevel;
}

/**
 * MarginRatioGauge - 保证金率仪表盘
 * 
 * 半圆仪表盘展示保证金率健康程度
 * - 绿色区: 充足 (> 50%)
 * - 黄色区: 警告 (20-50%)
 * - 红色区: 危险 (< 20%)
 */
function MarginRatioGauge({
    marginRatio,
    maintenanceMarginRate = 1,
    riskLevel,
}: MarginRatioGaugeProps) {
    // 计算仪表盘角度和颜色
    const { strokeColor, statusIcon } = useMemo(() => {
        // 根据风险等级确定颜色和图标
        const colorMap: Record<RiskLevel, { stroke: string; icon: ReactNode }> = {
            Safe: { stroke: '#22c55e', icon: <CheckCircle size={18} /> },
            Low: { stroke: '#84cc16', icon: <CheckCircle size={18} /> },
            Medium: { stroke: '#eab308', icon: <AlertTriangle size={18} /> },
            High: { stroke: '#f97316', icon: <AlertTriangle size={18} /> },
            Critical: { stroke: '#ef4444', icon: <Ban size={18} /> },
        };

        return {
            strokeColor: colorMap[riskLevel].stroke,
            statusIcon: colorMap[riskLevel].icon,
        };
    }, [riskLevel]);

    return (
        <div className="flex items-center gap-3">
            {/* 简化版文字展示 (替代复杂 SVG 仪表盘) */}
            <div className="relative flex items-center gap-2">
                {/* 状态图标 */}
                <span
                    className="text-lg"
                    style={{ color: strokeColor }}
                >
                    {statusIcon}
                </span>

                {/* 保证金率数值 */}
                <div className="flex flex-col">
                    <span className="text-xs text-gray-500">保证金率</span>
                    <span
                        className="text-sm font-medium"
                        style={{ color: strokeColor }}
                    >
                        {marginRatio.toFixed(1)}%
                    </span>
                </div>
            </div>

            {/* 维持保证金率参考线 */}
            {maintenanceMarginRate > 0 && (
                <div className="text-xs text-gray-600">
                    维持: {maintenanceMarginRate}%
                </div>
            )}
        </div>
    );
}

export default memo(MarginRatioGauge);
