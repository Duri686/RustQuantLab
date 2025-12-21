import { useState, useCallback, useRef } from 'react';
import { useWasmEngine } from './hooks/useWasmEngine';
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
import { TradeForm, MobileTradebar } from './components/Dashboard/Trade';

/* ============================================
   Constants
   ============================================ */

/** 主图指标: MA, EMA, BOLL */
const MAIN_INDICATORS = ['MA', 'EMA', 'BOLL'] as const;

/** 副图指标: VOL, MACD, RSI */
const SUB_INDICATORS = ['VOL', 'MACD', 'RSI'] as const;

/* ============================================
   Main App Component (Composition Root)
   ============================================ */

function App() {
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

    // 数据流控制
    isRunning,
    priceTrend,
    priceColorClass,
    toggleFeed,
    setTimeframe,

    // 交易状态 (Rust 管理)
    tradingState,
    position,
    riskAssessment,
    hasPosition,
    pendingOrders,

    // 交易操作 (调用 Rust)
    placeOrder,
    closePosition,
    setLeverage,
    cancelOrder,
  } = useWasmEngine(100);

  // ========== 图表引用 ==========
  const chartRef = useRef<KLineChartHandle>(null);

  // ========== 图表工具栏状态 ==========

  /** 当前激活的时间周期 (UI 状态，与 Rust 引擎同步) */
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>(
    (currentTimeframe as Timeframe) ?? '1H',
  );

  /** 当前激活的指标列表 (UI 状态) */
  const [activeIndicators, setActiveIndicators] = useState<Indicator[]>([
    'MA',
    'VOL',
  ]);

  /** 当前图表类型 */
  const [activeChartType, setActiveChartType] = useState<
    'TradingView' | 'Depth'
  >('TradingView');

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
    <div className="h-screen w-screen bg-[#161a1e] flex flex-col overflow-hidden">
      <Header
        isRunning={isRunning}
        onToggle={toggleFeed}
        price={latestData?.price}
        symbol={latestData?.symbol}
        priceTrend={priceTrend}
        priceColorClass={priceColorClass}
      />

      {/* ========== 主内容区域 ========== */}
      {/* 
        Mobile: 垂直堆叠 + 页面整体滚动 + 底部预留 sticky 交易栏空间
        Tablet: 2 列网格 (Chart+Stats | OrderBook+Trade)
        Desktop: 3 列专业布局
        4K: 限制最大宽度 2560px 居中
      */}
      <main
        className="
          flex-1 min-h-0
          overflow-y-auto md:overflow-hidden
          pb-[101px] md:pb-0
          3xl:max-w-[2560px] 3xl:mx-auto 3xl:w-full
        "
      >
        {/* 响应式网格容器 */}
        <div
          className="
            flex flex-col
            md:grid md:grid-cols-[1fr_280px] md:h-full
            xl:grid-cols-[1fr_260px_300px]
            gap-px bg-[#2b2f36]
          "
        >
          {/* ========== 图表区域 (Chart + Toolbar + Stats) ========== */}
          <section className="flex flex-col min-h-0 bg-terminal-bg">
            {/* Chart Toolbar - 移动端横向滚动 */}
            <ChartToolbar
              activeTimeframe={activeTimeframe}
              onTimeframeChange={handleTimeframeChange}
              activeIndicators={activeIndicators}
              onIndicatorToggle={handleIndicatorToggle}
              activeChartType={activeChartType}
              onChartTypeChange={handleChartTypeChange}
              onScreenshotClick={handleScreenshot}
            />

            {/* K-Line Chart Area - 移动端图表占高度*/}
            <div className="flex flex-col h-[60vh] md:flex-1 md:h-auto min-h-0">
              {/* Chart Sub-Header */}
              <div className="shrink-0 h-7 md:h-8 px-2 md:px-3 flex items-center justify-between border-b border-[#2b2f36] bg-[#0d0d0d]">
                <div className="flex items-center gap-2 md:gap-3">
                  <h2 className="text-[10px] md:text-[11px] font-medium text-gray-400 truncate max-w-[120px] md:max-w-none">
                    {latestData?.symbol ?? 'BTC-USDT'} · Perp
                  </h2>
                  <span className="text-[9px] md:text-[10px] font-mono text-gray-600">
                    {candleHistory.length} candles
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-[#0ECB81] rounded-sm" />
                    <span className="w-2 h-2 bg-[#F6465D] rounded-sm" />
                  </span>
                  <span>OHLC</span>
                </div>
              </div>

              {/* Chart Body */}
              <div className="flex-1 min-h-0 overflow-hidden">
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

            {/* Stats Panel - 移动端 2 列 / 桌面端 4 列 */}
            <StatsPanel
              latestData={latestData}
              analysisResult={analysisResult}
              priceColorClass={priceColorClass}
              candleCount={candleHistory.length}
              isRunning={isRunning}
            />
          </section>

          {/* ========== 订单簿区域 ========== */}
          {/* 移动端高度压缩: 工具栏(28) + 表头(18) + 卖单(70) + Ticker(28) + 买单(70) = 214px */}
          <section className="h-[214px] md:h-full min-h-0 bg-terminal-bg border-t md:border-t-0 md:border-l border-[#2b2f36]">
            <OrderBook
              bids={latestData?.bids ?? []}
              asks={latestData?.asks ?? []}
              price={latestData?.price}
              priceTrend={priceTrend}
              priceColorClass={priceColorClass}
              timestamp={latestData?.timestamp}
            />
          </section>

          {/* ========== 交易表单区域 (仅平板/桌面端显示) ========== */}
          {/* 🔴 使用 Wasm 交易状态 */}
          <section className="hidden xl:block h-full min-h-0 border-l border-[#2b2f36]">
            <TradeForm
              symbol="BTC"
              currentPrice={latestData?.price ?? 40000}
              // Wasm Trading State
              balance={tradingState?.balance ?? 10000}
              availableBalance={tradingState?.availableBalance ?? 10000}
              currentLeverage={tradingState?.leverage ?? 10}
              position={position}
              positions={tradingState?.positions ?? []}
              closedPositions={tradingState?.closedPositions ?? []}
              riskAssessment={riskAssessment}
              hasPosition={hasPosition}
              pendingOrders={pendingOrders}
              // Wasm Actions
              onPlaceOrder={placeOrder}
              onClosePosition={(positionId) => closePosition(positionId)}
              onSetLeverage={setLeverage}
              onCancelOrder={cancelOrder}
            />
          </section>
        </div>
      </main>

      {/* ========== 移动端 Sticky 底部交易栏 ========== */}
      {/* 🔴 使用 Wasm placeOrder */}
      <MobileTradebar
        currentPrice={latestData?.price ?? 40000}
        onBuy={() => {
          // 移动端快速买入：市价单，固定数量
          placeOrder('LONG', 0.01, tradingState?.leverage ?? 10);
        }}
        onSell={() => {
          // 移动端快速卖出：市价单，固定数量
          placeOrder('SHORT', 0.01, tradingState?.leverage ?? 10);
        }}
      />
    </div>
  );
}

export default App;
