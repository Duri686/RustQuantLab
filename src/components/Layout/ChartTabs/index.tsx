import { memo, useState, type ReactNode } from 'react';
import { CandlestickChart, Layers, ArrowRight } from 'lucide-react';

type TabType = 'chart' | 'depth';

interface ChartTabsProps {
    chartContent: ReactNode;
    depthContent: ReactNode;
    /** 当前价格 */
    price?: number;
    /** 价格变化百分比 */
    priceChangePercent?: number;
    /** 价格变化金额 */
    priceChange?: number;
    /** 24h 最高价 */
    high24h?: number;
    /** 24h 最低价 */
    low24h?: number;
    /** 打开交易面板回调 */
    onOpenTrade?: () => void;
}

interface TabConfig {
    id: TabType;
    label: string;
    icon: ReactNode;
}

const TABS: TabConfig[] = [
    { id: 'chart', label: '图表', icon: <CandlestickChart size={14} /> },
    { id: 'depth', label: '深度', icon: <Layers size={14} /> },
];

/**
 * 图表区域 Tab 切换组件
 * 
 * 重设计版本:
 * - 左侧: Tab 切换 (图表/深度)
 * - 中间: 价格摘要 (从 Header 移入)
 * - 右侧: "去交易" CTA 按钮
 */
function ChartTabs({
    chartContent,
    depthContent,
    price,
    priceChangePercent = 0,
    priceChange = 0,
    high24h,
    low24h,
    onOpenTrade,
}: ChartTabsProps) {
    const [activeTab, setActiveTab] = useState<TabType>('chart');

    const activeIndex = TABS.findIndex(tab => tab.id === activeTab);
    const changeColor = priceChangePercent >= 0 ? 'text-success' : 'text-danger';
    const changeSign = priceChangePercent >= 0 ? '+' : '';

    return (
        <div className="flex flex-col h-full">
            {/* 增强型 Tab 行 */}
            <div className="flex items-center justify-between px-3 py-2 bg-bg-surface border-b border-border-dark shrink-0 gap-3">
                {/* 左侧: 分段控制器 */}
                <div className="relative flex p-1 bg-bg-dark rounded-lg shrink-0">
                    {/* 滑动胶囊背景 */}
                    <div
                        className="absolute inset-y-1 rounded-md transition-all duration-300 ease-out"
                        style={{
                            width: `calc((100% - 8px) / ${TABS.length})`,
                            left: `calc(4px + ${activeIndex} * (100% - 8px) / ${TABS.length})`,
                            background: 'linear-gradient(135deg, rgba(14, 203, 129, 0.2) 0%, rgba(14, 203, 129, 0.1) 100%)',
                            border: '1px solid rgba(14, 203, 129, 0.4)',
                            boxShadow: '0 0 20px rgba(14, 203, 129, 0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
                        }}
                    />

                    {/* Tab 按钮 */}
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                relative z-10 flex items-center justify-center gap-1.5
                                px-4 py-2 text-xs font-medium rounded-md
                                transition-colors duration-200
                                md:px-5 md:text-sm
                                ${activeTab === tab.id
                                    ? 'text-success'
                                    : 'text-gray-500 hover:text-gray-300'
                                }
                            `}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* 中间: 价格摘要 */}
                <div className="hidden md:flex items-center gap-4 flex-1 min-w-0 justify-center">
                    {/* 当前价格 */}
                    <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold font-mono tabular-nums text-white">
                            {price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '-.--'}
                        </span>
                        <span className={`text-sm font-mono tabular-nums ${changeColor}`}>
                            {changeSign}{priceChangePercent.toFixed(2)}%
                        </span>
                        <span className={`text-xs font-mono tabular-nums ${changeColor}`}>
                            ({changeSign}${Math.abs(priceChange).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                        </span>
                    </div>

                    {/* 分隔线 */}
                    <div className="w-px h-5 bg-border-dark" />

                    {/* 24h 高低 */}
                    <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                        <span className="text-success">
                            <span className="text-gray-500">高 </span>
                            {high24h?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '-'}
                        </span>
                        <span className="text-danger">
                            <span className="text-gray-500">低 </span>
                            {low24h?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '-'}
                        </span>
                    </div>
                </div>

                {/* 右侧: 去交易按钮 - 仅桌面端显示 */}
                {onOpenTrade && (
                    <button
                        onClick={() => {
                            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
                            onOpenTrade();
                        }}
                        className="
                            hidden md:flex
                            group shrink-0 items-center gap-1.5
                            px-4 py-2 rounded-lg
                            bg-linear-to-r from-success to-emerald-600
                            text-white text-sm font-medium
                            shadow-lg shadow-success/20
                            transition-all duration-200
                            hover:shadow-xl hover:shadow-success/30 hover:scale-105
                            active:scale-95
                        "
                    >
                        去交易
                        <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                    </button>
                )}
            </div>

            {/* 内容区域 */}
            <div
                className="flex-1 min-h-0"
                style={{
                    // 移动端添加安全区域底部 padding
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
            >
                {activeTab === 'chart' && chartContent}
                {activeTab === 'depth' && depthContent}
            </div>
        </div>
    );
}

export default memo(ChartTabs);
