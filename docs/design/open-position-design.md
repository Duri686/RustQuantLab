# 开仓操作 (Open Position) — 产品设计文档

> **Status**: Implemented v1.0
> **Date**: 2025-02-07
> **Scope**: TradeForm 开仓流程的交互细节与视觉设计
> **Method**: Product Manager (PRD) + Product Designer (UX/UI)

---

## Part 1: Product Manager — 需求定义

### 1.1 Problem Statement

**问题**: 当前开仓流程功能完整但缺乏"最后一公里"的细节设计——用户从填写表单到实际开仓之间缺少确认机制、风险预览和即时反馈，容易导致误操作和认知负担。

**目标用户**: 合约交易学习者 / 模拟交易用户（RustQuantLab 定位）

**竞品参考**: Binance Futures、Bybit、OKX 合约下单面板

### 1.2 User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| US-1 | 交易者 | 在下单前看到完整的预估信息（保证金、手续费、预估爆仓价） | 我能做出知情决策 | **P0** |
| US-2 | 交易者 | 切换"按数量"和"按金额"输入 | 我能用更直觉的方式指定仓位大小 | **P1** |
| US-3 | 持仓者 | 在表单中清晰看到当前持仓方向和大小 | 我知道这次操作是加仓还是开新仓 | **P0** |
| US-4 | 交易者 | 在高杠杆(>50x)时得到明确的风险警告 | 我不会因为滑动过快而误设高杠杆 | **P0** |
| US-5 | 交易者 | 下单成功/失败后获得清晰的反馈 | 我立刻知道操作结果 | **P0** |
| US-6 | 限价单用户 | 看到当前市价与我设定价格的偏差百分比 | 我能判断限价是否合理 | **P1** |
| US-7 | 交易者 | 点击 Buy/Sell 后有确认弹窗(可选) | 避免手滑误操作 | **P1** |

### 1.3 RICE Prioritization

| Feature | Reach | Impact | Confidence | Effort | RICE Score |
|---------|-------|--------|-----------|--------|------------|
| 订单预览增强 (US-1) | 10 | 3 | 100% | 1 | **30** |
| 持仓上下文提示 (US-3) | 10 | 2 | 100% | 0.5 | **40** |
| 高杠杆风险警告 (US-4) | 8 | 3 | 80% | 0.5 | **38.4** |
| 下单反馈动效 (US-5) | 10 | 2 | 100% | 0.5 | **40** |
| 输入模式切换 (US-2) | 5 | 1 | 80% | 2 | **2** |
| 限价偏差提示 (US-6) | 3 | 1 | 80% | 0.5 | **4.8** |
| 确认弹窗 (US-7) | 5 | 1 | 50% | 1 | **2.5** |

**实施优先级**: US-3/US-5 → US-4/US-1 → US-6 → US-2 → US-7

### 1.4 Acceptance Criteria

#### AC-1: 订单预览增强
- [x] 显示 Est. Margin（预估保证金 = Size × Price / Leverage）
- [x] 显示 Est. Liq. Price（预估爆仓价，由 Wasm 引擎计算）
- [x] 显示 Fee（手续费预估，0.04% Taker / 0.02% Maker）
- [x] 市价单和限价单分别显示对应信息

#### AC-2: 持仓上下文
- [x] 有同方向仓位时显示 "当前持仓: 多 0.6250 BTC · 同方向加仓"
- [x] 有反方向仓位时显示 "当前持仓: 空 0.5000 BTC · 将开反向仓位"
- [x] 无仓位时不显示任何提示

#### AC-3: 高杠杆风险警告
- [x] 杠杆 > 50x 时 Leverage 数字变为 danger 色
- [x] 杠杆 > 75x 时显示内联警告 "极高风险：爆仓价格将非常接近开仓价"
- [x] Risk Indicator 条已有三段色，增加文字等级提示

#### AC-4: 下单反馈
- [x] 成功：按钮短暂变为 ✓ 状态 + Toast
- [x] 失败：按钮短暂抖动 + Toast 显示错误原因
- [x] 表单在成功后自动清空 size 字段

### 1.5 Out of Scope
- TP/SL（止盈止损）— 后续独立需求
- 条件单（Stop-Limit, Trailing Stop）— 后续独立需求
- 多币种下单 — 当前仅支持 BTC/USDT

