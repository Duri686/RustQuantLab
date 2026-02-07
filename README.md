<div align="center">

# 🦀 RustQuantLab

**高性能 Web 永续合约模拟交易终端 · Rust/Wasm + React + TradingView**

[![Rust](https://img.shields.io/badge/Rust-2021-orange?logo=rust)](https://www.rust-lang.org/)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-Enabled-654FF0?logo=webassembly)](https://webassembly.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)](https://react.dev/)
[![TradingView](https://img.shields.io/badge/Lightweight_Charts-5.1-2962FF?logo=tradingview)](https://www.tradingview.com/lightweight-charts/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite)](https://vitejs.dev/)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](./LICENSE)
[![DeepWiki](https://img.shields.io/badge/DeepWiki-Duri686%2FRustQuantLab-blue?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTQgMTloMTYiLz48cGF0aCBkPSJNNCAxNWg4Ii8+PHBhdGggZD0iTTQgMTFoNiIvPjxwYXRoIGQ9Ik0xMiAxMWw0LTYgNCA2Ii8+PHBhdGggZD0iTTE0IDExaDQiLz48L3N2Zz4=)](https://deepwiki.com/Duri686/RustQuantLab)

*基于 Rust/WebAssembly 的本地永续合约模拟引擎，提供零延迟交易体验与专业级交易终端 UI。*

</div>

---

## 📸 Snapshot

![Dashboard Preview](docs/preview.png)

### ✨ 核心亮点

- **⚡ Rust 驱动的高性能** — 核心交易引擎编译为 WebAssembly，毫秒级处理高频 Tick 数据，`on_tick_full` 单次跨边界调用合并分析+K线+交易状态
- **📈 完整模拟交易** — 支持多空开仓、杠杆调节 (1-125x)、市价/限价单、逐仓/全仓保证金、实时盈亏计算、强平预警
- **📊 专业交易 UI** — Binance 风格深色主题，TradingView Lightweight Charts K 线图、深度图、订单簿、24h 市场统计
- **🛡️ 风控引擎** — 保证金率监控、强平价格计算、四级风险等级评估 (Safe/Warning/Danger/Critical)、逐仓追加保证金
- **📱 全端响应式** — 从移动端到 4K 超宽屏的流畅网格布局，底部交易栏 + BottomSheet 移动适配
- **🔄 双数据源** — Mock 模拟行情 (Random Walk) 与 Binance WebSocket 实时行情一键切换
- **🧩 零拷贝桥接** — 通过 `serde-wasm-bindgen 0.6` 实现高效 JS ↔ Rust 数据序列化

---

## 🔧 架构设计

系统采用**单一入口 + 双向数据流**设计：`useWasmEngine` 统一编排市场数据与交易状态，React 只做 UI 搬运工，所有计算在 Rust 引擎中完成。

```mermaid
flowchart LR
    subgraph DataSource["📡 数据源"]
        A1[mockWorker<br/>Random Walk 行情]
        A2[Binance WebSocket<br/>实时市场数据]
    end
    
    subgraph Wasm["🦀 Rust/Wasm 核心引擎"]
        B[MarketEngine<br/>• 多周期 K线聚合<br/>• 技术指标计算<br/>• 订单簿处理]
        C[TradingEngine<br/>• 仓位管理<br/>• 盈亏计算<br/>• 限价单撮合<br/>• 风控强平]
    end
    
    subgraph Hooks["⚛️ React Hooks 层"]
        D[useWasmEngine<br/>统一编排入口]
        D1[useMarketData<br/>数据源抽象]
        E[useTradingActions<br/>交易操作封装]
        F[useCandleData<br/>K线数据适配]
        G[wasmSingleton<br/>引擎单例管理]
    end
    
    subgraph UI["🖥️ UI 组件"]
        H[LightweightChart<br/>多窗格 K线/指标]
        H2[DepthChart<br/>市场深度图]
        I[TradePanel<br/>开仓/挂单表单]
        J[PositionCard<br/>实时盈亏/风控]
        K[OrderBook<br/>深度盘口]
        L[StatsPanel<br/>24h 市场统计]
    end
    
    A1 -->|"Tick 流"| D1
    A2 -->|"Tick 流"| D1
    D1 --> D
    D -->|"价格更新"| B
    D -->|"价格更新"| C
    B -->|"指标/K线"| D
    C -->|"交易状态"| D
    D --> F --> H
    D --> H2
    D --> I
    D --> J
    D --> K
    D --> L
    I -->|"开仓/挂单"| E --> C
    
    style A1 fill:#2d333b,stroke:#00d4ff,color:#fff
    style A2 fill:#2d333b,stroke:#F0B90B,color:#fff
    style B fill:#4a2c0a,stroke:#f7931e,color:#fff
    style C fill:#4a2c0a,stroke:#f7931e,color:#fff
    style D fill:#1a365d,stroke:#61dafb,color:#fff
    style D1 fill:#1a365d,stroke:#61dafb,color:#fff
    style E fill:#1a365d,stroke:#61dafb,color:#fff
    style F fill:#1a365d,stroke:#61dafb,color:#fff
    style G fill:#1a365d,stroke:#61dafb,color:#fff
    style H fill:#3c1f3c,stroke:#aa344d,color:#fff
    style H2 fill:#3c1f3c,stroke:#aa344d,color:#fff
    style I fill:#1e3a2f,stroke:#0ecb81,color:#fff
    style J fill:#1e3a2f,stroke:#0ecb81,color:#fff
    style K fill:#1e3a2f,stroke:#0ecb81,color:#fff
    style L fill:#1e3a2f,stroke:#0ecb81,color:#fff
```

### 数据管线

| 阶段 | 组件 | 职责 |
|------|------|------|
| **1. 行情生成** | `mockWorker.ts` / `useBinanceMarket` | Mock: Random Walk 模拟 · Binance: WebSocket 实时数据 |
| **2. 数据源抽象** | `useMarketData` | 统一 Mock/Binance 接口，管理历史 K 线请求 |
| **3. 统一入口** | `useWasmEngine` | Wasm 单例初始化、Tick 分发、`on_tick_full` 合并调用 |
| **4. 市场引擎** | `MarketEngine` (Rust) | 多周期 K 线聚合 (1s→1D)、SMA/EMA/BOLL/MACD/RSI |
| **5. 交易引擎** | `TradingEngine` (Rust) | 仓位管理、盈亏计算、限价单撮合、风控强平 |
| **6. 操作封装** | `useTradingActions` | 开仓/平仓/挂单/撤单/追加保证金/预估强平 API |
| **7. 渲染** | React + TradingView | 60FPS K 线图、深度图、交易 UI |

---

## 🛠️ 技术栈

### 核心引擎 (Rust/Wasm)

| Crate | 版本 | 用途 |
|-------|------|------|
| `wasm-bindgen` | 0.2 | JS ↔ Rust FFI 桥接 |
| `serde` | 1.0 | 序列化框架 |
| `serde-wasm-bindgen` | 0.6 | 高效 Wasm 序列化 |
| `js-sys` | 0.3 | JavaScript API 绑定 |
| `web-sys` | 0.3 | Web API 绑定 (console) |
| `console_error_panic_hook` | 0.1 | 调试友好的 Panic 信息 |
| `criterion` | 0.5 | 性能基准测试 (dev) |

### 前端技术栈

| 包名 | 版本 | 用途 |
|------|------|------|
| **React** | 18.3 | UI 组件框架 |
| **TypeScript** | 5.6 | 类型安全开发 |
| **Vite** | 5.4 | 新一代构建工具 |
| **Tailwind CSS** | 4.0 | 原子化 CSS 框架 (Design Token 体系) |
| **Lightweight Charts** | 5.1 | TradingView 专业 K 线图表 |
| **Zustand** | 4.5 | 轻量级状态管理 (UI 状态/数据源切换) |
| **ahooks** | 3.9 | React Hooks 工具库 (防抖/倒计时等) |
| **Lucide React** | 0.562 | 现代图标库 |
| **@react-spring/web** | 10.0 | 物理动画引擎 |
| **@use-gesture/react** | 10.3 | 手势交互 (拖拽/滑动) |
| **vite-plugin-wasm** | 3.3 | Wasm 集成插件 |

### 构建优化

```toml
# Cargo.toml - Release Profile
[profile.release]
opt-level = "s"      # 平衡体积与运行速度
lto = true           # 链接时优化
codegen-units = 1    # 单代码单元，更好的优化
strip = true         # 移除调试符号
panic = "abort"      # 无 unwind 代码
```

---

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18.x
- **Rust** ≥ 1.70 ([rustup 安装](https://rustup.rs/))
- **wasm-pack** ([安装指南](https://rustwasm.github.io/wasm-pack/installer/))

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/Duri686/RustQuantLab.git
cd RustQuantLab

# 2. 安装前端依赖
npm install

# 3. 构建 Rust → WebAssembly 模块
cd core && wasm-pack build --target web --out-dir pkg && cd ..

# 4. 启动开发服务器
npm run dev
```

### 可用脚本

| 命令 | 描述 |
|------|------|
| `npm run dev` | 构建 Wasm + 启动 Vite 开发服务器 (3000 端口) |
| `npm run build` | 生产构建 (Wasm + Vite) |
| `npm run build:wasm` | 仅构建 Rust → WebAssembly |
| `npm run preview` | 本地预览生产构建 |
| `npm run lint` | 运行 ESLint 检查 |
| `npm run test:rust` | 运行 Rust 单元测试 |
| `npm run bench` | 运行 Rust 性能基准测试 |

---

## 📁 项目结构

```
RustQuantLab/
├── core/                           # 🦀 Rust/Wasm 核心引擎
│   ├── src/
│   │   ├── lib.rs                  # Wasm 导出 API + 模块声明
│   │   ├── models.rs               # 核心数据模型 (OrderBook/Candle/AnalysisResult)
│   │   ├── engine/                 # 引擎模块
│   │   │   ├── market_engine/      # MarketEngine (K线聚合/指标计算/订单簿)
│   │   │   ├── trading/            # 交易逻辑 (开仓/平仓/限价单撮合/风控)
│   │   │   ├── data/               # K线聚合器、Tick 数据管理
│   │   │   └── types.rs            # 引擎事件类型 (EngineEvent/TradingState)
│   │   ├── trading/                # 交易领域模型
│   │   │   ├── position.rs         # 仓位结构与生命周期
│   │   │   ├── orders.rs           # 限价单/挂单管理
│   │   │   ├── balance.rs          # 账户余额与保证金
│   │   │   └── manager.rs          # 仓位管理器 (开仓/平仓/加仓)
│   │   ├── indicators/             # 技术指标 (纯函数, 无状态)
│   │   │   ├── ma.rs               # SMA / EMA
│   │   │   ├── boll.rs             # 布林带
│   │   │   ├── macd.rs             # MACD
│   │   │   └── rsi.rs              # RSI
│   │   └── risk/                   # 风控与强平
│   │       ├── liquidation.rs      # 强平价格计算
│   │       ├── margin.rs           # 保证金率计算
│   │       └── types.rs            # 风险等级 (Safe/Warning/Danger/Critical)
│   ├── benches/                    # Criterion 性能基准测试
│   └── Cargo.toml
├── src/                            # ⚛️ React 前端
│   ├── components/
│   │   ├── Dashboard/
│   │   │   ├── Chart/              # 图表区域
│   │   │   │   ├── LightweightChart/  # TradingView 多窗格图表系统
│   │   │   │   ├── ChartToolbar.tsx   # 时间周期/指标/数据源切换
│   │   │   │   └── DepthChart.tsx     # 市场深度图
│   │   │   ├── Trade/              # 交易区域
│   │   │   │   ├── TradePanel.tsx     # 交易表单 (市价/限价/杠杆)
│   │   │   │   ├── PositionCard.tsx   # 仓位卡片 (盈亏/风控/挂单)
│   │   │   │   └── LeverageSlider.tsx # 杠杆滑条 (1-125x)
│   │   │   ├── OrderBook.tsx       # 订单簿 (买卖各20档)
│   │   │   └── StatsPanel.tsx      # 24h 市场统计
│   │   ├── Layout/                 # 布局组件
│   │   │   ├── Header.tsx          # 顶部导航 (数据源切换/FPS/内存)
│   │   │   ├── ErrorScreen.tsx     # 错误页面
│   │   │   └── LoadingScreen.tsx   # 加载骨架屏
│   │   └── Toast/                  # Toast 通知系统
│   ├── hooks/
│   │   ├── useWasmEngine.ts        # 🎯 统一 Wasm 引擎入口
│   │   ├── useMarketData.ts        # 数据源抽象层 (Mock/Binance 切换)
│   │   ├── useBinanceMarket.ts     # Binance WebSocket 实时数据
│   │   ├── useMockMarket.ts        # Mock 模拟数据
│   │   ├── useMarketStats.ts       # 24h 市场统计 (涨跌幅/成交量/倒计时)
│   │   ├── useCandleData.ts        # K线数据适配
│   │   ├── useFpsMonitor.ts        # FPS 性能监控
│   │   ├── tradingEngine/          # 交易操作封装
│   │   │   ├── useTradingActions.ts   # 开仓/平仓/挂单/撤单/追加保证金
│   │   │   └── wasmSingleton.ts       # Wasm 引擎单例 + 内存监控
│   │   ├── tradingState/           # 交易状态处理
│   │   │   ├── eventHandler.ts        # 引擎事件 → Toast 通知
│   │   │   └── types.ts              # 交易 Wasm 接口类型
│   │   ├── candle/                 # K线工具
│   │   └── ui/                     # UI 状态
│   │       ├── useUiStore.ts          # Zustand UI 状态管理
│   │       └── useBottomSheet.ts      # 移动端底部弹层
│   ├── workers/
│   │   └── mockWorker.ts           # Web Worker: Random Walk 行情模拟
│   └── App.tsx                     # 应用根组件 (Composition Root)
├── docs/                           # 📚 文档
│   ├── ROADMAP.md                  # 项目路线图
│   └── design/                     # 设计文档
├── .github/workflows/              # GitHub Actions (自动部署)
└── package.json
```

---

## 📜 许可证

本项目采用 [CC BY-NC 4.0](./LICENSE) 许可证。

- ✅ 允许学习、研究、个人使用
- ✅ 允许修改和二次创作
- ❗ 必须标注来源并链接原仓库
- ❌ 禁止商业用途
