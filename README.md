<div align="center">

# 🦀 RustQuantLab

**高性能 Web 永续合约模拟交易终端 · Rust/Wasm + React + TradingView**

[![Rust](https://img.shields.io/badge/Rust-2021-orange?logo=rust)](https://www.rust-lang.org/)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-Enabled-654FF0?logo=webassembly)](https://webassembly.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TradingView](https://img.shields.io/badge/Lightweight_Charts-5-2962FF?logo=tradingview)](https://www.tradingview.com/lightweight-charts/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)](https://vitejs.dev/)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](./LICENSE)
[![DeepWiki](https://img.shields.io/badge/DeepWiki-Duri686%2FRustQuantLab-blue?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTQgMTloMTYiLz48cGF0aCBkPSJNNCAxNWg4Ii8+PHBhdGggZD0iTTQgMTFoNiIvPjxwYXRoIGQ9Ik0xMiAxMWw0LTYgNCA2Ii8+PHBhdGggZD0iTTE0IDExaDQiLz48L3N2Zz4=)](https://deepwiki.com/Duri686/RustQuantLab)

*基于 Rust/WebAssembly 的本地永续合约模拟引擎，提供零延迟交易体验与专业级交易终端 UI。*

</div>

---

## 📸 Snapshot

![Dashboard Preview](docs/preview.png)

### ✨ 核心亮点

- **⚡ Rust 驱动的高性能** — 核心交易引擎编译为 WebAssembly，毫秒级处理高频 Tick 数据
- **📈 完整模拟交易** — 支持多空开仓、杠杆调节 (1-125x)、实时盈亏计算、强平预警
- **📊 专业交易 UI** — 仿 Binance/TradingView 深色主题，实时 K 线、订单簿、技术指标
- **🛡️ 风控引擎** — 保证金率监控、强平价格计算、风险等级评估
- **📱 全端响应式** — 从移动端到 4K 超宽屏的流畅网格布局
- **🔄 零拷贝桥接** — 通过 `serde-wasm-bindgen` 实现高效 JS ↔ Rust 数据序列化

---

## 🔧 架构设计

系统采用**单一入口 + 双向数据流**设计：`useWasmEngine` 统一编排市场数据与交易状态。

```mermaid
flowchart LR
    subgraph Worker["⚙️ Web Worker"]
        A[mockWorker<br/>Random Walk 行情]
    end
    
    subgraph Wasm["🦀 Rust/Wasm 核心"]
        B[MarketEngine<br/>• K线聚合<br/>• 技术指标<br/>• 订单簿处理]
        C[TradingEngine<br/>• 仓位管理<br/>• 盈亏计算<br/>• 限价单撮合<br/>• 风控监控]
    end
    
    subgraph Hooks["⚛️ React Hooks"]
        D[useWasmEngine<br/>统一编排入口]
        E[useTradingActions<br/>交易操作封装]
        F[useCandleData<br/>K线数据适配]
        G[wasmSingleton<br/>引擎单例管理]
    end
    
    subgraph UI["🖥️ UI 组件"]
        H[LightweightChart<br/>TradingView 渲染]
        I[TradeForm<br/>开仓/挂单]
        J[PositionCard<br/>实时盈亏]
        K[OrderBook<br/>深度盘口]
    end
    
    A -->|"Tick 流"| D
    D -->|"价格更新"| B
    D -->|"价格更新"| C
    B -->|"指标/K线"| D
    C -->|"交易状态"| D
    D --> F --> H
    D --> I
    D --> J
    D --> K
    I -->|"开仓/挂单"| E --> C
    
    style A fill:#2d333b,stroke:#00d4ff,color:#fff
    style B fill:#4a2c0a,stroke:#f7931e,color:#fff
    style C fill:#4a2c0a,stroke:#f7931e,color:#fff
    style D fill:#1a365d,stroke:#61dafb,color:#fff
    style E fill:#1a365d,stroke:#61dafb,color:#fff
    style F fill:#1a365d,stroke:#61dafb,color:#fff
    style G fill:#1a365d,stroke:#61dafb,color:#fff
    style H fill:#3c1f3c,stroke:#aa344d,color:#fff
    style I fill:#1e3a2f,stroke:#0ecb81,color:#fff
    style J fill:#1e3a2f,stroke:#0ecb81,color:#fff
    style K fill:#1e3a2f,stroke:#0ecb81,color:#fff
```

### 数据管线

| 阶段 | 组件 | 职责 |
|------|------|------|
| **1. 行情生成** | `mockWorker.ts` | Random Walk 价格模拟，突发波动 |
| **2. 统一入口** | `useWasmEngine` | Wasm 单例、Tick 分发、状态聚合 |
| **3. 市场引擎** | `MarketEngine` (Rust) | K线聚合、技术指标、订单簿 |
| **4. 交易引擎** | `TradingEngine` (Rust) | 仓位、盈亏、限价单、风控 |
| **5. 操作封装** | `useTradingActions` | 开仓/平仓/挂单/撤单 API |
| **6. 渲染** | React + TradingView | 60FPS K线图、交易 UI |

---

## 🛠️ 技术栈

### 核心引擎 (Rust/Wasm)

| Crate | 版本 | 用途 |
|-------|------|------|
| `wasm-bindgen` | 0.2 | JS ↔ Rust FFI 桥接 |
| `serde` | 1.0 | 序列化框架 |
| `serde-wasm-bindgen` | 0.4 | 零拷贝 Wasm 序列化 |
| `js-sys` | 0.3 | JavaScript API 绑定 |
| `console_error_panic_hook` | 0.1 | 调试友好的 Panic 信息 |
| `criterion` | 0.5 | 性能基准测试 (dev) |

### 前端技术栈

| 包名 | 版本 | 用途 |
|------|------|------|
| **React** | 18.3 | UI 组件框架 |
| **TypeScript** | 5.6 | 类型安全开发 |
| **Vite** | 5.4 | 新一代构建工具 |
| **Tailwind CSS** | 4.0 | 原子化 CSS 框架 |
| **Lightweight Charts** | 5.1 | TradingView 专业 K 线图表 |
| **Lucide React** | 0.562 | 现代图标库 |
| **vite-plugin-wasm** | 3.3 | Wasm 集成插件 |

### 构建优化

```toml
# Cargo.toml - Release Profile
[profile.release]
opt-level = "z"      # 最小体积优先
lto = true           # 链接时优化
codegen-units = 1    # 单代码单元
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

---

## 📁 项目结构

```
RustQuantLab/
├── core/                       # 🦀 Rust/Wasm 核心引擎
│   └── src/
│       ├── lib.rs              # Wasm 导出 API
│       ├── engine/             # 引擎模块
│       │   ├── market_engine/  # MarketEngine (K线/指标/订单簿)
│       │   ├── trading/        # 交易逻辑 (开仓/平仓/限价单/风控)
│       │   └── data/           # K线聚合、Tick 处理
│       ├── trading/            # 交易领域模型 (仓位/订单/余额)
│       ├── indicators/         # 技术指标 (SMA/EMA/MACD/RSI/BOLL)
│       └── risk/               # 风控算法 (强平/保证金)
├── src/                        # ⚛️ React 前端
│   ├── components/Dashboard/
│   │   ├── Chart/              # TradingView Lightweight Charts
│   │   │   └── LightweightChart/  # 多窗格图表系统
│   │   ├── Trade/              # 交易组件 (表单/仓位卡片)
│   │   └── OrderBook.tsx       # 订单簿
│   ├── hooks/
│   │   ├── useWasmEngine.ts    # 🎯 统一 Wasm 引擎入口
│   │   ├── tradingEngine/      # 交易操作封装
│   │   └── candle/             # K线数据处理
│   ├── workers/
│   │   └── mockWorker.ts       # Random Walk 行情模拟
│   └── App.tsx
└── package.json
```

---

## 📜 许可证

本项目采用 [CC BY-NC 4.0](./LICENSE) 许可证。

- ✅ 允许学习、研究、个人使用
- ✅ 允许修改和二次创作
- ❗ 必须标注来源并链接原项目
- ❌ 禁止商业用途
