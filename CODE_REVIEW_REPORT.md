# 代码审查报告 - src 目录规范符合性检查

## 审查时间
2024-12-19

## 审查范围
`src/` 目录下的所有 TypeScript/TSX 文件

---

## 一、代码规范问题（高优先级）

### 1.1 硬编码颜色问题 - 违背 Tailwind 主题色规范
**问题描述**：
- 规范要求：**必须使用 Tailwind 主题色或 CSS 变量，禁止硬编码 Hex/RGB**
- 当前状态：大量使用 `bg-[#...]`、`text-[#...]`、`border-[#...]` 和内联样式中的颜色硬编码
- 影响：无法主题切换、代码可维护性差、已有 CSS 变量未使用

**涉及文件**（15个文件）：
- `src/components/Toast/Toast.tsx` (第 32-49 行：多处 `bg-[#...]`、`border-[#...]`、图标颜色十六进制)
- `src/hooks/useWasmEngine.ts` (第 513-515 行：`text-[#00f090]`、`text-[#ff3b30]`)
- `src/components/Dashboard/StatsPanel.tsx` (第 73-75 行：背景/边框十六进制；第 88-96 行：指标颜色 `text-[#F0B90B]`、`text-[#00B8D9]`)
- `src/components/Layout/LoadingScreen.tsx` (第 7-10 行：背景/边框十六进制)
- `src/components/Dashboard/Trade/LeverageSlider.tsx` (多处 `text-[#FCD535]`、`bg-[#2b2f36]`、`border-[#...]`、内联 `textShadow` 使用 rgba)
- `src/components/Dashboard/Trade/MobileTradebar.tsx` (多处 `bg-[#0b0e11]`、`border-[#2b2f36]`)
- `src/components/Dashboard/Trade/PositionCard.tsx` (多处背景/文本/边框十六进制；含内联 `style` 设色)
- `src/components/Layout/Header.tsx` (多处 `bg-[#1e2026]`、`border-[#2b2f36]`、状态色 `[#0ECB81]` 等)
- `src/App.tsx` 与 `src/components/Dashboard/Trade/TradeForm.tsx` 中亦大量使用 `[#...]` 颜色
- 其他多个组件文件

**处理建议**：
1. 统一改用 CSS 变量（已在 `index.css` 的 `@theme` 中定义）
2. 将常用的 Binance 色系映射到 theme 或 CSS 变量（如 `--color-success`、`--color-danger`、`--color-warning`）
3. 组件内使用 `text-[var(--...)]`/`bg-[var(--...)]` 或现有 palette 类替代
4. Tailwind v4 可通过 `theme()` 暴露，使用 `text-[theme(--color-success)]` 等

**优先级**：🔴 **P0 - 高优先级**

---

### 1.2 类型安全问题 - 使用 any 和禁用 ESLint 规则
**问题描述**：
- 规范要求：**严禁 any**
- 当前状态：使用 `as any` 类型断言和 `eslint-disable` 禁用规则
- 影响：失去类型安全保障，可能导致运行时错误

**涉及文件**：
- `src/hooks/tradingState/eventHandler.ts` (第 49-50 行：`// eslint-disable-next-line @typescript-eslint/no-explicit-any` 且 `const e = event as any;`)
- `src/workers/marketSimulation/history.ts` (可能还有其他)

**处理建议**：
1. 为 `event` 明确定义联合类型（覆盖 `positionOpened` 等事件形态）
2. 移除 `any` 与 `eslint-disable`
3. 使用类型守卫（type guards）进行类型检查

**优先级**：🔴 **P0 - 高优先级**

---

### 1.3 日志规范问题 - 大量使用 console.log
**问题描述**：
- 规范要求：**no-console 配置（允许 warn/error）**
- 当前状态：大量使用 `console.log`（52 处），违背 ESLint 配置
- 影响：生产环境可能泄露敏感信息，影响性能

