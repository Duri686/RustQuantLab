# Plan-07: 布局重构 (方案 B 浮动操作栏)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标 (Goal):** 将 3 栏布局重构为图表全屏 + 浮动操作栏 + Drawer 交易面板，提升看图和操作体验。

**架构设计 (Architecture):**
```
                              重构前                          重构后
┌────────────┬──────┬───────┐           ┌─────────────────────────────────┐
│  K线图     │订单簿│交易面板│   →→→     │      K线图 (全宽)     [FloatPnL] │
│  (57%)    │(13%)│ (30%) │           ├─────────────────────────────────┤
│           │     │Y轴滚动│           │ [做多]              [做空]       │
└───────────┴─────┴───────┘           └─────────────────────────────────┘
                                      点击按钮 → Drawer 滑入
```

**技术栈:** React 18 + Tailwind CSS 4 + Mobile-First + localStorage

---

## 计划结构

| Phase | 文档 | 内容 |
|-------|------|------|
| 0 | [Phase-0](./Plan-07-LayoutRefactor/Phase-0-Preparation.md) | 准备工作 |
| 1 | [Phase-1](./Plan-07-LayoutRefactor/Phase-1-CoreLayout.md) | 核心布局 |
| 2 | [Phase-2](./Plan-07-LayoutRefactor/Phase-2-FloatingComponents.md) | 浮动组件 |
| 3 | [Phase-3](./Plan-07-LayoutRefactor/Phase-3-TradeDrawer.md) | Drawer 交易面板 |
| 4 | [Phase-4](./Plan-07-LayoutRefactor/Phase-4-Interactions.md) | 交互优化 |

---

## 已确认决策

| 项目 | 决策 |
|------|------|
| Drawer 方向 | 移动端底部 / 桌面端右侧 |
| 浮动卡片 | 盈亏百分比 + 金额 |
| 快捷按钮 | 等宽平铺 |
| 订单簿 | Tab 切换 |
| 固定模式 | localStorage 持久化 |
| LIVE 模式 | 完全按 MOCK 显示 |
| 无持仓 | 显示"暂无持仓" |
| 快捷键 | B/S/Esc |

---

## 验收标准

1. ✅ 移动端图表全屏
2. ✅ 底部按钮始终可点击
3. ✅ 持仓摘要浮动右下角
4. ✅ Drawer 滑入时图表仍可见
5. ✅ 键盘快捷键生效
6. ✅ `npm run build` 无错误