### 1.6 Metrics

| Metric | 当前 | 目标 |
|--------|------|------|
| 开仓操作完成率 | 未追踪 | > 90% |
| 误操作回撤率 | 未追踪 | < 5% |
| 平均下单耗时 | 未追踪 | < 5s |

---

## Part 2: Product Designer — UX/UI 设计

### 2.1 User Journey: Open Position Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ STAGE    │ 设置参数    │ 填写订单    │ 确认下单    │ 查看结果    │
├──────────┼────────────┼────────────┼────────────┼────────────┤
│ Actions  │ 调杠杆     │ 选订单类型  │ 点击按钮   │ 查看持仓   │
│          │ 选保证金    │ 输价格/数量 │ (查看预览)  │ (Toast)   │
├──────────┼────────────┼────────────┼────────────┼────────────┤
│ Touch-   │ Slider     │ Tabs       │ Buy/Sell   │ Position   │
│ points   │ Snap btns  │ Inputs     │ Buttons    │ Card       │
│          │ Mode btns  │ Presets    │            │ Toast      │
├──────────┼────────────┼────────────┼────────────┼────────────┤
│ Emotions │ 🤔 评估风险  │ 📝 专注输入  │ 😰 紧张     │ 😊/😫      │
├──────────┼────────────┼────────────┼────────────┼────────────┤
│ Pain     │ 高杠杆无    │ 不知道实际  │ 手滑点错    │ 不确定是   │
│ Points   │ 明确警告    │ 要花多少钱  │ 方向        │ 否成功     │
├──────────┼────────────┼────────────┼────────────┼────────────┤
│ Design   │ 动态风险    │ 实时预览    │ 方向色彩    │ 成功动效   │
│ Solution │ 色彩提示    │ 信息面板    │ 强化+反馈   │ +仓位更新  │
└──────────┴────────────┴────────────┴────────────┴────────────┘
```

### 2.2 Design Principles (Applied)

1. **Hierarchy**: Buy/Long 和 Sell/Short 是最高优先级操作，保持当前视觉权重
2. **Feedback**: 每个操作步骤都需要即时反馈（杠杆变化、数量变化、下单结果）
3. **Safety**: 高风险操作需要明确的视觉警告，但不阻断操作流

### 2.3 Component Design Details

---

#### 2.3.1 Leverage Slider — 风险强化

**当前**: 所有杠杆值统一用 `text-warning` 显示
**改进**:

```
┌─────────────────────────────────────────┐
│ Leverage                         10x    │  ← text-warning (1-20x)
│ Leverage                         50x    │  ← text-warning-alt (21-50x)  
│ Leverage                        100x    │  ← text-danger (51-125x)
│ ⚠ 极高风险: 爆仓价接近开仓价            │  ← 75x+ 显示警告
└─────────────────────────────────────────┘
```

**状态映射**:

| 杠杆范围 | 数字颜色 | Risk 文案 | 额外提示 |
|---------|---------|----------|---------|
| 1-20x | `text-warning` | Low Risk | - |
| 21-50x | `text-warning-alt` | Medium Risk | - |
| 51-75x | `text-danger` | High Risk | - |
| 76-125x | `text-danger` + 闪烁 | Extreme Risk | 内联警告文本 |

---

#### 2.3.2 Order Summary Panel — 预估信息增强

**当前**: 仅显示 Est. Cost 和 Max Size
**改进**: 扩展为完整的订单预览面板

```
┌─────────────────────────────────────────┐
│ 当前持仓:  多 0.6250 BTC · 同方向加仓   │  ← 有仓位时显示
├─────────────────────────────────────────┤
│  [Buy / Long]          [Sell / Short]   │
├─────────────────────────────────────────┤
│ Est. Cost        0.00 USDT              │  ← 保留
│ Max Size         2.500000 BTC           │  ← 保留
│ Est. Margin      ≈ 312.50 USDT         │  ← 🆕 预估保证金
│ Est. Liq. Price  ≈ 35,200.00           │  ← 🆕 预估爆仓价 (需引擎支持)
│ Fee (Taker)      ≈ 0.62 USDT          │  ← 🆕 手续费预估
└─────────────────────────────────────────┘
```

**设计规则**:
- 所有预估值用 `≈` 前缀表示非精确值
- Est. Liq. Price 仅在 `size > 0` 时显示
- Fee 根据订单类型动态切换 Taker(0.04%) / Maker(0.02%)
- 当 Est. Margin > 可用余额的 80% 时，显示为 `text-warning`
- 当 Est. Margin > 可用余额时，显示为 `text-danger`

---

#### 2.3.3 Position Context Banner — 持仓上下文

**当前**: 一行小字 `当前持仓: 多 0.6250 BTC · 同方向加仓`
**改进**: 更丰富的上下文信息

```
┌─────────────────────────────────────────┐
│  📊 当前持仓                             │
│  ┌───────────────────────────────────┐  │
│  │ Long  10x  Safe                   │  │
│  │ Size: 0.6250    Margin: 1958.78  │  │
│  │ Entry: 156702.78                  │  │
│  └───────────────────────────────────┘  │
│  ▸ Buy/Long = 同方向加仓                 │  ← 动态文案
│  ▸ Sell/Short = 开反向新仓位             │  ← 动态文案
└─────────────────────────────────────────┘
```

**规则**:
- **无仓位**: 不显示 banner
- **有同交易对仓位**: 显示仓位摘要 + 操作提示
- 操作提示根据当前仓位方向动态生成

---

#### 2.3.4 Buy/Sell Buttons — 增强反馈

**交互状态矩阵**:

| State | 视觉表现 | 触发条件 |
|-------|---------|---------|
| **Default** | 当前设计（绿/红底色 + shadow） | size > 0 & 余额充足 |
| **Disabled** | 灰色背景，cursor-not-allowed | size = 0 或余额不足 |
| **Hover** | brightness-110 | 鼠标悬停 |
| **Active/Press** | scale-[0.98] | 点击中 |
| **Loading** | 按钮内显示 spinner，禁止重复点击 | 🆕 等待 Wasm 响应 |
| **Success** | 按钮短暂变为 ✓ + 缩放弹跳 | 🆕 开仓成功 |
| **Error** | 按钮短暂水平抖动 (shake) | 🆕 开仓失败 |

**Loading 防护**: 
```
handleSubmit 开始 → isSubmitting = true → 按钮显示 spinner
                 → Wasm 返回结果 → isSubmitting = false
                 → 成功: 按钮闪绿 ✓ (300ms) → 恢复
                 → 失败: 按钮抖动 (300ms) → 恢复
