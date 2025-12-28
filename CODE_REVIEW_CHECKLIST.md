# 代码审查处理清单

## 🔴 P0 - 高优先级（必须修复）

### 1. 修复硬编码颜色问题（代码规范）
- [ ] 扫描所有 `bg-[#...]`、`text-[#...]`、`border-[#...]` 使用
- [ ] 扫描所有内联样式中的颜色硬编码
- [ ] 将常用的 Binance 色系映射到 theme 或 CSS 变量（如 `--color-success`、`--color-danger`、`--color-warning`）
- [ ] 替换 `Toast.tsx` 中的颜色（第 32-49 行）
- [ ] 替换 `useWasmEngine.ts` 中的颜色（第 513-515 行）
- [ ] 替换 `StatsPanel.tsx` 中的颜色（第 73-75, 88-96 行）
- [ ] 替换 `LoadingScreen.tsx` 中的颜色（第 7-10 行）
- [ ] 替换 `LeverageSlider.tsx` 中的颜色和内联样式
- [ ] 替换 `MobileTradebar.tsx` 中的颜色
- [ ] 替换 `PositionCard.tsx` 中的颜色和内联样式
- [ ] 替换 `Header.tsx` 中的颜色
- [ ] 替换 `App.tsx` 和 `TradeForm.tsx` 中的颜色
- [ ] 使用 `text-[var(--...)]`/`bg-[var(--...)]` 或现有 palette 类替代
- [ ] 测试主题切换功能

**涉及文件**（15个文件）：
- `src/components/Toast/Toast.tsx`
- `src/hooks/useWasmEngine.ts`
- `src/components/Dashboard/StatsPanel.tsx`
- `src/components/Layout/LoadingScreen.tsx`
- `src/components/Dashboard/Trade/LeverageSlider.tsx`
- `src/components/Dashboard/Trade/MobileTradebar.tsx`
- `src/components/Dashboard/Trade/PositionCard.tsx`
- `src/components/Layout/Header.tsx`
- `src/App.tsx`
- `src/components/Dashboard/Trade/TradeForm.tsx`
- 其他组件文件

**预计工作量**：2-3 天

---

### 2. 修复类型安全问题（代码规范）
- [ ] 检查 `src/hooks/tradingState/eventHandler.ts` 第 49-50 行
- [ ] 为 `event` 明确定义联合类型（覆盖 `positionOpened` 等事件形态）
- [ ] 移除 `as any` 与 `eslint-disable`
- [ ] 使用类型守卫（type guards）进行类型检查
- [ ] 检查其他文件中的 `as any` 使用
- [ ] 测试类型安全

**涉及文件**：
- `src/hooks/tradingState/eventHandler.ts`
- `src/workers/marketSimulation/history.ts`（可能还有其他）

**预计工作量**：0.5 天

---

### 3. 修复日志规范问题（代码规范）
- [ ] 创建 `src/utils/logger.ts`（轻量 logger 包装）
- [ ] 实现 DEV 环境输出，生产环境静默
- [ ] 替换 `useWasmEngine.ts` 中的 8 处 `console.log`
- [ ] 替换 `useBinanceMarket.ts` 中的 20 处 `console.log`
- [ ] 替换 `services/binance/api.ts` 中的 6 处 `console.log`
- [ ] 替换 `services/binance/websocket.ts` 中的 4 处 `console.log`
- [ ] 替换 `useMockMarket.ts` 中的 3 处 `console.log`
- [ ] 替换 `useMarketData.ts` 中的 3 处 `console.log`
- [ ] 替换其他文件中的 `console.log`
- [ ] 或统一改为 `console.warn`/`console.error` 并打上特定前缀
- [ ] 测试日志输出（DEV/PROD 环境）

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

**预计工作量**：1 天

---

### 4. 修复定时器清理问题（资源管理）
- [ ] 检查 `useBinanceMarket.ts` 的定时器清理逻辑
- [ ] 修复 `useTradingActions.ts` 的防抖定时器清理
- [ ] 优化 `useCandleData.ts` 的定时器依赖
- [ ] 添加测试验证清理逻辑

**涉及文件**：
- `src/hooks/useBinanceMarket.ts` (第 600-628, 667-677 行)
- `src/hooks/useTradingActions.ts` (第 111-113, 270-276 行)
- `src/hooks/useCandleData.ts` (第 181-192 行)

