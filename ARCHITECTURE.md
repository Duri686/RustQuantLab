# RustQuantLab Architecture Design

> **Document Status**: Active
> **Last Updated**: 2025-12-20
> **Core Pattern**: Stateful Trading Engine (Rust/Wasm) + Managed UI (React) + GPU Rendering (Canvas)

## 1. 核心设计理念 (Core Philosophy)

RustQuantLab 旨在构建下一代高性能 Web 交易终端。我们的核心设计原则是 **"Client-Side Heavy Computing"（重客户端计算）**。

我们认为，现代浏览器的算力（配合 WebAssembly）已被严重低估。通过将计算权下放，我们实现了：
1.  **Zero-Latency Interaction**: 指标切换与数据分析在本地毫秒级完成，无需网络请求。
2.  **Server Offloading**: 服务端仅作为单一可信数据源（Source of Truth）和撮合中心，不再承担繁重的展示逻辑计算。
3.  **High FPS Rendering**: 通过 Canvas 绕过 DOM Diff，实现 60FPS 的丝滑 K 线拖拽体验。

## 2. 技术栈架构 (Tech Stack & Roles)

系统由三个紧密协作但职责分离的层级组成：

| 层级 | 技术选型 | 角色 | 核心职责 |
| :--- | :--- | :--- | :--- |
| **Logic Layer** | **Rust (Wasm)** | **The Brain** | **[有状态交易引擎]** 不仅负责技术指标计算，现已升级为完整的模拟交易核心：管理活跃仓位（多/空）、钱包余额（保证金）、实时盈亏计算（未实现 PnL）、本地订单撮合。利用 Rust 的零 GC 特性和 f64 精度保证金融计算的稳定与精准。 |
| **UI Layer** | **React + Tailwind** | **The Manager** | **[状态管理型]** 负责组件生命周期、路由、布局响应、用户交互事件分发。它不处理具体的金融数学运算。 |
| **View Layer** | **ECharts (Canvas)** | **The Painter** | **[视觉渲染型]** 负责像素级绘制。接收来自 Rust 的计算结果，利用 GPU 加速渲染大量 K 线数据。 |

## 3. 数据流设计 (Data Flow)

系统采用**双向数据流**设计：市场数据单向流入，交易指令双向交互。

```mermaid
graph TD
    subgraph Server ["Server (Go/Rust/Java)"]
        MatchEngine[Matching Engine] -->|WebSocket| RawFeed[Raw Ticks]
    end

    subgraph Client ["Client (Browser)"]
        RawFeed -->|Binary/JSON| Worker[Web Worker]
        
        subgraph Logic ["Core Logic (Rust Wasm) - Stateful Engine"]
            Worker -->|Price Feed| MarketEngine[MarketEngine Struct]
            MarketEngine -->|Compute| Indicators[TA Indicators (SMA, EMA, MACD)]
            MarketEngine -->|Update| OrderBook[Local OrderBook]
            
            subgraph Trading ["Mock Trading State"]
                Positions[Active Positions]
                Wallet[Wallet Balance]
                PnL[Real-time PnL]
            end
            
            MarketEngine -->|Manage| Positions
            MarketEngine -->|Track| Wallet
            MarketEngine -->|Calculate| PnL
        end
        
        Indicators -->|Computed Data| ReactHooks[React Custom Hooks]
        OrderBook -->|Depth Data| ReactHooks
        Positions -->|Position State| ReactHooks
        Wallet -->|Balance State| ReactHooks
        PnL -->|PnL State| ReactHooks
        
        ReactHooks -->|Options| Chart[ECharts Instance]
        ReactHooks -->|Trade State| ReactUI[React Components]
        
        User[User Input] -->|Buy/Sell Action| ReactUI
        ReactUI -->|Execute Order| MarketEngine
        MarketEngine -->|State Update| ReactHooks
    end

```

### 3.1 交易流程（双向）

1. **开仓流程**: `User Click (Buy/Sell)` → `React Handler` → `Rust: execute_order()` → `State Update (Position/Balance)` → `React UI Refresh`
2. **平仓流程**: `User Click (Close)` → `React Handler` → `Rust: close_position()` → `PnL Realized` → `Balance Updated` → `React UI Refresh`
3. **实时盈亏**: `Price Tick` → `Rust: update_price()` → `Recalculate Unrealized PnL` → `React Hooks` → `UI Display`

---

## 4. 客户端模拟引擎 (Client-Side Simulation Engine)

### 4.1 设计目标

我们在客户端实现了一个**本地永续合约模拟引擎（Local Perpetual Futures Engine）**，其核心目的是：

* **零延迟训练环境**: 用户可以在连接真实交易所之前，以零网络延迟体验完整的合约交易流程。
* **即时反馈**: 开仓、平仓、爆仓预警等操作在本地毫秒级完成，帮助用户理解杠杆交易的风险。
* **策略验证**: 用户可以在模拟环境中验证交易策略，无需承担真实资金风险。

### 4.2 模拟引擎状态结构