**涉及文件**（10个文件）：
- `src/hooks/useWasmEngine.ts` (8处)
- `src/hooks/useBinanceMarket.ts` (20处)
- `src/services/binance/api.ts` (6处)
- `src/services/binance/websocket.ts` (4处)
- `src/hooks/useMockMarket.ts` (3处)
- `src/hooks/useMarketData.ts` (3处)
- `src/hooks/tradingState/eventHandler.ts` (1处)
- `src/hooks/tradingEngine/wasmSingleton.ts` (5处)
- `src/types/wasm.ts` (1处)
- `src/services/binance/index.ts` (1处)

**处理建议**：
1. 引入轻量 logger 包装（封装至 `src/utils/logger.ts`）
2. 在 DEV 环境输出，生产环境静默
3. 或统一改为 `console.warn`/`console.error` 并打上特定前缀
4. 必要时用 `debug` 标记并可控开关

**优先级**：🔴 **P0 - 高优先级**

---

## 二、技术栈约束问题（高优先级）

### 2.1 服务端状态管理 - 未使用 TanStack Query
**问题描述**：
- 规范要求：**服务端状态强制使用 TanStack Query**
- 当前状态：所有数据获取都使用自定义 Hook（`useBinanceMarket`, `useMockMarket`, `useMarketData`）
- 影响：缺少缓存、自动重试、后台刷新等标准功能

**涉及文件**：
- `src/hooks/useBinanceMarket.ts` (693行)
- `src/hooks/useMockMarket.ts` (148行)
- `src/hooks/useMarketData.ts` (186行)
- `src/services/binance/api.ts`

**处理建议**：
- 将 Binance API 调用迁移到 TanStack Query
- 使用 `useQuery` 管理历史 K 线数据
- 使用 `useMutation` 处理需要副作用的操作
- 保留 WebSocket 实时数据流（Worker 模式）

**优先级**：🔴 **P0 - 高优先级**

---

### 2.2 全局 UI 状态 - 未使用 Zustand
**问题描述**：
- 规范要求：**全局 UI 状态使用 Zustand**
- 当前状态：使用 React Context (`ToastContext`) 和组件内部状态
- 影响：状态管理分散，难以追踪和调试

**涉及文件**：
- `src/components/Toast/ToastContext.tsx`
- `src/App.tsx` (多处 useState)

**处理建议**：
- 将 Toast 状态迁移到 Zustand store
- 将数据源切换状态（`dataSource`）迁移到 Zustand
- 将图表配置（时间周期、指标）迁移到 Zustand（可选，如果需要在多个组件间共享）

**优先级**：🟡 **P1 - 中优先级**

---

### 2.3 运行时数据校验 - 未使用 Zod
**问题描述**：
- 规范要求：**使用 Zod 进行运行时数据校验，确保前后端契约一致性**
- 当前状态：没有运行时校验，仅依赖 TypeScript 类型
- 影响：运行时数据错误可能导致崩溃，无法捕获 API 返回格式变化

**涉及文件**：
- `src/services/binance/api.ts`
- `src/services/binance/websocket.ts`
- `src/types/index.ts`
- `src/types/trading.ts`
- `src/types/wasm.ts`

**处理建议**：
- 为所有 API 响应定义 Zod Schema
- 在数据接收时进行校验
- 为 WASM 返回的数据定义 Schema（如果可能）

**优先级**：🟡 **P1 - 中优先级**

---

### 2.4 资源管理问题 - 定时器清理不完整
**问题描述**：
- 规范要求：**必须显式清理资源**（定时器、事件监听、订阅）
- 当前状态：部分定时器有清理，但存在潜在问题

**涉及文件**：

#### 2.4.1 useBinanceMarket.ts
```tsx
// 第 600-628 行：定时更新 OrderBook
tickIntervalRef.current = setInterval(() => {
  // ...
}, opts.tickInterval);

// 第 667-677 行：清理
useEffect(() => {
  return () => {
    if (wsRef.current) {
      wsRef.current.stop();
    }
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
    }
  };
}, []);
```
**问题**：✅ 清理逻辑存在，但依赖数组为空，可能在某些情况下不执行。