```

**按钮文案动态化**:

| 场景 | Buy 按钮文案 | Sell 按钮文案 |
|------|------------|-------------|
| 无仓位 | Buy / Long | Sell / Short |
| 持有多仓 | Buy / Long ↑ | Sell / Short |
| 持有空仓 | Buy / Long | Sell / Short ↓ |

---

#### 2.3.5 Limit Order UX — 限价单增强

**当前**: 仅一个 price input
**改进**: 增加价格偏差提示

```
┌─────────────────────────────────────────┐
│ Price (USDT)                            │
│ ┌─────────────────────────────────┐    │
│ │  155,000.00                USDT │    │
│ └─────────────────────────────────┘    │
│ 低于市价 1.09% (156,702.78)            │  ← 🆕 偏差提示
└─────────────────────────────────────────┘
```

**偏差显示规则**:
- `限价 < 市价`: "低于市价 X%" — `text-success` (适合做多抄底)
- `限价 > 市价`: "高于市价 X%" — `text-danger` (适合做空)
- `限价 = 市价 ± 0.01%`: "≈ 市价" — `text-gray-500`
- 仅在 Limit 模式下显示

---

#### 2.3.6 Size Input — 金额/数量切换

**当前**: 仅支持按 BTC 数量输入
**改进**: 支持切换输入模式

```
┌─────────────────────────────────────────┐
│ Size  [BTC ▾]                           │  ← 🆕 下拉切换
│ ┌─────────────────────────────────┐    │
│ │  0.0625                    BTC  │    │     按数量模式
│ └─────────────────────────────────┘    │
│                                         │
│ Size  [USDT ▾]                          │  ← 切换后
│ ┌─────────────────────────────────┐    │
│ │  1,000.00                 USDT  │    │     按金额模式
│ └─────────────────────────────────┘    │
│ ≈ 0.0064 BTC                           │  ← 等价换算提示
└─────────────────────────────────────────┘
```

**注意**: 此功能为 P1，可后续迭代实现。

---

### 2.4 Visual Spec Summary

#### 颜色语义(复用现有 Token)

| 语义 | Token | 使用场景 |
|------|-------|---------|
| 做多/盈利 | `text-success` / `bg-success` | Buy 按钮、正盈亏 |
| 做空/亏损 | `text-danger` / `bg-danger` | Sell 按钮、负盈亏 |
| 警告/杠杆 | `text-warning` / `bg-warning` | 杠杆值、选中态 |
| 高风险 | `text-danger` + `animate-pulse` | 高杠杆警告 |
| 辅助信息 | `text-gray-500` | 标签、次要文字 |
| 预估值 | `text-gray-300` | 数值显示 |

#### 字体规范

| 元素 | 大小 | 字重 | Font |
|------|------|------|------|
| 杠杆值 | `text-lg` | `font-bold` | `font-mono` |
| 按钮文字 | `text-sm` | `font-semibold` | default |
| 输入值 | `text-sm` | `font-normal` | `font-mono` |
| 标签 | `text-xs` | `font-normal` | default |
| 小提示 | `text-[10px]` | `font-normal` | default |
| 预估数值 | `text-[11px]` | `font-normal` | `font-mono` |

#### 间距系统

| 区域 | 间距 |
|------|------|
| 区块之间 | `gap-3` (12px) |
| 区块内元素 | `gap-1.5` / `space-y-1.5` (6px) |
| 按钮内 padding | `py-2` / `h-11` |
| 面板 padding | `px-4 py-3` |

---

### 2.5 Interaction Flow Diagram

```
用户打开 TradeForm
       │
       ▼
  ┌─────────────┐
  │ 设置杠杆     │ → Slider / Snap点
  │ (可选调整)    │ → 高杠杆显示 ⚠ 警告
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ 选保证金模式  │ → 全仓(默认) / 逐仓
  │ (可选调整)    │ → 持仓时逐仓不可切换
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ 选订单类型   │ → Market(默认) / Limit
  └──────┬──────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 Market    Limit
 (价格灰色)  (输入价格 → 显示偏差%)
    │         │
    └────┬────┘
         │
         ▼
  ┌─────────────┐
  │ 输入下单数量  │ → 手动输入 / 点击百分比预设
  │              │ → 实时更新 Est. Cost / Margin / Fee
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ 查看持仓上下文│ → (仅有仓位时显示)
  │ + 订单预览    │ → Est. Margin / Liq. Price / Fee
  └──────┬──────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 Buy/Long  Sell/Short
    │         │
    └────┬────┘
         │
         ▼
  ┌─────────────┐
  │ Loading 态   │ → 按钮 spinner (防重复点击)
  └──────┬──────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  成功 ✓     失败 ✗
  (表单清空)  (抖动 + Toast)
  (Toast)    (保留表单数据)
  (仓位刷新)
