# Plan-03: UI 语言统一 Implementation Plan (实施计划)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal (目标):** 统一界面语言为中文优先，仅保留行业惯用英文术语 (Long/Short/USDT 等)，消除中英文混杂造成的认知负荷。

**Architecture (架构设计):**  
1. 创建 UI Glossary 常量文件，规范术语翻译
2. 逐个组件替换硬编码文案
3. 保留行业标准英文术语（无需翻译）

```
┌─────────────────────────────────────────────────────────────┐
│                    语言统一规则                              │
├─────────────────────────────────────────────────────────────┤
│  保留英文 (行业术语):                                        │
│    Long / Short / USDT / BTC / Market / Limit               │
│    PnL / ROE / Mark Price / Index Price                     │
│    Funding Rate / Leverage                                   │
├─────────────────────────────────────────────────────────────┤
│  翻译为中文:                                                 │
│    Buy → 做多 / Sell → 做空                                  │
│    Close → 平仓 / Add Margin → 追加保证金                    │
│    Safe → 安全 / Warning → 警告 / Critical → 危险            │
│    Available Balance → 可用余额                              │
│    Estimated Liq. Price → 预估强平价                         │
└─────────────────────────────────────────────────────────────┘
```

**Tech Stack (技术栈):** React 18, TypeScript 5

---

## Task 1: 创建 UI Glossary 常量文件

**Files:**
- Create: `/Users/duri/githubStudy/RustQuantLab/src/constants/ui-glossary.ts`

**Step 1: 创建术语表**

```tsx
/**
 * UI 文案术语表
 * 
 * 规则:
 * 1. 行业标准术语保留英文 (Long/Short/USDT/BTC 等)
 * 2. 操作类文案使用中文
 * 3. 状态类文案使用中文
 */

export const UI_TEXT = {
  // 交易操作
  actions: {
    buyLong: '做多',
    sellShort: '做空',
    close: '平仓',
    closeAll: '全部平仓',
    addMargin: '追加保证金',
    cancelOrder: '撤单',
    cancelAll: '全部撤单',
    confirm: '确认',
    cancel: '取消',
    reset: '重置',
    expand: '展开',
    collapse: '收起',
  },
  
  // 风险等级
  riskLevel: {
    Safe: '安全',
    Low: '低风险',
    Medium: '中等风险',
    High: '高风险',
    Critical: '危险',
  },
  
  // 仓位状态
  position: {
    noPosition: '暂无持仓',
    openTip: '开仓以开始交易',
    unrealizedPnl: '未实现盈亏',
    realizedPnl: '已实现盈亏',
    entryPrice: '开仓均价',
    markPrice: '标记价格',
    liqPrice: '强平价格',
    estLiqPrice: '预估强平价',
    distToLiq: '距强平',
    marginRatio: '保证金率',
    leverage: '杠杆',
    size: '数量',
    notional: '名义价值',
    margin: '保证金',
    marginMode: {
      cross: '全仓',
      isolated: '逐仓',
    },
  },
  
  // 订单相关
  order: {
    orderType: '订单类型',
    market: '市价单',
    limit: '限价单',
    marketPrice: '市价',
    limitPrice: '限价',
    priceDeviation: '价格偏差',
    aboveMarket: '高于市价',
    belowMarket: '低于市价',
    pendingOrders: '挂单',
    orderHistory: '委托历史',
    filled: '已成交',
    cancelled: '已撤销',
  },
  
  // 账户相关
  account: {
    balance: '账户余额',
    availableBalance: '可用余额',
    equity: '账户权益',
    totalPnl: '总盈亏',
    resetBalance: '重置余额',
    resetConfirmTitle: '重置账户余额',
    resetConfirmMsg: '此操作将清空所有持仓和交易历史，余额重置为 10,000 USDT。此操作不可撤销。',
  },
  
  // 市场数据
  market: {
    change24h: '24h 涨跌',
    high24h: '24h 最高',
    low24h: '24h 最低',
    volume24h: '24h 成交量',
    fundingRate: '资金费率',
    countdown: '倒计时',
    nextFunding: '下次结算',
  },
  
  // 通用
  common: {
    loading: '加载中...',
    error: '出错了',
    retry: '重试',
    success: '成功',
    failed: '失败',
  },
} as const;

// 风险等级类型导出
export type RiskLevelKey = keyof typeof UI_TEXT.riskLevel;
```

**Step 2: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误

---

## Task 2: 更新 PositionCard 组件文案

**Files:**
- Modify: `/Users/duri/githubStudy/RustQuantLab/src/components/Dashboard/Trade/PositionCard.tsx`

**Step 1: 导入术语表**

```tsx
import { UI_TEXT } from '../../../constants/ui-glossary';
```

**Step 2: 替换风险等级文案**

找到风险等级 Badge 渲染位置，替换：

```tsx
// 原来: {riskLevel}
// 改为:
{UI_TEXT.riskLevel[riskAssessment.riskLevel as keyof typeof UI_TEXT.riskLevel]}
```

**Step 3: 替换按钮和标签文案**

| 原文 | 替换为 |
|------|--------|
| `Close` | `{UI_TEXT.actions.close}` |
| `Add Margin` | `{UI_TEXT.actions.addMargin}` |
| `Entry Price` | `{UI_TEXT.position.entryPrice}` |
| `Liq. Price` | `{UI_TEXT.position.liqPrice}` |
| `Margin Ratio` | `{UI_TEXT.position.marginRatio}` |
| `to liquidation` | `{UI_TEXT.position.distToLiq}` |