#### 2.4.2 useCandleData.ts
```tsx
// 第 181-192 行：定时器管理
useEffect(() => {
  if (useRustCandles) return;
  timerRef.current = window.setInterval(onIntervalTick, CANDLE_INTERVAL_MS);
  return () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
}, [onIntervalTick, useRustCandles]);
```
**问题**：✅ 清理逻辑正确，但 `onIntervalTick` 在依赖数组中，可能导致频繁创建/销毁定时器。

#### 2.4.3 useTradingActions.ts
```tsx
// 第 111-113 行：防抖定时器
const leverageToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// 第 270-276 行：使用但未清理
leverageToastTimerRef.current = setTimeout(() => {
  toast.success(`杠杆已设置为 ${leverage}x`);
  leverageToastTimerRef.current = null;
}, 300);
```
**问题**：⚠️ 防抖定时器在组件卸载时可能未清理（虽然设置了 `null`，但最好在 cleanup 中显式清理）。

**处理建议**：
1. 确保所有 `setInterval`/`setTimeout` 都有对应的清理逻辑
2. 在组件卸载时清理所有定时器
3. 使用 `useRef` 存储定时器 ID，避免闭包问题
4. 考虑使用 `useEffect` 的 cleanup 函数统一管理

**优先级**：🔴 **P0 - 高优先级**

---

## 三、性能优化证据缺失（中优先级）

### 2.1 过度使用 useMemo/useCallback
**问题描述**：
- 规范要求：**性能优化必须有明确证据**（频繁渲染、列表场景、已知瓶颈）
- 当前状态：大量使用 `useMemo` 和 `useCallback`，但缺少证据说明

**涉及文件**：
- `src/App.tsx` (多处 useCallback)
- `src/components/Dashboard/Chart/LightweightChart/index.tsx` (useMemo, useCallback)
- `src/components/Dashboard/OrderBook.tsx` (useMemo, memo)
- `src/hooks/useWasmEngine.ts` (useMemo, useCallback)
- `src/hooks/useCandleData.ts` (useMemo)
- `src/components/Dashboard/Trade/TradeForm.tsx` (memo, useMemo, useCallback)

**具体问题**：

#### 2.1.1 App.tsx
```tsx
// 第 134-141 行：handleTimeframeChange
const handleTimeframeChange = useCallback(
  (timeframe: Timeframe) => {
    setActiveTimeframe(timeframe);
    setTimeframe?.(timeframe);
  },
  [setTimeframe],
);
```
**问题**：`setTimeframe` 来自 `useWasmEngine`，如果它本身是稳定的，这个 `useCallback` 可能不必要。

#### 2.1.2 OrderBook.tsx
```tsx
// 第 218-243 行：processedBids/processedAsks 计算
const { processedBids, processedAsks, maxCumulativeVolume } = useMemo(() => {
  // ... 复杂计算
}, [bids, asks, visibleRows]);
```
**问题**：这个 `useMemo` 是合理的（列表计算），但需要确认 `bids`/`asks` 是否频繁变化。

#### 2.1.3 TradeForm.tsx
```tsx
// 第 681 行：memo(TradeForm)
export default memo(TradeForm);
```
**问题**：需要确认 TradeForm 是否频繁重渲染，以及 props 是否稳定。

**处理建议**：
1. 审查每个 `useMemo`/`useCallback`/`memo` 的使用场景
2. 添加注释说明为什么需要性能优化（如："防止高频 tick 数据导致重渲染"）
3. 移除没有明确证据的优化
4. 使用 React DevTools Profiler 验证优化效果

**优先级**：🟡 **P1 - 中优先级**

---

## 四、代码风格问题（中优先级）

### 4.1 Tailwind 魔术数字/任意尺寸
**问题描述**：
- 规范要求：**必须显式清理资源**（定时器、事件监听、订阅）
- 当前状态：部分定时器有清理，但存在潜在问题