```

---

## Part 3: Implementation Roadmap

### Phase 0 — 基础设施 (~1天)

| # | Task | 产出文件 |
|---|------|---------|
| 0-1 | Rust: 新增 `estimate_liquidation_price` Wasm API | `core/src/engine/market_engine/mod.rs` |
| 0-2 | 创建 `tradingConfig.ts` (手续费、杠杆阈值等) | `src/config/tradingConfig.ts` |
| 0-3 | 重新编译 Wasm | `pkg/` |

### Phase 1 — 统一 TradePanel 架构 (~3天)

| # | Task | 产出文件 |
|---|------|---------|
| 1-1 | 创建 TradePanel 统一入口 (Mobile Bottom Sheet + Desktop Sidebar) | `Trade/TradePanel.tsx` |
| 1-2 | 拆分子组件: LeverageSlider 增强 (风险分级 + 高杠杆警告) | `Trade/components/LeverageSlider.tsx` |
| 1-3 | 拆分子组件: OrderSummary (Est. Margin / Fee / Liq. Price) | `Trade/components/OrderSummary.tsx` |
| 1-4 | 拆分子组件: ActionButtons (Loading/Success/Error 动效) | `Trade/components/ActionButtons.tsx` |
| 1-5 | 拆分子组件: PositionContext (持仓上下文增强) | `Trade/components/PositionContext.tsx` |
| 1-6 | 高杠杆确认弹窗 (>50x 触发) | `Trade/components/HighLeverageConfirm.tsx` |
| 1-7 | App.tsx 集成: 替换 TradeForm + MobileTradebar → TradePanel | `App.tsx` |
| 1-8 | 删除旧文件: TradeForm.tsx, MobileTradebar.tsx | - |

### Phase 2 — Enhancement (P1, ~2天)

| # | Task | 产出文件 |
|---|------|---------|
| 2-1 | 限价单偏差百分比提示 | `Trade/components/PriceInput.tsx` |
| 2-2 | 按钮文案动态化 (加仓/新仓) | `Trade/components/ActionButtons.tsx` |
| 2-3 | Size 输入模式切换 (BTC/USDT) | `Trade/components/SizeInput.tsx` |

---

## Appendix A: 决策记录

| # | 问题 | 决策 | 日期 |
|---|------|------|------|
| Q1 | Est. Liq. Price 是否需要 Wasm 引擎新增接口？ | **✅ 新增接口** — Rust 端新增 `estimate_liquidation_price` Wasm API，纳入 Phase 1 | 2025-02-07 |
| Q2 | 手续费率是否硬编码还是配置化？ | **✅ 做成可配置** — 创建 `tradingConfig.ts` 集中管理手续费率、杠杆阈值等 | 2025-02-07 |
| Q3 | 确认弹窗是否默认开启？ | **✅ 仅高杠杆触发** — 杠杆 > 50x 时弹出确认弹窗，其余直接下单 | 2025-02-07 |
| Q4 | 移动端是否同步升级？ | **✅ 同步升级 + 移动端优先** — 废弃 MobileTradebar，PC/Mobile 共用一套 TradePanel 组件 | 2025-02-07 |

---

## Appendix B: 移动端优先 — 统一 TradePanel 架构方案

### B.1 现状分析

| 维度 | TradeForm (PC) | MobileTradebar (Mobile) | 差距 |
|------|---------------|------------------------|------|
| 功能 | 完整下单流程 | 仅固定 0.01 BTC 快捷下单 | **巨大** |
| Props | 18 个完整 props | 3 个极简 props | 15 个缺失 |
| 杠杆 | ✅ Slider + Snap | ❌ 无 | 缺失 |
| 保证金模式 | ✅ Cross/Isolated | ❌ 无 | 缺失 |
| 订单类型 | ✅ Market/Limit | ❌ 仅 Market | 缺失 |
| 数量输入 | ✅ 自由输入 + 预设 | ❌ 金额滑动条($100-$1000) | 完全不同 |
| 持仓显示 | ✅ 完整 PositionCard | ❌ 无 | 缺失 |
| 代码量 | 677 行 | 142 行 | — |

**结论**: MobileTradebar 功能过于简陋，需要完全重写。采用 **统一组件 + 响应式布局** 方案。

### B.2 架构方案: Unified TradePanel

```
旧架构:
  App.tsx
  ├── <TradeForm />        (hidden xl:block, 桌面侧边栏)
  └── <MobileTradebar />   (xl:hidden, 移动端底部 sticky)

