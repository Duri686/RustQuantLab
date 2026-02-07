import { useState, useCallback, useRef, useEffect } from 'react';
import { useWasmEngine } from './hooks/useWasmEngine';
import { useDataSource } from './hooks/useDataSource';
import type { Timeframe } from './components/Dashboard/Chart/ChartToolbar';
import Header from './components/Layout/Header';
import LoadingScreen from './components/Layout/LoadingScreen';
import ErrorScreen from './components/Layout/ErrorScreen';
import OrderBook from './components/Dashboard/OrderBook';
import { type KLineChartHandle } from './components/Dashboard/Chart';
import ChartView from './components/Dashboard/Chart/ChartView';
import DepthChart from './components/Dashboard/Chart/DepthChart';
import { TradePanel } from './components/Dashboard/Trade';
import TradePanelConnected from './components/TradePanelConnected';

import { ChartTabs, TradeDrawer } from './components/Layout';
import FloatingTradeButton from './components/Layout/FloatingTradeButton';
import { useUiStore, type UiState } from './hooks/ui/useUiStore';
import { useMarketStats } from './hooks/useMarketStats';

/* ============================================
   App - Layout Orchestrator
   ============================================ */

function App() {
  // ========== 数据源管理 ==========
  const {
    dataSource,
    isSwitching,
    switchVisible,
    handleDataSourceChange,
  } = useDataSource();

  const setSwitching = useUiStore((s: UiState) => s.setSwitching);

  // ========== Wasm 引擎 ==========
  const {
    loading,
    error,
    latestData,
    analysisResult,
    candleHistory,
    currentLiveCandle,
    indicatorData,
    currentTimeframe,
    historyReady,
    isRunning,
    priceTrend,
    priceColorClass,
    toggleFeed,
    setTimeframe,
    connectionStatus,
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
    historyCount: 1440,
  });

  // 切换完成条件
  useEffect(() => {
    if (!isSwitching) return;
    if (
      historyReady &&
      (dataSource === 'mock' || connectionStatus === 'connected' || !!latestData)
    ) {
      setSwitching(false);
    }
  }, [isSwitching, historyReady, dataSource, connectionStatus, latestData, setSwitching]);

  // ========== 图表状态 ==========
  const chartRef = useRef<KLineChartHandle>(null);
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>(
    (currentTimeframe as Timeframe) ?? '1H',
  );

  const marketStats = useMarketStats({
    candleHistory,
    latestData,
    currentPrice: latestData?.price,
    timeframe: activeTimeframe,
  });

  const handleTimeframeChange = useCallback(
    (timeframe: Timeframe) => {
      setActiveTimeframe(timeframe);
      setTimeframe?.(timeframe);
    },
    [setTimeframe],
  );

  // ========== Drawer 状态 ==========
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleDrawer = useCallback(() => setDrawerOpen((prev) => !prev), []);

  // ========== 移动端视图 ==========
  const [mobileView, setMobileView] = useState<'trade' | 'chart'>('trade');
  const switchToChartView = useCallback(() => setMobileView('chart'), []);
  const switchToTradeView = useCallback(() => setMobileView('trade'), []);

  // 键盘快捷键: T 切换交易面板
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 't' && !drawerOpen && dataSource === 'mock') toggleDrawer();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen, dataSource, toggleDrawer]);

  // ========== Loading / Error ==========
  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;

  // ========== Main Layout ==========
  return (
    <div className="h-screen w-screen bg-bg-surface-alt flex flex-col overflow-hidden">
      <Header
        isRunning={isRunning}
        onToggle={dataSource === 'mock' ? toggleFeed : undefined}
        price={latestData?.price}
        symbol={latestData?.symbol}
        priceTrend={priceTrend}
        priceColorClass={priceColorClass}
        dataSource={dataSource}
        onDataSourceChange={handleDataSourceChange}
        connectionStatus={connectionStatus}
        isSwitching={isSwitching}
        marketStats={marketStats}
      />

      <main className="flex-1 min-h-0 relative flex flex-col bg-terminal-bg">
        {/* 移动端交易面板视图 */}
        <div className={`flex-1 min-h-0 flex flex-col md:hidden ${mobileView === 'trade' ? '' : 'hidden'}`}>
          <TradePanelConnected
            fullscreen
            dataSource={dataSource}
            onSwitchToChart={switchToChartView}
          />
        </div>

        {/* 图表视图 */}
        <div className={`flex-1 min-h-0 flex flex-col ${mobileView === 'chart' ? '' : 'hidden md:flex'}`}>
          <ChartTabs
            price={latestData?.price}
            priceChangePercent={marketStats?.priceChangePercent}
            priceChange={marketStats?.priceChange}
            high24h={marketStats?.high24h}
            low24h={marketStats?.low24h}
            onOpenTrade={toggleDrawer}
            chartContent={
              <ChartView
                chartRef={chartRef}
                candleHistory={candleHistory}
                currentLiveCandle={currentLiveCandle}
                indicatorData={indicatorData}
                latestData={latestData}
                analysisResult={analysisResult}
                activeTimeframe={activeTimeframe}
                onTimeframeChange={handleTimeframeChange}
                switchVisible={switchVisible}
                dataSource={dataSource}
                marketStats={marketStats}
                onChartViewClick={switchToChartView}
              />
            }
            depthContent={
              <div className="h-full flex flex-col bg-terminal-bg relative">
                <DepthChart
                  bids={latestData?.bids ?? []}
                  asks={latestData?.asks ?? []}
                  price={latestData?.price}
                />
              </div>
            }
          />
        </div>
      </main>

      {/* FAB 浮动交易按钮 */}
      {mobileView === 'chart' && (
        <FloatingTradeButton
          onClick={switchToTradeView}
          className="fixed bottom-6 right-4 z-30"
        />
      )}

      {/* 交易 Drawer */}
      <TradeDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        orderBookContent={
          <OrderBook
            bids={latestData?.bids ?? []}
            asks={latestData?.asks ?? []}
            price={latestData?.price}
            priceTrend={priceTrend}
            priceColorClass={priceColorClass}
            timestamp={latestData?.timestamp}
          />
        }
      >
        <TradePanel
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
        />
      </TradeDrawer>
    </div>
  );
}

export default App;