**涉及文件**：

#### 3.1.1 useBinanceMarket.ts
```tsx
// 第 600-628 行：定时更新 OrderBook
tickIntervalRef.current = setInterval(() => {
  // ...
}, opts.tickInterval);

// 第 667-677 行：清理
useEffect(() => {
  return () => {
    if (wsRef.current) {
      wsRef.current.stop();
    }
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
    }
  };
}, []);
```
**问题**：✅ 清理逻辑存在，但依赖数组为空，可能在某些情况下不执行。

#### 3.1.2 useCandleData.ts
```tsx
// 第 181-192 行：定时器管理
useEffect(() => {
  if (useRustCandles) return;
  timerRef.current = window.setInterval(onIntervalTick, CANDLE_INTERVAL_MS);
  return () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
}, [onIntervalTick, useRustCandles]);
```
**问题**：✅ 清理逻辑正确，但 `onIntervalTick` 在依赖数组中，可能导致频繁创建/销毁定时器。

#### 3.1.3 useTradingActions.ts
```tsx
// 第 111-113 行：防抖定时器
const leverageToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// 第 270-276 行：使用但未清理
leverageToastTimerRef.current = setTimeout(() => {
  toast.success(`杠杆已设置为 ${leverage}x`);
  leverageToastTimerRef.current = null;
}, 300);
```
**问题**：⚠️ 防抖定时器在组件卸载时可能未清理（虽然设置了 `null`，但最好在 cleanup 中显式清理）。

#### 3.1.4 useUnifiedChartSetup.ts
```tsx
// 第 369-377 行：window resize 定时器
let windowResizeTimer: ReturnType<typeof setTimeout> | null = null;
const handleWindowResize = () => {
  if (windowResizeTimer !== null) clearTimeout(windowResizeTimer);
  windowResizeTimer = setTimeout(() => {
    windowResizeTimer = null;
    doResize();
  }, 150);
};

// 第 388-404 行：清理
return () => {
  // ...
  if (windowResizeTimer !== null) {
    clearTimeout(windowResizeTimer);
    windowResizeTimer = null;
  }
  // ...
};
```
**问题**：✅ 清理逻辑正确。

**处理建议**：
1. 确保所有 `setInterval`/`setTimeout` 都有对应的清理逻辑
2. 在组件卸载时清理所有定时器
3. 使用 `useRef` 存储定时器 ID，避免闭包问题
4. 考虑使用 `useEffect` 的 cleanup 函数统一管理

**优先级**：🟡 **P1 - 中优先级**

---

### 4.2 内联样式中的颜色/阴影
**问题描述**：
- 规范要求：**事件监听必须有释放路径**

**涉及文件**：

#### 3.2.1 OrderBook.tsx
```tsx
// 第 180-188 行：useIsMobile Hook
function useIsMobile(): boolean {
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return isMobile;
}
```
**问题**：✅ 清理逻辑正确。

#### 3.2.2 useUnifiedChartSetup.ts
```tsx
// 第 384 行：添加监听器
window.addEventListener('resize', handleWindowResize);

// 第 399 行：清理
window.removeEventListener('resize', handleWindowResize);
```
**问题**：✅ 清理逻辑正确，但需要注意 `handleWindowResize` 的引用稳定性。

**处理建议**：
- ✅ 当前实现基本正确，但需要确保所有事件监听器都有清理

**优先级**：🟡 **P1 - 中优先级**

---

### 4.3 事件处理命名与内联函数
**问题描述**：
- 规范要求：**订阅必须有释放路径**

**涉及文件**：

#### 3.3.1 useBinanceMarket.ts
```tsx
// 第 649-652 行：停止 WebSocket
if (wsRef.current) {
  wsRef.current.stop();
  wsRef.current = null;
}
```
**问题**：✅ `BinanceWebSocket.stop()` 应该会清理连接，但需要确认内部实现。