新架构:
  App.tsx
  └── <TradePanel />       (统一组件，内部响应式)
      ├── [Mobile] Sheet/Drawer 模式 (bottom-sheet, 可展开/收起)
      └── [Desktop] Sidebar 模式 (固定侧边栏)
```

### B.3 组件结构设计 (Mobile-First)

```
Trade/
├── TradePanel.tsx          ← 🆕 统一入口 (替代 TradeForm + MobileTradebar)
│   ├── [Mobile] 收起态: 底部 Sticky Bar (价格 + Buy/Sell)
│   ├── [Mobile] 展开态: Bottom Sheet (完整表单)
│   └── [Desktop] 侧边栏 (= 展开态始终显示)
│
├── components/             ← 🆕 子组件目录 (共享)
│   ├── TradePanelHeader.tsx     — 余额展示 (Balance / Avail)
│   ├── LeverageSlider.tsx       — 杠杆控制 (已有，增强)
│   ├── MarginModeSelector.tsx   — 🆕 保证金模式
│   ├── OrderTypeSelector.tsx    — 🆕 订单类型 (Limit/Market)
│   ├── PriceInput.tsx           — 🆕 价格输入 (含偏差提示)
│   ├── SizeInput.tsx            — 🆕 数量输入 (含百分比预设)
│   ├── OrderSummary.tsx         — 🆕 订单预览 (Margin/Fee/Liq)
│   ├── PositionContext.tsx      — 🆕 持仓上下文提示
│   ├── ActionButtons.tsx        — 🆕 Buy/Sell 按钮 (含反馈动效)
│   └── HighLeverageConfirm.tsx  — 🆕 高杠杆确认弹窗
│
├── PositionCard.tsx        — 已有，保持不变
└── tradingConfig.ts        — 🆕 可配置交易常量
```

### B.4 Mobile Bottom Sheet 行为

```
┌────────────────────────────┐
│ [收起态 — 始终可见]          │
│                             │
│ $156,702.78   [Buy] [Sell] │  ← 44px 高度，safe-area padding
│                             │
└────────────────────────────┘

    ↕ 上滑展开 / 下滑收起

