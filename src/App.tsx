import { useTradingEngine } from './hooks/useTradingEngine';
import Header from './components/Layout/Header';
import LoadingScreen from './components/Layout/LoadingScreen';
import ErrorScreen from './components/Layout/ErrorScreen';
import StatsPanel from './components/Dashboard/StatsPanel';
import OrderBook from './components/Dashboard/OrderBook';
import KLineChart from './components/KLineChart';

/* ============================================
   Main App Component (Composition Root)
   ============================================ */

function App() {
  const {
    latestData,
    analysisResult,
    candleHistory,
    currentLiveCandle,
    isRunning,
    loading,
    error,
    priceTrend,
    priceColorClass,
    toggleFeed,
  } = useTradingEngine(100);

  // Loading State
  if (loading) return <LoadingScreen />;

  // Error State
  if (error) return <ErrorScreen message={error} />;

  // Main Layout: Professional Trading Terminal
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

      {/* Main Grid: Left (Chart + Stats) | Right (OrderBook) */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-px bg-[#2b2f36] min-h-0">
        {/* ========== 左列: 图表 + 分析条 ========== */}
        <section className="flex flex-col h-[50vh] lg:h-full min-h-0 bg-terminal-bg overflow-hidden">
          {/* K 线图表区域 - 占据剩余空间 */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Chart Header */}
            <div className="shrink-0 h-9 px-3 flex items-center justify-between border-b border-[#2b2f36]">
              <div className="flex items-center gap-3">
                <h2 className="text-[11px] font-medium text-gray-400">
                  {latestData?.symbol ?? 'BBB-AAA'} · 1s K线
                </h2>
                <span className="text-[10px] font-mono text-gray-600">
                  {candleHistory.length} 根
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500">
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
                candleHistory={candleHistory}
                currentLiveCandle={currentLiveCandle}
              />
            </div>
          </div>

          {/* 底部分析条 - 固定高度 */}
          <StatsPanel
            latestData={latestData}
            analysisResult={analysisResult}
            priceColorClass={priceColorClass}
            candleCount={candleHistory.length}
            isRunning={isRunning}
          />
        </section>

        {/* ========== 右列: 订单簿 ========== */}
        <section className="h-full min-h-0 bg-terminal-bg">
          <OrderBook
            bids={latestData?.bids ?? []}
            asks={latestData?.asks ?? []}
            price={latestData?.price}
            priceTrend={priceTrend}
            priceColorClass={priceColorClass}
            timestamp={latestData?.timestamp}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