**Step 4: 更新 EmptyPositionState**

```tsx
function EmptyPositionState() {
  return (
    <div className="...">
      {/* Icon */}
      <p className="text-sm text-gray-400">{UI_TEXT.position.noPosition}</p>
      <p className="text-xs text-gray-500">{UI_TEXT.position.openTip}</p>
    </div>
  );
}
```

**Step 5: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误
- Manual: 浏览器中验证 PositionCard 显示中文文案

---

## Task 3: 更新 TradePanel 组件文案

**Files:**
- Modify: `/Users/duri/githubStudy/RustQuantLab/src/components/Dashboard/Trade/TradePanel.tsx`

**Step 1: 导入术语表**

```tsx
import { UI_TEXT } from '../../../constants/ui-glossary';
```

**Step 2: 替换按钮文案**

| 原文 | 替换为 |
|------|--------|
| `Buy / Long` | `{UI_TEXT.actions.buyLong}` |
| `Sell / Short` | `{UI_TEXT.actions.sellShort}` |
| `Close` | `{UI_TEXT.actions.close}` |
| `Cancel` | `{UI_TEXT.actions.cancelOrder}` |

**Step 3: 替换标签文案**

| 原文 | 替换为 |
|------|--------|
| `Margin Mode` | `{UI_TEXT.position.marginMode}` 标签 |
| `Cross` | `{UI_TEXT.position.marginMode.cross}` |
| `Isolated` | `{UI_TEXT.position.marginMode.isolated}` |
| `Available` | `{UI_TEXT.account.availableBalance}` |
| `Price` | `{UI_TEXT.order.limitPrice}` |
| `Pending Orders` | `{UI_TEXT.order.pendingOrders}` |

**Step 4: 更新限价偏差提示**

```tsx
// 原来: `${deviation.toFixed(2)}% above market`
// 改为:
`${deviation.toFixed(2)}% ${UI_TEXT.order.aboveMarket}`
```

**Step 5: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误
- Manual: 浏览器中验证 TradePanel 显示中文文案

---

## Task 4: 更新 StatsPanel 组件文案

**Files:**
- Modify: `/Users/duri/githubStudy/RustQuantLab/src/components/Dashboard/StatsPanel.tsx`

**Step 1: 导入术语表**

```tsx
import { UI_TEXT } from '../../constants/ui-glossary';
```

**Step 2: 替换市场数据标签**

| 原文 | 替换为 |
|------|--------|
| `24h Change` | `{UI_TEXT.market.change24h}` |
| `24h High` | `{UI_TEXT.market.high24h}` |
| `24h Low` | `{UI_TEXT.market.low24h}` |
| `24h Volume` | `{UI_TEXT.market.volume24h}` |
| `Funding / Countdown` | `{UI_TEXT.market.fundingRate} / {UI_TEXT.market.countdown}` |
| `Mark Price` | 保留英文 (行业术语) |
| `Index Price` | 保留英文 (行业术语) |

**Step 3: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误
- Manual: 浏览器中验证 StatsPanel 显示中文标签

---

## Task 5: 更新 Toast 通知文案

**Files:**
- Search and modify all Toast usage locations

**Step 1: 审查现有 Toast 调用**

搜索项目中所有 `toast(` 或 `showToast(` 调用，确保通知文案一致使用中文：

```tsx
// 开仓成功
toast(`${UI_TEXT.actions.buyLong}成功: ${side} ${size} ${symbol} @ ${price}`);

// 平仓成功
toast(`${UI_TEXT.actions.close}成功: ${side} ${size} ${symbol}`);

// 强平警告
toast.warning(`${UI_TEXT.riskLevel.Critical}: 接近强平价格`);
```

**Step 2: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误
- Manual: 执行开仓/平仓操作，验证 Toast 通知为中文

---

## Task 6: 创建常量导出入口

**Files:**
- Create: `/Users/duri/githubStudy/RustQuantLab/src/constants/index.ts`

**Step 1: 创建导出文件**

```tsx
export * from './ui-glossary';
```

**Step 2: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误

---

## 验证清单

| 任务 | 验证方式 | 预期结果 |
|------|----------|----------|
| Task 1 | 编译通过 | ui-glossary.ts 创建成功 |
| Task 2 | 查看 PositionCard | 风险等级、按钮显示中文 |
| Task 3 | 查看 TradePanel | 做多/做空/逐仓/全仓 显示中文 |
| Task 4 | 查看 StatsPanel | 24h 涨跌/成交量 显示中文 |
| Task 5 | 执行交易 | Toast 通知显示中文 |
| Task 6 | 编译通过 | 常量导出正常 |

---

## 行业术语保留列表

以下术语保留英文，不做翻译：

- **交易方向**: Long / Short
- **货币单位**: USDT / BTC / ETH
- **订单类型**: Market / Limit
- **价格类型**: Mark Price / Index Price
- **收益指标**: PnL / ROE
- **杠杆**: Leverage (可用中文"杠杆"替代，但倍数保留如 "10x")

---

> 📌 完成后更新 [README.md](./README.md) 中 Plan-03 状态为 ✅