```rust
// core/src/engine.rs (Simplified)
pub struct TradingEngine {
    pub balance: f64,           // 可用保证金
    pub position: Option<Position>,  // 当前仓位
    pub leverage: u8,           // 杠杆倍数
    pub entry_price: f64,       // 开仓均价
    pub current_price: f64,     // 最新市价
}

pub struct Position {
    pub side: PositionSide,     // Long / Short
    pub size: f64,              // 仓位大小
    pub unrealized_pnl: f64,    // 未实现盈亏
}
```

### 4.3 为什么不在 JavaScript 中实现？

* **精度问题**: JavaScript 的 `Number` 类型无法精确表示大额金融数值，而 Rust 的 `f64` 配合谨慎的舍入策略可以保证计算一致性。
* **状态安全**: Rust 的所有权模型防止了状态被意外修改，确保交易逻辑的原子性。
* **未来复用**: 当接入真实交易所时，客户端校验逻辑可与服务端共享同一套 Rust 代码，确保前后端行为一致。

---

## 5. 关键架构决策 (Key Architectural Decisions)

### 5.1 为什么选择 Rust Wasm 而不是纯 JavaScript？

* **性能稳定性**: JS 的垃圾回收（GC）机制在大数据量下会导致 UI 瞬时卡顿（Jank）。Rust 的内存管理是确定性的，保证了数据处理的平滑。
* **计算精度**: 金融计算对精度要求极高，Rust 的强类型系统和数值计算库优于 JS 的动态类型。
* **逻辑复用**: 未来的交易策略、风控逻辑可以直接复用服务端（如果是 Rust 后端）的代码，保证前后端逻辑 100% 一致。

### 5.2 服务端与客户端的边界

* **客户端**: 负责所有"展示型"计算（如指标）以及**模拟交易状态管理**（仓位、保证金、本地盈亏）。
* **服务端**: 负责所有"事务型"逻辑（真实撮合、定序、结算、持久化）。

> **注意**: 客户端的模拟交易仅用于用户训练和策略验证，不涉及真实资金。真实交易必须通过服务端完成。

---

## 6. 目录结构规范 (Directory Structure)

```text
src/
├── components/     # UI Components (React)
│   ├── Dashboard/  # Trading specific views
│   │   ├── Chart/  # Chart wrapper & Logic
│   │   └── Trade/  # Order forms
├── hooks/          # React Hooks (Bridge betwen UI and Wasm)
├── workers/        # Web Workers (Off-main-thread processing)
├── utils/          # Formatting helpers (No complex math here)
└── ...
core/               # Rust Wasm Source Code
├── src/
│   ├── lib.rs      # Public API exports
│   └── engine.rs   # Core calculation logic + Trading Engine
└── Cargo.toml

```

---

## 7. 技术路线图 (Technical Roadmap)

### 7.1 当前里程碑 ✅

| 功能 | 状态 | 说明 |
| :--- | :---: | :--- |
| 技术指标计算 (SMA/EMA/MACD/RSI/BOLL) | ✅ | Rust Wasm 实现 |
| 本地模拟交易引擎 | ✅ | 支持开仓/平仓/实时盈亏 |
| React + ECharts 集成 | ✅ | 60FPS K 线渲染 |

### 7.2 下一阶段目标 🚧

| 优先级 | 功能 | 目标 |
| :---: | :--- | :--- |
| **P0** | **风控与强平引擎迁移至 Rust** | 见下方详细说明 |
| P1 | 多仓位管理 | 支持同时持有多个交易对的仓位 |
| P2 | 历史交易记录持久化 | IndexedDB 存储本地交易历史 |
| P3 | 策略回测框架 | 基于历史 K 线的策略验证 |

### 7.3 🔴 关键任务：风控与强平引擎迁移 (Risk & Liquidation Engine Migration)

**背景**:
当前的保证金检查逻辑可能分散在 JavaScript 层或 Rust 层，缺乏统一的严格校验。这在模拟环境中可能导致与真实交易所行为不一致。

**目标**:
将以下核心风控逻辑**完全迁移至 Rust Core**：

1. **强平价格计算 (Liquidation Price Calculation)**

   ```rust
   // 目标 API
   pub fn calculate_liquidation_price(
       entry_price: f64,
       leverage: u8,
       side: PositionSide,
       maintenance_margin_rate: f64,
   ) -> f64
   ```

2. **保证金追缴逻辑 (Margin Call Logic)**
   * 当 `unrealized_pnl` 导致保证金率低于维持保证金率时，触发预警。
   * 当达到强平线时，自动执行强制平仓。

3. **仓位风险评估 (Position Risk Assessment)**
   * 实时计算保证金率、风险敞口、最大可开仓量。

**收益**:

* **精度保证**: 使用 Rust `f64` 进行所有计算，避免 JavaScript 浮点数精度问题。
* **行为一致性**: 确保客户端模拟与服务端（如果使用 Rust）行为完全一致。
* **安全性**: Rust 的类型系统防止了逻辑错误（如负保证金、无效杠杆）。

---

## 8. 版本历史 (Changelog)

| 日期 | 版本 | 变更说明 |
| :--- | :--- | :--- |
| 2025-12-20 | v0.2.0 | 新增模拟交易引擎；更新数据流为双向设计；新增技术路线图 |
| 2025-12-20 | v0.1.0 | 初始架构文档：技术指标计算、ECharts 集成 |
