import { useState, useCallback, useRef, useEffect } from 'react';
import { useWasmEngine, type DataSource } from './hooks/useWasmEngine';
import type {
  Timeframe,
  Indicator,
} from './components/Dashboard/Chart/ChartToolbar';
import Header from './components/Layout/Header';
import LoadingScreen from './components/Layout/LoadingScreen';
import ErrorScreen from './components/Layout/ErrorScreen';
import StatsPanel from './components/Dashboard/StatsPanel';
import OrderBook from './components/Dashboard/OrderBook';
import KLineChart, {
  type KLineChartHandle,
} from './components/Dashboard/Chart';
import ChartToolbar from './components/Dashboard/Chart/ChartToolbar';
import DepthChart from './components/Dashboard/Chart/DepthChart';
import { TradePanel } from './components/Dashboard/Trade';
import OnboardingTour from './components/Onboarding/OnboardingTour';
import { ChartTabs, TradeDrawer } from './components/Layout';
import FloatingTradeButton from './components/Layout/FloatingTradeButton';
import { useUiStore } from './hooks/ui/useUiStore';
import type { UiState } from './hooks/ui/useUiStore';
import { useMarketStats } from './hooks/useMarketStats';

/* ============================================
   Constants
   ============================================ */

/** 主图指标: MA, EMA, BOLL */
const MAIN_INDICATORS = ['MA', 'EMA', 'BOLL'] as const;

/** 副图指标: VOL, MACD, RSI */
const SUB_INDICATORS = ['VOL', 'MACD', 'RSI'] as const;

/** localStorage key for data source preference */
const DATA_SOURCE_KEY = 'rustquantlab_data_source';

/**
 * 获取初始数据源
 * 优先级: URL 参数 > localStorage > 默认 mock
 */
function getInitialDataSource(): DataSource {
  // 检查 URL 参数
  const params = new URLSearchParams(window.location.search);
  const urlSource = params.get('source');
  if (urlSource === 'binance' || urlSource === 'mock') {
    return urlSource;
  }

  // 检查 localStorage
  const savedSource = localStorage.getItem(DATA_SOURCE_KEY);
  if (savedSource === 'binance' || savedSource === 'mock') {
    return savedSource;
  }

  // 默认使用模拟数据
  return 'mock';
}

/* ============================================
   Main App Component (Composition Root)
   ============================================ */

