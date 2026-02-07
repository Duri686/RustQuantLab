# Phase 1: 核心布局重构

> **预计耗时:** 2-3 小时

---

## 架构变化

```
重构前:                              重构后:
┌─────────────────────────────┐     ┌─────────────────────────────┐
│ Header                      │     │ Header                      │
├────────┬──────┬─────────────┤     ├─────────────────────────────┤
│ Chart  │Order │ TradePanel  │     │ ChartTabs (全宽)             │
│        │Book  │  (滚动)     │     │ [图表] [订单簿] [深度]        │
├────────┴──────┴─────────────┤     ├─────────────────────────────┤
│ StatsPanel                  │     │ StatsPanel                  │
└─────────────────────────────┘     ├─────────────────────────────┤
                                    │ QuickTradeBar [做多] [做空]  │
                                    └─────────────────────────────┘
```

---

## Task 1.1: 创建 ChartTabs 组件

**文件:** 创建 `/src/components/Layout/ChartTabs/index.tsx`

```tsx
import { memo, useState, type ReactNode } from 'react';

type TabType = 'chart' | 'orderbook' | 'depth';

interface ChartTabsProps {
  chartContent: ReactNode;
  orderBookContent: ReactNode;
  depthContent: ReactNode;
}

const TABS: { id: TabType; label: string; icon: string }[] = [
  { id: 'chart', label: '图表', icon: '📈' },
  { id: 'orderbook', label: '订单簿', icon: '📊' },
  { id: 'depth', label: '深度', icon: '📉' },
];

function ChartTabs({ chartContent, orderBookContent, depthContent }: ChartTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('chart');

  return (
    <div className="flex flex-col h-full">
      {/* Tab 切换栏 */}
      <div className="flex border-b border-border-dark bg-bg-surface shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 py-2 text-xs font-medium transition-colors
              ${activeTab === tab.id
                ? 'text-white border-b-2 border-success'
                : 'text-gray-500 hover:text-gray-300'
              }
            `}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 min-h-0">
        {activeTab === 'chart' && chartContent}
        {activeTab === 'orderbook' && orderBookContent}
        {activeTab === 'depth' && depthContent}
      </div>
    </div>
  );
}

export default memo(ChartTabs);
```

**验证:** `npx tsc --noEmit` 无错误

---

## Task 1.2: 修改 App.tsx 主布局

**文件:** 修改 `/src/App.tsx`

**操作:** 将 3 栏布局改为 2 区域布局 (ChartTabs + Bottom)

```tsx
// 核心布局变化:
<div className="flex flex-col h-screen">
  <Header />
  
  {/* 主内容区 - 全宽 */}
  <main className="flex-1 min-h-0 relative">
    <ChartTabs
      chartContent={<KLineChart />}
      orderBookContent={<OrderBook />}
      depthContent={<DepthChart />}
    />
  </main>
  
  <StatsPanel />
  
  {/* 底部快捷操作栏 (Phase 2 添加) */}
  {/* <QuickTradeBar /> */}
</div>
```

**验证:** 
- `npm run build` 无错误
- 浏览器访问，图表全宽显示

---

## Task 1.3: 移除原有订单簿独立栏

**文件:** 修改 `/src/App.tsx`

**操作:** 删除原有 `<section>` 包裹的 OrderBook 独立区域

**验证:** 订单簿只在 Tab 中显示

---

## Task 1.4: 移除原有右侧 TradePanel

**文件:** 修改 `/src/App.tsx`

**操作:** 
- 删除桌面端右侧固定 TradePanel
- 删除移动端底部 TradePanel
- 保留 TradePanel 组件本身 (后续在 Drawer 中使用)

**验证:**
- `npm run build` 无错误
- 页面只显示 Header + ChartTabs + StatsPanel