#### 3.3.2 services/binance/websocket.ts
```tsx
// 第 143-158 行：stop 方法
stop(): void {
  this.options.reconnect = false;
  if (this.reconnectTimer) {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }
  if (this.ws) {
    this.ws.close();
    this.ws = null;
  }
  this.status = 'disconnected';
  this.streams = [];
}
```
**问题**：✅ 清理逻辑完整。

**处理建议**：
- ✅ 当前实现正确

**优先级**：🟢 **P2 - 低优先级**

---

## 五、自定义 Hook 边界问题（中优先级）

### 4.1 Hook 包含业务决策逻辑
**问题描述**：
- 规范要求：**自定义 Hook 不负责业务决策**，Hook 只封装副作用、状态协调、可复用行为
- 当前状态：部分 Hook 包含业务判断逻辑

**涉及文件**：

#### 4.1.1 useWasmEngine.ts
```tsx
// 第 297-395 行：处理 Tick 数据
useEffect(() => {
  // ...
  // 连续错误过多时，尝试重新初始化引擎
  if (errorCountRef.current >= MAX_ERRORS) {
    console.warn('[useWasmEngine] 连续错误过多，尝试重新初始化...');
    // ... 重新初始化逻辑
  }
}, [latestData, toast]);
```
**问题**：⚠️ 错误处理策略（何时重试、何时放弃）属于业务决策，应该在组件层或配置中定义。

#### 4.1.2 useMarketData.ts
```tsx
// 第 96-120 行：数据源切换时的强制停止逻辑
useEffect(() => {
  if (prevSourceRef.current !== source) {
    // 强制停止旧数据源
    if (prevSourceRef.current === 'mock') {
      mockData.stop();
      setTimeout(() => {
        if (mockData.isRunning) {
          mockData.stop();
        }
      }, 200);
    }
    // ...
  }
}, [source, mockData, binanceData]);
```
**问题**：⚠️ 数据源切换策略（延迟停止、多次停止）属于业务决策。

**处理建议**：
1. 将业务决策逻辑提取到组件层或配置对象
2. Hook 只负责执行操作，不决定"何时"和"如何"
3. 例如：将错误重试策略作为参数传入，而不是硬编码在 Hook 中

**优先级**：🟡 **P1 - 中优先级**

---

## 六、代码行数问题（低优先级）

### 5.1 超过 300 行的文件
**问题描述**：
- 规范要求：**单文件代码行数 > 300 行时，优先考虑模块化**

**涉及文件**（基于已读取的文件估算）：

1. **useWasmEngine.ts** - 约 611 行
   - **问题**：超过 300 行，逻辑复杂
   - **建议**：按功能拆分：
     - `useWasmEngineCore.ts` - 核心引擎初始化
     - `useWasmEngineMarket.ts` - 市场数据处理
     - `useWasmEngineTrading.ts` - 交易状态管理
     - 或保持现状（如果逻辑线性且无状态分叉）

2. **useBinanceMarket.ts** - 约 693 行
   - **问题**：超过 300 行，逻辑复杂
   - **建议**：拆分：
     - `useBinanceMarketCore.ts` - 核心数据流
     - `useBinanceMarketHistory.ts` - 历史数据获取
     - `useBinanceMarketWebSocket.ts` - WebSocket 管理
     - 或保持现状（如果逻辑线性）

3. **App.tsx** - 约 389 行
   - **问题**：接近 300 行，但主要是 UI 组合
   - **建议**：暂不拆分（UI 组件，逻辑线性）

4. **TradeForm.tsx** - 约 682 行
   - **问题**：超过 300 行
   - **建议**：拆分子组件：
     - `TradeFormHeader.tsx` - 余额显示
     - `TradeFormInputs.tsx` - 输入区域
     - `TradeFormPositions.tsx` - 仓位列表
     - 或保持现状（如果逻辑线性）

5. **useUnifiedChartSetup.ts** - 约 418 行
   - **问题**：超过 300 行
   - **建议**：拆分：
     - `useChartInstance.ts` - Chart 实例管理
     - `useChartSeries.ts` - Series 创建
     - `useChartEvents.ts` - 事件订阅
     - 或保持现状（如果逻辑线性）

