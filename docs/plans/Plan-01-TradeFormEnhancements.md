# Plan-01: 交易表单优化 Implementation Plan (实施计划)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal (目标):** 优化交易表单交互，增加 Max 按钮、改善市价单展示样式、扩展历史仓位查看能力。

**Architecture (架构设计):**  
在 `TradePanel.tsx` 中添加 Max 快捷按钮，计算最大可开仓量。将市价单价格区域从 disabled 输入框改为非交互式信息展示卡片。在 `PositionCard.tsx` 中扩展历史仓位展示，支持展开全部和按盈亏筛选。

```
┌─────────────────────────────────────────────────────┐
│                   TradePanel                        │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │  Size Input  [________] [Max] ← 新增        │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  Price: Market Price                        │   │ ← 改为展示卡片
│  │  ≈ $95,123.45  (非输入框样式)               │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│                  PositionCard                       │
│  ┌─────────────────────────────────────────────┐   │
│  │  History: 5 条 [展开全部] [按盈亏筛选 ▼]    │   │ ← 新增
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Tech Stack (技术栈):** React 18, TypeScript 5, Tailwind CSS

---

## Task 1: 添加 Max 按钮计算逻辑

**Files:**
- Modify: `/Users/duri/githubStudy/RustQuantLab/src/components/Dashboard/Trade/TradePanel.tsx`

**Step 1: 添加最大可开仓量计算函数**

在 `TradePanel` 组件内添加 `useMemo` 计算最大可开仓量：

```tsx
// 计算最大可开仓量
const maxSize = useMemo(() => {
  if (!availableBalance || !currentPrice || !leverage) return 0;
  // 最大名义价值 = 可用余额 × 杠杆
  const maxNotional = availableBalance * leverage;
  // 最大数量 = 名义价值 / 当前价格
  return maxNotional / currentPrice;
}, [availableBalance, currentPrice, leverage]);
```

**Step 2: 添加 Max 按钮 UI**

在 Size 输入框旁添加 Max 按钮：

```tsx
{/* Size 输入区域 */}
<div className="flex items-center gap-2">
  <TradeInput
    label="Size"
    value={size}
    onChange={setSize}
    suffix={symbol}
    placeholder="0.0000"
  />
  <button
    type="button"
    onClick={() => setSize(maxSize.toFixed(4))}
    className="px-3 py-2 text-xs font-medium text-yellow-400 
               bg-yellow-400/10 hover:bg-yellow-400/20 
               rounded-md transition-colors whitespace-nowrap"
  >
    Max
  </button>
</div>
```

**Step 3: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误
- Manual: 在浏览器中验证 Max 按钮点击后自动填入最大数量

---

## Task 2: 改善市价单价格展示样式

**Files:**
- Modify: `/Users/duri/githubStudy/RustQuantLab/src/components/Dashboard/Trade/TradePanel.tsx`

**Step 1: 创建 MarketPriceDisplay 子组件**

替换 disabled 输入框为信息展示卡片：

```tsx
/* ============================================
   Sub-Component: MarketPriceDisplay
   ============================================ */
interface MarketPriceDisplayProps {
  price: number;
  symbol?: string;
}