┌────────────────────────────┐
│ [展开态 — Bottom Sheet]     │
│                             │
│ Balance: 10,000 USDT       │
│ Leverage        10x        │
│ ████████░░░░░░░░░ Low Risk │
│ [1x][10x][20x][50x][100x] │
│ ─────────────────────────  │
│ [全仓] [逐仓]              │
│ ─────────────────────────  │
│ [Limit] [Market]           │
│ Price: Market Price   USDT │
│ Size: 0.00            BTC  │
│ [25%] [50%] [75%] [100%]  │
│ ─────────────────────────  │
│ Est. Margin  ≈ 312.50 USDT│
│ Est. Liq.    ≈ 35,200.00  │
│ Fee (Taker)  ≈ 0.62 USDT  │
│ ─────────────────────────  │
│ [  Buy / Long  ][Sell/Short]│
└────────────────────────────┘
```

**交互规则**:
- 默认收起，显示价格和快捷 Buy/Sell 按钮
- 上滑展开完整表单
- 展开态高度 = 屏幕 85% (max-height)
- 表单内容可滚动
- 下单成功后自动收起

### B.5 Desktop 侧边栏行为

- 直接渲染展开态，无需 Bottom Sheet
- 宽度固定，高度 100% 填满
- Positions 列表在表单下方，可滚动

### B.6 Wasm 新增接口

```rust
// core/src/engine/market_engine/mod.rs 新增方法

#[wasm_bindgen]
impl MarketEngine {
    /// 预估开仓后的强平价格 (不实际开仓)
    ///
    /// 用于 UI 下单前的风险预览
    /// 复用 RiskCalculator::calculate_liquidation_price
    ///
    /// @param side - "long" | "short"
    /// @param size - 开仓数量 (BTC)
    /// @param leverage - 杠杆倍数
    /// @param margin_mode - "cross" | "isolated"
    /// @returns { liquidationPrice: f64, margin: f64 }
    pub fn estimate_liquidation_price(
        &self,
        side: &str,
        size: f64,
        leverage: u8,
        margin_mode: &str,
    ) -> Result<JsValue, JsValue>;
}
```

### B.7 tradingConfig.ts 配置

```typescript
export const TRADING_CONFIG = {
  // 手续费率
  fees: {
    takerRate: 0.0004,   // 0.04% Taker (市价单)
    makerRate: 0.0002,   // 0.02% Maker (限价单)
  },
  // 杠杆相关
  leverage: {
    min: 1,
    max: 125,
    default: 10,
    steps: [1, 10, 20, 50, 100, 125],
    // 风险阈值
    warningThreshold: 50,    // >50x 显示确认弹窗
    dangerThreshold: 75,     // >75x 显示内联警告
  },
  // 下单数量预设
  sizePresets: [25, 50, 75, 100],
  // 维持保证金率
  maintenanceMarginRate: 0.005,
} as const;
```
