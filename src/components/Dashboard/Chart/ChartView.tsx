import { memo, useState, useCallback } from 'react';
import ChartToolbar, {
    type Timeframe,
    type Indicator,
} from './ChartToolbar';
import KLineChart, { type KLineChartHandle } from './index';
import StatsPanel from '../StatsPanel';
import type { MarketStats } from '../../../hooks/useMarketStats';
import type { DataSource } from '../../../hooks/useDataSource';

/* ============================================
   Constants
   ============================================ */

const MAIN_INDICATORS = ['MA', 'EMA', 'BOLL'] as const;
const SUB_INDICATORS = ['VOL', 'MACD', 'RSI'] as const;

/* ============================================
   Types
   ============================================ */

export interface ChartViewProps {
    chartRef: React.RefObject<KLineChartHandle>;
    candleHistory: any[];
    currentLiveCandle: any | null;
    indicatorData: any;
    latestData: any | null;
    analysisResult: any | null;
    activeTimeframe: Timeframe;
    onTimeframeChange: (tf: Timeframe) => void;
    switchVisible: boolean;
    dataSource: DataSource;
    marketStats?: MarketStats | null;
    onChartViewClick?: () => void;
}

/* ============================================
   Component
   ============================================ */

function ChartView({
    chartRef,
    candleHistory,
    currentLiveCandle,
    indicatorData,
    latestData,
    analysisResult,
    activeTimeframe,
    onTimeframeChange,
    switchVisible,
    dataSource,
    marketStats,
    onChartViewClick,
}: ChartViewProps) {
    // 指标状态
    const [activeIndicators, setActiveIndicators] = useState<Indicator[]>(['MA', 'VOL']);
    const [activeChartType, setActiveChartType] = useState<'TradingView' | 'Depth'>('TradingView');

    // 指标切换
    const handleIndicatorToggle = useCallback((indicator: Indicator) => {
        setActiveIndicators((prev) => {
            const isMain = (MAIN_INDICATORS as readonly string[]).includes(indicator as string);
            const isSub = (SUB_INDICATORS as readonly string[]).includes(indicator as string);

            if (isMain) {
                const others = prev.filter(
                    (ind) => !(MAIN_INDICATORS as readonly string[]).includes(ind as string),
                );
                return [...others, indicator];
            }

            if (isSub) {
                if (prev.includes(indicator)) {
                    return prev.filter((ind) => ind !== indicator);
                }
                return [...prev, indicator];
            }

            return prev;
        });
    }, []);

    // 图表类型切换
    const handleChartTypeChange = useCallback((chartType: 'TradingView' | 'Depth') => {
        setActiveChartType(chartType);
    }, []);

    // 截图
    const handleScreenshot = useCallback(() => {
        chartRef.current?.takeScreenshot();
    }, [chartRef]);

    // 指标分类
    const activeMainIndicators = activeIndicators.filter((ind) =>
        MAIN_INDICATORS.includes(ind as (typeof MAIN_INDICATORS)[number]),
    );
    const activeSubIndicators = activeIndicators.filter((ind) =>
        SUB_INDICATORS.includes(ind as (typeof SUB_INDICATORS)[number]),
    );

    return (
        <div className="flex flex-col h-full">
            {/* Chart Toolbar */}
            <ChartToolbar
                activeTimeframe={activeTimeframe}
                onTimeframeChange={onTimeframeChange}
                activeIndicators={activeIndicators}
                onIndicatorToggle={handleIndicatorToggle}
                activeChartType={activeChartType}
                onChartTypeChange={handleChartTypeChange}
                onScreenshotClick={handleScreenshot}
                onChartViewClick={onChartViewClick}
                candleCountdown={marketStats?.candleCountdown}
            />

            {/* Chart Area */}
            <div className="flex-1 min-h-0 flex flex-col relative group">
                {/* Sub-Header */}
                <div className="shrink-0 h-7 md:h-8 px-2 md:px-3 flex items-center justify-between border-b border-border-dark bg-bg-black">
                    <div className="flex items-center gap-2 md:gap-3">
                        <h2 className="text-[10px] md:text-[11px] font-medium text-gray-400 truncate max-w-[120px] md:max-w-none">
                            {latestData?.symbol ?? 'BTC-USDT'} · Perp
                        </h2>
                        <span className="text-[9px] md:text-[10px] font-mono text-gray-600">
                            {activeChartType === 'Depth'
                                ? 'Market Depth'
                                : `${candleHistory.length} candles`}
                        </span>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-gray-500">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-success rounded-sm" />
                            <span className="w-2 h-2 bg-danger rounded-sm" />
                        </span>
                        <span>OHLC</span>
                    </div>
                </div>

                {/* Chart Body */}
                <div className="flex-1 min-h-0 overflow-hidden relative">
                    {switchVisible && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-black/60 backdrop-blur-[1px]">
                            <div className="flex flex-col items-center gap-2">
                                <span className="w-6 h-6 border-2 border-border-dark border-t-success rounded-full animate-spin" />
                                <span className="text-[11px] font-mono text-gray-400">
                                    {dataSource === 'binance' ? 'LIVE 切换中…' : 'MOCK 切换中…'}
                                </span>
                            </div>
                        </div>
                    )}
                    <KLineChart
                        ref={chartRef}
                        candleHistory={candleHistory}
                        currentLiveCandle={currentLiveCandle}
                        indicatorData={indicatorData}
                        activeMainIndicators={activeMainIndicators}
                        activeSubIndicators={activeSubIndicators}
                    />
                </div>
            </div>

            {/* Stats Panel */}
            <StatsPanel analysisResult={analysisResult} marketStats={marketStats ?? undefined} />
        </div>
    );
}

export default memo(ChartView);