const MarketPriceDisplay = memo(function MarketPriceDisplay({
  price,
  symbol = 'USDT',
}: MarketPriceDisplayProps) {
  return (
    <div className="space-y-1">
      <label className="block text-xs text-gray-400">Price</label>
      <div className="flex items-center justify-between px-3 py-2 
                      bg-gray-800/50 rounded-md border border-gray-700/50">
        <span className="text-sm text-gray-300">Market Price</span>
        <span className="text-sm font-medium text-white">
          ≈ {price.toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })} {symbol}
        </span>
      </div>
    </div>
  );
});
```

**Step 2: 替换原有市价单输入框**

找到市价单渲染逻辑，用 `MarketPriceDisplay` 替换：

```tsx
{orderType === 'Market' ? (
  <MarketPriceDisplay price={currentPrice} />
) : (
  <TradeInput
    label="Price"
    value={price}
    onChange={setPrice}
    suffix="USDT"
    placeholder="Enter limit price"
    hint={priceDeviationHint}
  />
)}
```

**Step 3: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误
- Manual: 切换到 Market 单类型，验证价格区域显示为非输入框样式

---

## Task 3: 扩展历史仓位展示 - 展开全部

**Files:**
- Modify: `/Users/duri/githubStudy/RustQuantLab/src/components/Dashboard/Trade/TradePanel.tsx`

**Step 1: 添加展开状态管理**

```tsx
// 历史仓位展开状态
const [showAllHistory, setShowAllHistory] = useState(false);
```

**Step 2: 修改历史仓位渲染逻辑**

将硬编码的 `.slice(-5)` 替换为动态切片：

```tsx
// 动态计算显示数量
const displayedHistory = showAllHistory 
  ? closedPositions 
  : closedPositions.slice(-5);

{/* 历史仓位列表 */}
<div className="space-y-2">
  {displayedHistory.map((pos) => (
    <ClosedPositionCard key={pos.id} position={pos} />
  ))}
  
  {/* 展开/收起按钮 */}
  {closedPositions.length > 5 && (
    <button
      type="button"
      onClick={() => setShowAllHistory(!showAllHistory)}
      className="w-full py-2 text-xs text-gray-400 hover:text-gray-300 
                 transition-colors text-center"
    >
      {showAllHistory 
        ? `收起 (显示最近 5 条)` 
        : `展开全部 (${closedPositions.length} 条)`}
    </button>
  )}
</div>
```

**Step 3: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误
- Manual: 完成多笔交易后验证"展开全部"按钮功能

---

## Task 4: 扩展历史仓位展示 - 盈亏筛选

**Files:**
- Modify: `/Users/duri/githubStudy/RustQuantLab/src/components/Dashboard/Trade/TradePanel.tsx`

**Step 1: 添加筛选状态**

```tsx
// 历史仓位筛选: 'all' | 'profit' | 'loss'
type HistoryFilter = 'all' | 'profit' | 'loss';
const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
```

**Step 2: 添加筛选逻辑**

```tsx
// 根据筛选条件过滤历史仓位
const filteredHistory = useMemo(() => {
  if (historyFilter === 'all') return closedPositions;
  return closedPositions.filter((pos) => 
    historyFilter === 'profit' 
      ? (pos.realizedPnl ?? 0) >= 0 
      : (pos.realizedPnl ?? 0) < 0
  );
}, [closedPositions, historyFilter]);
```

**Step 3: 添加筛选 UI**

```tsx
{/* 历史仓位标题栏 */}
<div className="flex items-center justify-between mb-2">
  <span className="text-sm font-medium text-gray-300">历史仓位</span>
  <div className="flex gap-1">
    {(['all', 'profit', 'loss'] as const).map((filter) => (
      <button
        key={filter}
        type="button"
        onClick={() => setHistoryFilter(filter)}
        className={`px-2 py-1 text-xs rounded transition-colors ${
          historyFilter === filter
            ? 'bg-gray-700 text-white'
            : 'text-gray-500 hover:text-gray-400'
        }`}
      >
        {filter === 'all' ? '全部' : filter === 'profit' ? '盈利' : '亏损'}
      </button>
    ))}
  </div>
</div>
```

**Step 4: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误
- Manual: 验证筛选按钮正确过滤历史仓位列表

---

## 验证清单

| 任务 | 验证方式 | 预期结果 |
|------|----------|----------|
| Task 1 | 点击 Max 按钮 | Size 输入框填入最大可开仓量 |
| Task 2 | 切换 Market 单类型 | 价格区域显示为信息卡片，非输入框 |
| Task 3 | 完成 6+ 笔交易 | 显示"展开全部"按钮，点击显示所有历史 |
| Task 4 | 点击"盈利"筛选 | 仅显示 realizedPnl >= 0 的仓位 |

---

> 📌 完成后更新 [README.md](./README.md) 中 Plan-01 状态为 ✅