**预计工作量**：0.5 天

---

### 5. 引入 TanStack Query（服务端状态管理）
- [ ] 安装 `@tanstack/react-query`
- [ ] 在 `main.tsx` 中配置 `QueryClientProvider`
- [ ] 重构 `useBinanceMarket.ts`，使用 `useQuery` 管理历史 K 线
- [ ] 重构 `useMarketData.ts`，整合 TanStack Query
- [ ] 保留 WebSocket 实时数据流（Worker 模式）
- [ ] 测试数据流切换和错误处理

**涉及文件**：
- `src/hooks/useBinanceMarket.ts`
- `src/hooks/useMarketData.ts`
- `src/services/binance/api.ts`
- `src/main.tsx`

**预计工作量**：2-3 天

---

## 🟡 P1 - 中优先级（建议修复）

### 6. 引入 Zustand（全局 UI 状态）
- [ ] 安装 `zustand`
- [ ] 创建 `src/stores/toastStore.ts`
- [ ] 创建 `src/stores/appStore.ts`（数据源切换）
- [ ] 重构 `ToastContext.tsx` 使用 Zustand
- [ ] 重构 `App.tsx` 的数据源状态管理
- [ ] 移除 `ToastContext.tsx`（如果不再需要）

**涉及文件**：
- `src/components/Toast/ToastContext.tsx`
- `src/App.tsx`
- `src/stores/` (新建)

**预计工作量**：1 天

---

### 7. 引入 Zod（运行时数据校验）
- [ ] 安装 `zod`
- [ ] 创建 `src/schemas/binance.ts`（Binance API Schema）
- [ ] 创建 `src/schemas/trading.ts`（交易数据 Schema）
- [ ] 在 `services/binance/api.ts` 中添加校验
- [ ] 在 `services/binance/websocket.ts` 中添加校验
- [ ] 为 WASM 返回数据添加 Schema（如果可能）

**涉及文件**：
- `src/services/binance/api.ts`
- `src/services/binance/websocket.ts`
- `src/types/index.ts`
- `src/schemas/` (新建)

**预计工作量**：1-2 天

---

### 8. 审查性能优化使用（添加证据或移除）
- [ ] 审查 `App.tsx` 的 `useCallback` 使用
- [ ] 审查 `OrderBook.tsx` 的 `useMemo` 使用
- [ ] 审查 `TradeForm.tsx` 的 `memo` 使用
- [ ] 为每个优化添加注释说明原因
- [ ] 使用 React DevTools Profiler 验证效果
- [ ] 移除没有明确证据的优化

**涉及文件**：
- `src/App.tsx`
- `src/components/Dashboard/OrderBook.tsx`
- `src/components/Dashboard/Trade/TradeForm.tsx`
- `src/components/Dashboard/Chart/LightweightChart/index.tsx`
- `src/hooks/useWasmEngine.ts`
- `src/hooks/useCandleData.ts`

**预计工作量**：1 天

---

### 9. 重构自定义 Hook 边界
- [ ] 将 `useWasmEngine.ts` 的错误处理策略提取为配置
- [ ] 将 `useMarketData.ts` 的数据源切换策略提取为配置
- [ ] 确保 Hook 只负责执行，不负责业务决策
- [ ] 在组件层显式表达业务逻辑

**涉及文件**：
- `src/hooks/useWasmEngine.ts` (第 297-395 行)
- `src/hooks/useMarketData.ts` (第 96-120 行)

**预计工作量**：1 天

---

### 10. 修复 Tailwind 魔术数字/任意尺寸
- [ ] 扫描所有 `[calc(...)]` 和 `[...px]` 使用
- [ ] 将常见 `[px]` 尺寸改为标准刻度或 CSS 变量
- [ ] 替换 `App.tsx` 中的 `pb-[101px]`、`h-[214px]`、`max-w-[120px]`、`xl:min-w-[200px]` 等
- [ ] 替换 Mobile/Trade 组件中的魔术数字
- [ ] 通过 CSS 变量表达业务约束尺寸（如 `--orderbook-h`），再用 `h-[var(--orderbook-h)]`
- [ ] 测试响应式布局

**涉及文件**：
- `src/App.tsx`
- `src/components/Dashboard/Trade/MobileTradebar.tsx`
- `src/components/Dashboard/Trade/TradeForm.tsx`
- 其他组件文件

**预计工作量**：0.5 天

---

