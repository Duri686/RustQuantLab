# Staged Impact Risk List

> **Date**: 2026-02-07  
> **Branch**: `main` (ahead of origin by 1 commit)  
> **Staged Files**: 44 (11 Added, 31 Modified, 2 Deleted)

---

## 🔴 Blockers (Must Fix)

**无 Blocker。** 本次 staged changes 未引入新的 TSC 错误。

---

## 🟡 Warnings

### 1. Boundary: `src/types/index.ts` — 新增 `on_tick_full` 到 `MarketEngineInstance`

- **变更**: 接口新增 `on_tick_full` 方法
- **风险**: 所有实现 `MarketEngineInstance` 的对象必须提供此方法
- **消费者**: `wasmSingleton.ts` (已有预存 TSC 错误, 非本次引入)
- **状态**: ⚠️ `WasmMarketEngine`(wasm.ts）已同步添加 `on_tick_full`, 类型一致

### 2. Boundary: `src/types/wasm.ts` — 新增 `WasmTickFullResult` + `on_tick_full`

- **变更**: 新增合并 Tick 结果类型，减少 3→1 次 WASM 跨边界调用
- **风险**: Rust 侧 `TickFullResult` 的 serde 字段名必须与 TS 类型完全匹配
- **验证**: Rust `core/src/engine/types.rs` 使用 `#[serde(rename_all = "camelCase")]` ✅ 与 TS `camelCase` 一致
- **状态**: ⚠️ 需要 Rust `cargo build --target wasm32` 验证编译

### 3. Boundary: `src/hooks/tradingState/types.ts` — 新增 `EstimateLiquidationResult`

- **变更**: `TradingWasmEngine` 接口新增 `estimate_liquidation_price` 方法
- **风险**: Rust 侧必须 `#[wasm_bindgen]` 导出该方法
- **消费者**: `useTradingActions.ts` → `App.tsx` → `TradePanel.tsx`
- **状态**: ⚠️ 链路完整, 但需 Rust 编译验证

### 4. Boundary: `src/components/Dashboard/Trade/index.ts` — Barrel 重导出变更

- **变更**: `TradeForm` → `TradePanel`, 删除 `MobileTradebar` 导出
- **风险**: 任何直接引用 `TradeForm` 或 `MobileTradebar` 的消费者会断裂
- **消费者**: `App.tsx` 已同步更新为 `TradePanel` ✅
- **验证**: `grep -r "TradeForm\|MobileTradebar" src/ --include="*.tsx" --include="*.ts"` 无残留引用 ✅
- **状态**: ✅ 安全

### 5. Destructive: 删除 `MobileTradebar.tsx` + `TradeForm.tsx`

- **变更**: 两个组件文件被删除, 由 `TradePanel.tsx` 替代
- **风险**: barrel `index.ts` 已移除导出, `App.tsx` 已切换导入
- **状态**: ✅ 安全 (已由 Warning #4 验证)

### 6. Core: `src/hooks/useWasmEngine.ts` — 重构 on_tick 调用链

- **变更**: 3 次独立 WASM 调用 (`on_tick` + `get_active_candles` + `get_trading_state`) → 1 次 `on_tick_full`
- **风险**: 如果 Rust 侧 `on_tick_full` 未实现，运行时崩溃
- **回退路径**: 可快速恢复为 3 次调用模式
- **状态**: ⚠️ 需 Rust WASM 编译验证

### 7. Core: `src/hooks/tradingEngine/useTradingActions.ts` — debounce 重构 + 新功能

- **变更**:
  - 手动 `setTimeout` debounce → `useDebounceFn` (ahooks)
  - 新增 `estimateLiquidation` action
- **风险**: `useDebounceFn` 的 deps 行为与手动 setTimeout 不同 (自动清理)
- **状态**: ✅ ahooks 已在 package.json 中, 行为更安全

### 8. Core: `core/src/engine/types.rs` — Rust 新增类型

- **变更**: `EstimateLiquidationResult`, `TickFullResult`, `PRIMARY_SYMBOL` 常量
- **风险**: 这些是新增类型，不影响现有接口
- **状态**: ✅ 仅新增, 无破坏性

### 9. Core: `core/src/engine/mod.rs` — 新增 `error` 子模块

- **变更**: `pub mod error;`
- **风险**: 新增模块, 不影响现有导出
- **状态**: ✅ 安全

---

## 🟢 Info (Low Risk / Leaf Changes)

| File | Type | Description |
| :--- | :---: | :--- |
| `core/Cargo.toml` | M | 依赖版本更新 |
| `core/src/engine/data/candles.rs` | M | K 线数据处理内部优化 |
| `core/src/engine/data/tick_data.rs` | M | Tick 数据内部优化 |
| `core/src/engine/market_engine/*.rs` | M | 市场引擎内部重构 (3 files) |
| `core/src/engine/trading/*.rs` | M | 交易模块内部重构 (4 files) |
| `core/src/indicators/ma.rs` | M | MA 指标内部优化 |
| `core/src/indicators/macd.rs` | M | MACD 指标内部优化 |
| `core/src/models.rs` | M | Rust 模型层修改 |
| `core/src/trading/position.rs` | M | 仓位逻辑内部修改 |
| `core/RUST_AUDIT_REPORT.md` | A | 文档: Rust 审计报告 |
| `core/src/engine/error.rs` | A | 新增错误类型模块 |
| `docs/design/open-position-design.md` | A | 文档: 开仓设计文档 |
| `src/components/Dashboard/Trade/TradePanel.tsx` | A | 新组件: 统一交易面板 |
| `src/components/Dashboard/Trade/components/*.tsx` | A | 新组件: 拆分子组件 (4 files) |
| `src/config/tradingConfig.ts` | A | 新增: 交易配置常量 |
| `src/hooks/ui/useBottomSheet.ts` | A | 新增: Bottom Sheet hook |
| `src/components/Dashboard/Chart/ChartToolbar.tsx` | M | 新增 candleCountdown prop |
| `src/components/Dashboard/Trade/LeverageSlider.tsx` | M | 内部样式调整 |
| `src/components/Layout/Header.tsx` | M | Header 展示优化 |
| `src/hooks/useCandleData.ts` | M | K 线数据 hook 优化 |
| `src/hooks/useMarketStats.ts` | M | 新增 timeframe 参数 |
| `src/index.css` | M | 样式 token 更新 |
| `src/App.tsx` | M | 布局重构: TradeForm→TradePanel, 移动端统一 |
| `package.json` / `package-lock.json` / `yarn.lock` | M/A | 依赖更新 |

---

## Safety Judgment

| Check | Result |
| :--- | :--- |
| 🔴 Blockers | **0** |
| TSC 新增错误 | **0** (全部 12 个为预存错误) |
| Barrel 引用一致性 | ✅ 无残留 TradeForm/MobileTradebar 引用 |
| Rust ↔ TS 类型对齐 | ⚠️ serde camelCase 一致, 但需 `cargo build --target wasm32` 确认 |

### 结论

**条件性安全 (Conditionally Safe)**:
- TS 侧: ✅ 可以 commit (0 新增 TSC 错误, 引用链完整)
- Rust 侧: ⚠️ 建议先执行 `cargo build --target wasm32-unknown-unknown` 验证 `on_tick_full` 和 `estimate_liquidation_price` 编译通过后再 commit
