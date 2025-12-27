# K 线图表重构计划 - Lightweight Charts 全面迁移

> **目标**: 彻底移除 ECharts，使用 TradingView Lightweight Charts 构建仿币安永续合约风格的专业 K 线图表系统。
> **原则**: 不考虑向后兼容，全面重构。

---

## 📋 目录

1. [当前架构分析](#1-当前架构分析)
2. [目标架构设计](#2-目标架构设计)
3. [重构任务清单](#3-重构任务清单)
4. [技术方案详解](#4-技术方案详解)
5. [风险评估与缓解](#5-风险评估与缓解)

---

## 1. 当前架构分析

### 1.1 现有文件结构

```
src/components/Dashboard/Chart/
├── index.tsx                    # 入口文件，条件导出 ECharts/Lightweight
├── KLineChartECharts.tsx        # ❌ 待删除 - ECharts 实现
├── KLineChartLightweight.tsx    # ✅ 基础版本，需大幅增强
├── ChartToolbar.tsx             # ✅ 保留，需适配新功能
├── ChartOverlay.tsx             # ⚠️ 评估是否需要
├── chartConfig.ts               # ❌ 待删除 - ECharts 配置入口
├── chartModules/                # ❌ 整个目录待删除 - ECharts 模块
│   ├── axisConfig.ts
│   ├── constants.ts
│   ├── formatters.ts
│   ├── index.ts
│   ├── layout.ts
│   ├── layoutConstants.ts
│   ├── series.ts
│   └── tooltip.ts
├── useChartInteraction.ts       # ⚠️ 评估是否需要
└── useChartResize.ts            # ⚠️ 可能集成到主组件
```

### 1.2 当前 Lightweight Charts 实现的问题

基于 `KLineChartLightweight.tsx` 分析：

| 问题 | 描述 | 优先级 |
|------|------|--------|
| **布局单一** | 所有指标都在同一个 priceScale 上堆叠，无法实现币安风格的多窗格布局 | P0 |
| **缺少倒计时** | 无 K 线结束倒计时显示 | P1 |
| **指标窗格混乱** | VOL/MACD/RSI 使用 scaleMargins 挤在主图底部，不是独立窗格 | P0 |
| **十字光标吸附** | 缺少磁吸功能 (Magnet Mode) | P2 |
| **无历史懒加载** | 缺少向左拖拽加载更早历史的功能 | P1 |
| **priceScale 配置** | MACD/RSI 使用字符串 'Line' 而非类型类，API 不一致 | P2 |

### 1.3 依赖现状

```json
{
  "echarts": "^6.0.0",           // ❌ 待移除
  "echarts-for-react": "^3.0.5", // ❌ 待移除
  "lightweight-charts": "^5.1.0" // ✅ 保留
}
```

---

## 2. 目标架构设计

### 2.1 新文件结构

```
src/components/Dashboard/Chart/
├── index.tsx                      # 简化入口，直接导出 LightweightChart
├── LightweightChart/              # 📁 新目录
│   ├── index.tsx                  # 主组件
│   ├── ChartCore.tsx              # 图表核心 (Chart 实例管理)
│   ├── ChartHeader.tsx            # OHLC 数据头部显示
│   ├── PricePane.tsx              # 主图窗格 (K线 + MA/EMA/BOLL)
│   ├── SubPane.tsx                # 副图窗格基类
│   ├── VolumePane.tsx             # 成交量窗格
│   ├── MacdPane.tsx               # MACD 窗格
│   ├── RsiPane.tsx                # RSI 窗格
│   ├── hooks/
│   │   ├── useChartInstance.ts    # Chart 实例 Hook
│   │   ├── useCrosshairSync.ts    # 十字光标同步
│   │   ├── useTimeScaleSync.ts    # 时间轴同步
│   │   ├── useDataUpdate.ts       # 数据更新逻辑
│   │   └── useAutoFollow.ts       # 自动跟随最新数据
│   ├── utils/
│   │   ├── chartColors.ts         # 颜色配置
│   │   ├── formatters.ts          # 格式化工具
│   │   └── dataTransform.ts       # 数据转换工具
│   └── types.ts                   # 类型定义
├── ChartToolbar.tsx               # 保留，可能微调
└── CountdownTimer.tsx             # 新增: K线倒计时组件
```

### 2.2 多窗格布局方案

采用 **方案 B: 多实例同步**，原因：
- 币安风格需要独立的 Y 轴刻度
- 副图可以独立调整高度
- 更灵活的窗格显示/隐藏

```
┌──────────────────────────────────────────────┬─────┐
│                                              │Price│
│           主图 (K线 + MA/EMA/BOLL)            │Scale│
│                                              │     │
├──────────────────────────────────────────────┼─────┤
│                                              │ VOL │
│              成交量窗格                        │Scale│
├──────────────────────────────────────────────┼─────┤
│                                              │MACD │
│              MACD 窗格                        │Scale│
├──────────────────────────────────────────────┼─────┤
│                                              │ RSI │
│              RSI 窗格                         │Scale│
├──────────────────────────────────────────────┴─────┤
│                   时间轴 (共享)                      │
└────────────────────────────────────────────────────┘
```

### 2.3 窗格高度分配策略

```typescript
const PANE_HEIGHTS = {
  // 移动端 (总高度 ~60vh)
  mobile: {
    main: '55%',        // 主图
    sub: '15%',         // 每个副图
    minSubHeight: 80,   // 副图最小高度 px
  },
  // 桌面端
  desktop: {
    main: '60%',
    sub: '20%',
    minSubHeight: 100,
  },
};
```

---

## 3. 重构任务清单

### Phase 1: 基础设施清理 (Day 1)

| ID | 任务 | 描述 | 依赖 |
|----|------|------|------|
| **1.1** | 删除 ECharts 依赖 | 移除 `echarts`, `echarts-for-react` 包 | - |
| **1.2** | 删除 ECharts 文件 | 删除 `KLineChartECharts.tsx`, `chartConfig.ts`, `chartModules/` | 1.1 |
| **1.3** | 清理类型引用 | 移除代码中所有 ECharts 相关类型导入 | 1.2 |
| **1.4** | 创建新目录结构 | 创建 `LightweightChart/` 及子目录 | 1.3 |
| **1.5** | 迁移颜色配置 | 从旧 `constants.ts` 提取颜色到 `chartColors.ts` | 1.4 |

### Phase 2: 多窗格架构 (Day 1-2)

| ID | 任务 | 描述 | 依赖 |
|----|------|------|------|
| **2.1** | ChartCore 组件 | 图表容器管理，处理 resize | 1.4 |
| **2.2** | useChartInstance Hook | 多 Chart 实例的创建/销毁管理 | 2.1 |
| **2.3** | useTimeScaleSync Hook | 多图表时间轴同步 (subscribeVisibleTimeRangeChange) | 2.2 |
| **2.4** | useCrosshairSync Hook | 跨窗格十字光标同步 (subscribeCrosshairMove) | 2.3 |
| **2.5** | PricePane 组件 | 主图窗格 (K线 Series) | 2.2 |
| **2.6** | VolumePane 组件 | 成交量窗格 (Histogram Series) | 2.2 |

### Phase 3: 主图指标系统 (Day 2)

| ID | 任务 | 描述 | 依赖 |
|----|------|------|------|
| **3.1** | MA 指标系列 | MA7/MA25/MA99 三条线，可独立开关 | 2.5 |
| **3.2** | EMA 指标系列 | EMA7/EMA25 两条线 | 2.5 |
| **3.3** | BOLL 指标系列 | 上轨/中轨/下轨 + 可选填充区域 | 2.5 |
| **3.4** | 指标可见性控制 | 通过 Toolbar 切换指标显示 | 3.1-3.3 |

### Phase 4: 副图指标系统 (Day 2-3)

| ID | 任务 | 描述 | 依赖 |
|----|------|------|------|
| **4.1** | SubPane 基类组件 | 副图通用结构 (标题、Y轴配置) | 2.2 |
| **4.2** | MacdPane 组件 | MACD 完整实现 (DIF/DEA 线 + 柱状图) | 4.1 |
| **4.3** | RsiPane 组件 | RSI 线 + 超买/超卖区域 (30/70 水平线) | 4.1 |
| **4.4** | 副图切换逻辑 | 支持同时显示多个副图 / 单选模式 | 4.1-4.3 |

### Phase 5: 交互增强 (Day 3)

| ID | 任务 | 描述 | 依赖 |
|----|------|------|------|
| **5.1** | ChartHeader 组件 | OHLC 实时数据显示 (跟随十字光标) | 2.4 |
| **5.2** | 十字光标吸附 | Magnet Mode (吸附到 OHLC) | 2.4 |
| **5.3** | 最新价指示线 | 主图右侧显示当前价格标签 + 水平虚线 | 2.5 |
| **5.4** | CountdownTimer 组件 | K线结束倒计时显示 | 2.5 |
| **5.5** | 跟随最新按钮 | 查看历史时显示，点击回到最新 | 2.3 |

### Phase 6: 历史数据与性能 (Day 3-4)

| ID | 任务 | 描述 | 依赖 |
|----|------|------|------|
| **6.1** | 历史数据懒加载 | 向左拖拽触发 API 请求加载更早数据 | 2.3 |
| **6.2** | 数据增量更新 | 只 update 最后一根 K 线，不重绘全部 | 2.5 |
| **6.3** | 时间周期切换 | 切换时清空数据并重新请求 | 6.1 |
| **6.4** | 内存管理 | 限制最大 K 线数量，自动清理早期数据 | 6.1 |

### Phase 7: 工具栏与设置 (Day 4)

| ID | 任务 | 描述 | 依赖 |
|----|------|------|------|
| **7.1** | 截图功能 | 使用 chart.takeScreenshot() | 2.1 |
| **7.2** | 指标参数设置 | 弹窗修改 MA 周期、BOLL 参数等 | 3.1-3.3, 4.2-4.3 |
| **7.3** | 图表样式切换 | 空心/实心 K 线切换 | 2.5 |

### Phase 8: 收尾与测试 (Day 4-5)

| ID | 任务 | 描述 | 依赖 |
|----|------|------|------|
| **8.1** | 移动端适配 | 触摸手势、字体大小、窗格高度 | All |
| **8.2** | 性能测试 | 1000+ K 线 + 实时更新压测 | All |
| **8.3** | 文档更新 | 更新 README、组件文档 | All |
| **8.4** | 清理无用代码 | 确保无 ECharts 残留 | All |

---

## 4. 技术方案详解

### 4.1 多图表时间轴同步

```typescript
// useTimeScaleSync.ts
export function useTimeScaleSync(charts: IChartApi[]) {
  useEffect(() => {
    if (charts.length < 2) return;

    const [primary, ...others] = charts;
    
    const unsubscribers = others.map((chart) => {
      return primary.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (range) {
          chart.timeScale().setVisibleRange(range);
        }
      });
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [charts]);
}
```

### 4.2 跨窗格十字光标同步

```typescript
// useCrosshairSync.ts
export function useCrosshairSync(
  charts: IChartApi[],
  onHover: (time: Time | null) => void
) {
  useEffect(() => {
    const unsubscribers = charts.map((chart) => {
      return chart.subscribeCrosshairMove((param) => {
        // 广播到其他图表
        charts.forEach((other) => {
          if (other !== chart && param.time) {
            other.setCrosshairPosition(param.point?.x ?? 0, param.time, other.getSeries()[0]);
          }
        });
        onHover(param.time ?? null);
      });
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [charts, onHover]);
}
```

### 4.3 K 线倒计时实现

```typescript
// CountdownTimer.tsx
export function CountdownTimer({ 
  timeframeSeconds, 
  lastCandleTime 
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const candleEnd = lastCandleTime + timeframeSeconds;
      const diff = candleEnd - now;
      setRemaining(Math.max(0, diff));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeframeSeconds, lastCandleTime]);

  return (
    <span className="text-xs text-neutral-400 font-mono">
      {formatCountdown(remaining)}
    </span>
  );
}
```

### 4.4 RSI 超买/超卖区域

Lightweight Charts 不支持原生背景色带，使用两条水平线 + 可选 AreaSeries：

```typescript
// RsiPane.tsx
function createRsiOverboughtLine(chart: IChartApi) {
  const series = chart.addLineSeries({
    color: 'rgba(255, 82, 82, 0.5)',
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    priceLineVisible: false,
  });
  // 填充恒定值 70
  series.setData(data.map(d => ({ time: d.time, value: 70 })));
  return series;
}
```

### 4.5 历史数据懒加载

```typescript
// useHistoryLoader.ts
export function useHistoryLoader(
  chart: IChartApi | null,
  onLoadMore: (before: Time) => Promise<CandlestickData[]>
) {
  const isLoadingRef = useRef(false);

  useEffect(() => {
    if (!chart) return;

    const unsub = chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range || isLoadingRef.current) return;

      // 检测是否滚动到最左边
      if (range.from < 10) {
        isLoadingRef.current = true;
        const earliestTime = /* 获取最早的时间 */;
        
        onLoadMore(earliestTime).then((newData) => {
          // 插入新数据到系列前端
          series.setData([...newData, ...existingData]);
          isLoadingRef.current = false;
        });
      }
    });

    return unsub;
  }, [chart, onLoadMore]);
}
```

---

## 5. 风险评估与缓解

| 风险 | 影响 | 概率 | 缓解策略 |
|------|------|------|---------|
| 多图表同步性能问题 | 卡顿、延迟 | 中 | 使用 requestAnimationFrame 节流同步事件 |
| 十字光标位置计算复杂 | 位置偏移 | 低 | 使用 setCrosshairPosition API 而非手动计算 |
| Lightweight Charts API 限制 | 无法实现某些功能 | 低 | 提前 POC 验证关键功能 |
| 移动端触摸事件冲突 | 手势不工作 | 中 | 测试 iOS Safari / Android Chrome |
| 历史数据加载时视图跳动 | 体验差 | 中 | 使用 setVisibleRange 锁定当前视图位置 |

---

## 6. 时间估算

| 阶段 | 预计时间 | 说明 |
|------|---------|------|
| Phase 1 | 2-3 小时 | 清理工作，相对简单 |
| Phase 2 | 4-6 小时 | 核心架构，需仔细设计 |
| Phase 3 | 2-3 小时 | 主图指标，已有基础 |
| Phase 4 | 3-4 小时 | 副图系统，较复杂 |
| Phase 5 | 3-4 小时 | 交互增强 |
| Phase 6 | 3-4 小时 | 性能优化 |
| Phase 7 | 2-3 小时 | 工具栏功能 |
| Phase 8 | 2-3 小时 | 测试与收尾 |

**总计: 约 21-30 小时 (3-5 个工作日)**

---

## 7. 开始执行

准备好后，从 **Phase 1.1** 开始，逐步推进。每完成一个任务，在此文档中标记 ✅。

```
[ ] 1.1 删除 ECharts 依赖
[ ] 1.2 删除 ECharts 文件
[ ] 1.3 清理类型引用
...
```

---

## 8. 执行进度

### ✅ Phase 1: 基础设施清理 (已完成)

| ID | 任务 | 状态 |
|----|------|------|
| **1.1** | 删除 ECharts 依赖 | ✅ 已完成 |
| **1.2** | 删除 ECharts 文件 | ✅ 已完成 |
| **1.3** | 清理类型引用 | ✅ 已完成 |
| **1.4** | 创建新目录结构 | ✅ 已完成 |
| **1.5** | 迁移颜色配置 | ✅ 已完成 |

### ✅ Phase 2: 多窗格架构 (已完成)

| ID | 任务 | 状态 |
|----|------|------|
| **2.1** | ChartCore 组件 | ✅ 已完成 (LightweightChart/index.tsx) |
| **2.2** | useChartInstance Hook | ✅ 已完成 |
| **2.3** | useTimeScaleSync Hook | ✅ 已完成 |
| **2.4** | useCrosshairSync Hook | ✅ 已完成 |
| **2.5** | PricePane 组件 | ✅ 已完成 |
| **2.6** | VolumePane 组件 | ✅ 已完成 |

### ✅ Phase 3: 主图指标系统 (已完成)

| ID | 任务 | 状态 |
|----|------|------|
| **3.1** | MA 指标系列 (MA7/MA25/MA99) | ✅ 已完成 |
| **3.2** | EMA 指标系列 (EMA7/EMA25) | ✅ 已完成 (独立 emaSeriesRefs) |
| **3.3** | BOLL 指标系列 (上轨/中轨/下轨) | ✅ 已完成 (使用 LineStyle 虚线) |
| **3.4** | 指标可见性控制 | ✅ 已完成 |
| **3.5** | 主图与副图时间轴同步 | ✅ 已完成 |

### 📁 新创建的文件

```
src/components/Dashboard/Chart/
├── chartColors.ts                    # 颜色配置
├── LightweightChart/                 # 新目录
│   ├── index.tsx                     # 主入口组件
│   ├── PricePane.tsx                 # 主图窗格
│   ├── VolumePane.tsx                # 成交量窗格
│   ├── types.ts                      # 类型定义
│   ├── hooks/
│   │   ├── index.ts
│   │   ├── useChartInstance.ts
│   │   ├── useTimeScaleSync.ts
│   │   ├── useCrosshairSync.ts
│   │   └── useAutoFollow.ts
│   └── utils/
│       ├── index.ts
│       ├── chartColors.ts
│       └── dataTransform.ts
```

### 🗑️ 已删除的文件

- `KLineChartECharts.tsx`
- `chartConfig.ts`
- `chartModules/` (整个目录)
- `useChartInteraction.ts`
- `useChartResize.ts`
- `src/components/PriceChart.tsx`
- `package.json` 中的 echarts, echarts-for-react


