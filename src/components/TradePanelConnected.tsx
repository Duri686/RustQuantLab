import { memo } from 'react';
import { TradePanel } from './Dashboard/Trade';
import { useWasmEngine } from '../hooks/useWasmEngine';
import type { DataSource } from '../hooks/useDataSource';

/* ============================================
   TradePanelConnected - TradePanel 连接层
   封装 Wasm 引擎数据，消除 props drilling
   ============================================ */

export interface TradePanelConnectedProps {
    /** 全屏模式 (移动端) */
    fullscreen?: boolean;
    /** 切换到图表视图回调 */
    onSwitchToChart?: () => void;
    /** 数据源 */
    dataSource: DataSource;
}

function TradePanelConnected({
    fullscreen = false,
    onSwitchToChart,
    dataSource,
}: TradePanelConnectedProps) {
    const {
        latestData,
        tradingState,
        riskAssessment,
        hasPosition,
        pendingOrders,
        placeOrder,
        closePosition,
        setLeverage,
        cancelOrder,
        addMargin,
        estimateLiquidation,
    } = useWasmEngine({
        tickInterval: 100,
        dataSource,
        historyCount: 5000,
    });

    return (
        <TradePanel
            fullscreen={fullscreen}
            symbol="BTC"
            currentPrice={latestData?.price ?? 40000}
            balance={tradingState?.balance ?? 10000}
            availableBalance={tradingState?.availableBalance ?? 10000}
            currentLeverage={tradingState?.leverage ?? 10}
            positions={tradingState?.positions ?? []}
            closedPositions={tradingState?.closedPositions ?? []}
            riskAssessment={riskAssessment}
            hasPosition={hasPosition}
            pendingOrders={pendingOrders}
            onPlaceOrder={placeOrder}
            onClosePosition={(positionId) => closePosition(positionId)}
            onSetLeverage={setLeverage}
            onCancelOrder={cancelOrder}
            onAddMargin={addMargin}
            onEstimateLiquidation={estimateLiquidation}
            onSwitchToChart={onSwitchToChart}
        />
    );
}

export default memo(TradePanelConnected);