**处理建议**：
1. 评估每个文件的逻辑复杂度
2. 如果逻辑线性、无状态分叉、无复用预期，允许暂缓拆分
3. 如果逻辑复杂、有多个职责，按逻辑边界拆分

**优先级**：🟢 **P2 - 低优先级**

---

## 七、架构问题（低优先级）

### 6.1 Feature-First 架构检查
**问题描述**：
- 规范要求：**Frontend 按功能特性（Features）组织**

**当前结构**：
```
src/
  components/
    Dashboard/        # ✅ 按功能组织
      Chart/
      Trade/
      OrderBook.tsx
      StatsPanel.tsx
    Layout/           # ✅ 按功能组织
    Toast/            # ✅ 按功能组织
  hooks/              # ⚠️ 按技术层组织（Type-First）
    candle/
    tradingEngine/
    tradingState/
  services/           # ⚠️ 按技术层组织
    binance/
  types/              # ⚠️ 按技术层组织
  workers/            # ✅ 按功能组织
```

**问题**：
- `hooks/` 目录按技术层组织，而不是按功能
- `services/` 目录按技术层组织
- `types/` 目录按技术层组织

**处理建议**：
- 考虑重构为 Feature-First，但需要评估成本
- 如果当前结构清晰且易于维护，可以保持现状
- 规范允许根据项目规模、人员、阶段做取舍

**优先级**：🟢 **P2 - 低优先级**

---

## 八、其他问题

### 7.1 缺少错误边界
**问题描述**：
- 没有发现 React Error Boundary 的使用
- 建议添加全局错误边界，防止整个应用崩溃

**优先级**：🟡 **P1 - 中优先级**

---

### 7.2 类型安全
**问题描述**：
- 部分地方使用了类型断言（`as unknown as`），可能隐藏类型错误
- 例如：`src/hooks/useWasmEngine.ts` 第 273 行、第 344 行

**优先级**：🟢 **P2 - 低优先级**

---

## 总结

### 优先级分布
- 🔴 **P0 - 高优先级**：5 项
  - 代码规范（颜色硬编码、类型安全、日志规范）
  - 技术栈约束（TanStack Query）
  - 资源管理（定时器清理）
- 🟡 **P1 - 中优先级**：7 项
  - 技术栈约束（Zustand、Zod）
  - 性能优化证据
  - 自定义 Hook 边界
  - 错误边界
  - 代码风格（Tailwind 魔术数字、内联样式）
- 🟢 **P2 - 低优先级**：4 项
  - 代码行数
  - 架构重构
  - 事件处理命名
  - Promise 工具函数

### 建议处理顺序
1. **第一步**：修复代码规范问题（颜色硬编码、类型安全、日志规范）⭐ **新增**
2. **第二步**：修复资源管理问题（定时器清理）
3. **第三步**：引入 TanStack Query（服务端状态管理）
4. **第四步**：审查并优化性能优化使用（添加证据说明或移除）
5. **第五步**：引入 Zustand 和 Zod
6. **第六步**：重构自定义 Hook 边界
7. **第七步**：修复代码风格问题（Tailwind 魔术数字、内联样式）⭐ **新增**
8. **第八步**：评估代码行数，按需拆分
9. **第九步**：架构重构（可选）

---

## 附录：文件行数统计（估算）

基于已读取的文件：
- `useBinanceMarket.ts`: ~693 行
- `useWasmEngine.ts`: ~611 行
- `TradeForm.tsx`: ~682 行
- `useUnifiedChartSetup.ts`: ~418 行
- `App.tsx`: ~389 行
- `useMarketData.ts`: ~186 行
- `useCandleData.ts`: ~298 行
- `useTradingActions.ts`: ~388 行
- `OrderBook.tsx`: ~395 行
- `useMockMarket.ts`: ~148 行

建议使用工具精确统计所有文件行数。

