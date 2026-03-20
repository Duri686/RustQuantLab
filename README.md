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
        D2[useDataSource<br/>数据源切换]
        E[useTradingActions<br/>交易操作封装]
        F[useCandleData<br/>K线数据适配]
        G[useMarketStats<br/>24h 市场统计]
    end
    
    subgraph UI["🖥️ UI 组件"]
        H[UnifiedMultiPaneChart<br/>多窗格 K线/指标]
        H1[ChartToolbar<br/>周期/指标切换]
        H2[DepthChart<br/>市场深度图]
        I[TradePanel<br/>开仓/挂单表单]
        J[PositionCard<br/>实时盈亏/风控]
        K[OrderBook<br/>深度盘口]
        L[StatsPanel<br/>24h 市场统计]
    end
    
    A1 -->|"Tick 流"| D1
    A2 -->|"Tick 流"| D1
    D2 --> D1
    D1 --> D
    D -->|"价格更新"| B
    D -->|"价格更新"| C
    B -->|"指标/K线"| D
    C -->|"交易状态"| D
    D --> F --> H
    D --> G --> L
    D --> H2
    D --> I
    D --> J
    D --> K
    H1 --> H
    I -->|"开仓/挂单"| E --> C
    
    style A1 fill:#2d333b,stroke:#00d4ff,color:#fff
    style A2 fill:#2d333b,stroke:#F0B90B,color:#fff
    style B fill:#4a2c0a,stroke:#f7931e,color:#fff
    style C fill:#4a2c0a,stroke:#f7931e,color:#fff
    style D fill:#1a365d,stroke:#61dafb,color:#fff
    style D1 fill:#1a365d,stroke:#61dafb,color:#fff
    style D2 fill:#1a365d,stroke:#61dafb,color:#fff
    style E fill:#1a365d,stroke:#61dafb,color:#fff
    style F fill:#1a365d,stroke:#61dafb,color:#fff
    style G fill:#1a365d,stroke:#61dafb,color:#fff
    style H fill:#3c1f3c,stroke:#aa344d,color:#fff
    style H1 fill:#3c1f3c,stroke:#aa344d,color:#fff
    style H2 fill:#3c1f3c,stroke:#aa344d,color:#fff
    style I fill:#1e3a2f,stroke:#0ecb81,color:#fff
    style J fill:#1e3a2f,stroke:#0ecb81,color:#fff
    style K fill:#1e3a2f,stroke:#0ecb81,color:#fff
    style L fill:#1e3a2f,stroke:#0ecb81,color:#fff
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

## 📁 项目结构

| 目录 | 说明 |
|------|------|
| `core/` | 🦀 Rust/Wasm 核心引擎 (K线聚合、技术指标、交易撮合、风控强平) |
| `src/` | ⚛️ React 前端 (图表、交易面板、订单簿、状态管理) |
| `docs/` | 📚 设计文档与路线图 |

---

## 📜 许可证

本项目采用 [CC BY-NC 4.0](./LICENSE) 许可证。

- ✅ 允许学习、研究、个人使用
- ✅ 允许修改和二次创作
- ❗ 必须标注来源并链接原仓库
- ❌ 禁止商业用途