### 11. 修复内联样式中的颜色/阴影
- [ ] 扫描所有内联 `style` 中的颜色和阴影
- [ ] 将 `PositionCard.tsx` 中的 `style={{ color: '#848e9c' }}` 转为 CSS 变量或 Tailwind 类
- [ ] 将 `LeverageSlider.tsx` 中的 `textShadow` 和 `boxShadow` rgba 转为 `shadow`/`drop-shadow`/`ring` 类组合
- [ ] 测试视觉效果一致性

**涉及文件**：
- `src/components/Dashboard/Trade/PositionCard.tsx` (第 195 行)
- `src/components/Dashboard/Trade/LeverageSlider.tsx` (第 64/101 行)
- 其他文件

**预计工作量**：0.5 天

---

### 12. 添加错误边界
- [ ] 创建 `src/components/Layout/ErrorBoundary.tsx`
- [ ] 在 `App.tsx` 中包裹错误边界
- [ ] 添加错误日志记录
- [ ] 测试错误边界功能

**涉及文件**：
- `src/components/Layout/ErrorBoundary.tsx` (新建)
- `src/App.tsx`

**预计工作量**：0.5 天

---

## 🟢 P2 - 低优先级（可选）

### 13. 评估代码行数，按需拆分
- [ ] 统计所有文件行数
- [ ] 评估 `useWasmEngine.ts` (611行) 是否需要拆分
- [ ] 评估 `useBinanceMarket.ts` (693行) 是否需要拆分
- [ ] 评估 `TradeForm.tsx` (682行) 是否需要拆分
- [ ] 评估 `useUnifiedChartSetup.ts` (418行) 是否需要拆分
- [ ] 如果逻辑线性且无状态分叉，保持现状

**涉及文件**：
- 所有超过 300 行的文件

**预计工作量**：1-2 天（如果需要拆分）

---

### 14. 改进事件处理命名
- [ ] 扫描所有内联 `onClick={() => ...}` 使用
- [ ] 对频繁渲染或复杂回调抽出 `useCallback(handleXxx)`
- [ ] 统一使用 `handleXxx` 前缀命名
- [ ] 其余保留内联可作为低风险项逐步收敛

**预计工作量**：1 天

---

### 15. 提取 Promise 工具函数
- [ ] 检查 `services/binance/api.ts` 中的 `new Promise(setTimeout)` 使用
- [ ] 提取 `sleep(ms)` 至 `src/utils/async.ts`
- [ ] 统一调用，便于测试与平台化
- [ ] 替换所有相关使用

**涉及文件**：
- `src/services/binance/api.ts`
- `src/utils/async.ts` (新建)

**预计工作量**：0.5 天

---

### 16. 架构重构（Feature-First）
- [ ] 评估当前架构的可维护性
- [ ] 如果决定重构，规划新的目录结构
- [ ] 逐步迁移代码（不强制）

**预计工作量**：3-5 天（如果决定重构）

---

### 17. 类型安全改进
- [ ] 减少 `as unknown as` 类型断言的使用
- [ ] 改进 WASM 类型定义
- [ ] 添加更严格的类型检查

**涉及文件**：
- `src/hooks/useWasmEngine.ts`
- `src/types/wasm.ts`

**预计工作量**：0.5 天

---

## 总结

### 总预计工作量
- **P0（必须）**：6-8 天
  - 代码规范（颜色、类型、日志）：3.5-4.5 天
  - 资源管理：0.5 天
  - TanStack Query：2-3 天
- **P1（建议）**：6-8 天
  - Zustand：1 天
  - Zod：1-2 天
  - 性能优化审查：1 天
  - Hook 边界：1 天
  - 代码风格（Tailwind、内联样式）：1 天
  - 错误边界：0.5 天
- **P2（可选）**：5-8 天

### 建议执行顺序
1. **Week 1**：P0 代码规范任务（颜色、类型、日志）⭐ **优先**
2. **Week 2**：P0 技术栈任务（TanStack Query + 资源管理）
3. **Week 3**：P1 任务（Zustand + Zod + 性能优化审查）
4. **Week 4**：P1 任务（Hook 边界 + 代码风格 + 错误边界）
5. **Week 5+**：P2 任务（按需执行）

### 注意事项
- 每个任务完成后进行测试
- 保持代码可运行状态
- 优先保证功能正确性，再优化架构
- 根据实际项目进度调整优先级