function App() {
  // ========== 数据源状态 ==========
  const [dataSource, setDataSource] =
    useState<DataSource>(getInitialDataSource);
  const isSwitching = useUiStore((s: UiState) => s.isSwitching);
  const setSwitching = useUiStore((s: UiState) => s.setSwitching);

  const MIN_SWITCH_MS = 300;
  const [switchVisible, setSwitchVisible] = useState<boolean>(false);
  const switchStartRef = useRef<number | null>(null);

  // 持久化数据源偏好
  useEffect(() => {
    localStorage.setItem(DATA_SOURCE_KEY, dataSource);
  }, [dataSource]);

  // ========== 统一的 Wasm 引擎 Hook ==========
  // 整合市场数据 + 交易状态，React 只做 UI 搬运工
  const {
    // 初始化状态
    loading,
    error,

    // 市场数据 (Rust 计算)
    latestData,
    analysisResult,
    candleHistory,
    currentLiveCandle,
    indicatorData,
    currentTimeframe,
    historyReady,
    historyLoading,

    // 数据流控制
    isRunning,
    priceTrend,
    priceColorClass,
    toggleFeed,
    setTimeframe,
    connectionStatus,

    // 交易状态 (Rust 管理)
    tradingState,
    position: _position,
    riskAssessment,
    hasPosition,
    pendingOrders,

    // 交易操作 (调用 Rust)
    placeOrder,
    closePosition,
    setLeverage,
    cancelOrder,
    addMargin,
    estimateLiquidation,
  } = useWasmEngine({
    tickInterval: 100,
    dataSource,
    historyCount: 1440, // 首屏优化：1440 根 1m K 线 ≈ 1 天，显著提速至“秒开”，指标计算仍充足
  });

  // ========== 数据源切换处理 ==========
  const handleDataSourceChange = useCallback(
    (source: DataSource) => {
      if (source !== dataSource) {
        setSwitching(true);
        setDataSource(source);
      }
    },
    [dataSource, setSwitching],
  );

  // 切换完成条件：历史数据就绪，且（MOCK）或（LIVE 已连接或已有最新数据）
  useEffect(() => {
    if (!isSwitching) return;
    if (
      historyReady &&
      (dataSource === 'mock' ||
        connectionStatus === 'connected' ||
        !!latestData)
    ) {
      setSwitching(false);
    }
  }, [
    isSwitching,
    historyReady,
    dataSource,
    connectionStatus,
    latestData,
    setSwitching,
  ]);

  // TODO: AI待确认: 增强移动端触觉反馈（振动），可提供设置开关
  useEffect(() => {
    try {
      if (isSwitching) {
        (navigator as any)?.vibrate?.(30);
      } else {
        (navigator as any)?.vibrate?.(20);
      }
    } catch { }
  }, [isSwitching]);

  useEffect(() => {
    if (isSwitching) {
      switchStartRef.current = performance.now();
      setSwitchVisible(true);
      return;
    }
    const started = switchStartRef.current ?? performance.now();
    const elapsed = performance.now() - started;
    const remaining = Math.max(0, MIN_SWITCH_MS - elapsed);
    const t = setTimeout(() => {
      setSwitchVisible(false);
      switchStartRef.current = null;
    }, remaining);
    return () => clearTimeout(t);
  }, [isSwitching]);

  // ========== 图表引用 ==========
  const chartRef = useRef<KLineChartHandle>(null);

  // ========== 图表工具栏状态 ==========

  /** 当前激活的时间周期 (UI 状态，与 Rust 引擎同步) */
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>(
    (currentTimeframe as Timeframe) ?? '1H',
  );

  // ========== 24h 市场统计 ==========
  const marketStats = useMarketStats({
    candleHistory,
    latestData,
    currentPrice: latestData?.price,
    timeframe: activeTimeframe,
  });

  /** 当前激活的指标列表 (UI 状态) */
  const [activeIndicators, setActiveIndicators] = useState<Indicator[]>([
    'MA',
    'VOL',
  ]);

  /** 当前图表类型 */
  const [activeChartType, setActiveChartType] = useState<
    'TradingView' | 'Depth'
  >('TradingView');

  // ========== Drawer 状态 ==========
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen(prev => !prev);
  }, []);

  // ========== 移动端视图状态 ==========
  // 移动端默认显示交易面板，可切换到图表视图
  const [mobileView, setMobileView] = useState<'trade' | 'chart'>('trade');

  const switchToChartView = useCallback(() => {
    setMobileView('chart');
  }, []);

  const switchToTradeView = useCallback(() => {
    setMobileView('trade');
  }, []);

  // 键盘快捷键: T 切换交易面板
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 排除输入框焦点
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key.toLowerCase() === 't' && !drawerOpen && dataSource === 'mock') {
        toggleDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen, dataSource, toggleDrawer]);

  // TODO: AI待确认: 考虑将 isSwitching 抽离到 Zustand 全局 UI 状态，统一管理全局 UI 反馈

  /**
   * 切换时间周期
   * 同步更新 UI 状态和 Rust 引擎
   */
  const handleTimeframeChange = useCallback(
    (timeframe: Timeframe) => {
      setActiveTimeframe(timeframe);
      // 调用 Rust 引擎切换时间周期
      setTimeframe?.(timeframe);
    },
    [setTimeframe],
  );

  /**
   * 切换指标显示
   * 规则：
   * - 主图指标(MA/EMA/BOLL)单选，不允许置空
   * - 副图指标(VOL/MACD/RSI)多选，点击切换开关
   */
  const handleIndicatorToggle = useCallback((indicator: Indicator) => {
    setActiveIndicators((prev) => {
      const isMain = (MAIN_INDICATORS as readonly string[]).includes(
        indicator as string,
      );
      const isSub = (SUB_INDICATORS as readonly string[]).includes(
        indicator as string,
      );

      if (isMain) {
        // 主图单选：移除其它主图，仅保留当前 indicator
        const others = prev.filter(
          (ind) =>
            !(MAIN_INDICATORS as readonly string[]).includes(ind as string),
        );
        // 始终保持当前主图开启（点击同一项也不关闭）
        return [...others, indicator];
      }

      if (isSub) {
        // 副图多选：常规开关
        if (prev.includes(indicator)) {
          return prev.filter((ind) => ind !== indicator);
        }
        return [...prev, indicator];
      }

      return prev;
    });
  }, []);

  /**
   * 切换图表类型
   */
  const handleChartTypeChange = useCallback(
    (chartType: 'TradingView' | 'Depth') => {
      setActiveChartType(chartType);
    },
    [],
  );

  /**
   * 图表截图
   */
  const handleScreenshot = useCallback(() => {
    chartRef.current?.takeScreenshot();
  }, []);

  // ========== 指标分类 ==========

  /** 激活的主图指标 */
  const activeMainIndicators = activeIndicators.filter((ind) =>
    MAIN_INDICATORS.includes(ind as (typeof MAIN_INDICATORS)[number]),
  );

  /** 激活的副图指标（支持多选并列显示） */
  const activeSubIndicators = activeIndicators.filter((ind) =>
    SUB_INDICATORS.includes(ind as (typeof SUB_INDICATORS)[number]),
  );

  // Loading State
  if (loading) return <LoadingScreen />;

  // Error State
  if (error) return <ErrorScreen message={error} />;

  // Main Layout: Mobile-First Responsive Futures Terminal
  // 断点策略: Mobile (<768) | Tablet (768-1280) | Desktop (1280+) | 4K (2560+)
  return (
    <div className="h-screen w-screen bg-bg-surface-alt flex flex-col overflow-hidden">
      <Header
        isRunning={isRunning}
        onToggle={dataSource === 'mock' ? toggleFeed : undefined} // LIVE 模式下禁用切换
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

      {/* ========== 主内容区域 ========== */}
      {/* 
        Mobile: 垂直堆叠 + 页面整体滚动 + 底部预留 sticky 交易栏空间
        Tablet: 2 列网格 (Chart+Stats | OrderBook+Trade)
        Desktop: 3 列专业布局
        4K: 限制最大宽度 2560px 居中
      */}
      {/* ========== 主内容区域 (方案 B: ChartTabs 全宽) ========== */}
      <main className="flex-1 min-h-0 relative flex flex-col bg-terminal-bg">
        {/* 移动端：根据 mobileView 切换视图 */}
        {/* 桌面端：始终显示图表 */}

        {/* 移动端交易面板视图 */}
        <div className={`flex-1 min-h-0 flex flex-col md:hidden ${mobileView === 'trade' ? '' : 'hidden'}`}>
          <TradePanel
            fullscreen
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
            onSwitchToChart={switchToChartView}
          />
        </div>

        {/* 移动端图表视图 + 桌面端始终显示 */}
        <div className={`flex-1 min-h-0 flex flex-col ${mobileView === 'chart' ? '' : 'hidden md:flex'}`}>
          <ChartTabs
            price={latestData?.price}
            priceChangePercent={marketStats?.priceChangePercent}
            priceChange={marketStats?.priceChange}
            high24h={marketStats?.high24h}
            low24h={marketStats?.low24h}
            onOpenTrade={toggleDrawer}
            chartContent={
              <div className="flex flex-col h-full">
                {/* Chart Toolbar */}
                <ChartToolbar
                  activeTimeframe={activeTimeframe}
                  onTimeframeChange={handleTimeframeChange}
                  activeIndicators={activeIndicators}
                  onIndicatorToggle={handleIndicatorToggle}
                  activeChartType={activeChartType}
                  onChartTypeChange={handleChartTypeChange}
                  onScreenshotClick={handleScreenshot}
                  onChartViewClick={switchToChartView}
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
                <StatsPanel
                  analysisResult={analysisResult}
                  marketStats={marketStats}
                />
              </div>
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



      {/* ========== FAB 浮动交易按钮 (仅移动端图表视图) ========== */}
      {mobileView === 'chart' && (
        <FloatingTradeButton
          onClick={switchToTradeView}
          className="fixed bottom-6 right-4 z-30"
        />
      )}

      {/* ========== 交易 Drawer - 含订单簿 ========== */}
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

      {/* ========== 新手引导 (仅 Mock 模式显示) ========== */}
      {dataSource === 'mock' && <OnboardingTour />}
    </div>
  );
}

export default App;
