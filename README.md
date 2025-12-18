<div align="center">

# 🦀 RustQuantLab

**High-Performance Financial Terminal · Rust/Wasm + React + ECharts**

[![Rust](https://img.shields.io/badge/Rust-2021-orange?logo=rust)](https://www.rust-lang.org/)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-Enabled-654FF0?logo=webassembly)](https://webassembly.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)
[![ECharts](https://img.shields.io/badge/ECharts-6-AA344D?logo=apacheecharts)](https://echarts.apache.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

*A high-fidelity engineering showcase demonstrating sub-millisecond market data processing with Rust/WebAssembly, featuring a professional-grade trading terminal UI.*

</div>

---

## 📸 Snapshot

![Dashboard Preview](docs/preview.png)

### ✨ Key Highlights

- **⚡ Rust-Powered Performance** — Core market analysis engine compiled to WebAssembly, handling high-frequency tick data with near-native speed
- **📊 Professional Trading UI** — TradingView/Binance-inspired dark theme with real-time K-line charts, order book visualization, and technical indicators
- **🌊 Organic Data Flow** — Simulated market heartbeat with burst-mode volatility patterns (50ms~1500ms adaptive intervals)
- **📱 4K Responsive Layout** — Fluid grid system optimized for screens from mobile to ultra-wide displays
- **🔄 Zero-Copy Bridge** — Efficient JS ↔ Rust data serialization via `serde-wasm-bindgen`

---

## 🔧 Workflow (Architecture)

The system implements a unidirectional data flow optimized for high-frequency financial data processing:

```mermaid
flowchart LR
    subgraph Worker["⚙️ Web Worker"]
        A[Mock Data Generator<br/>Random Walk Algorithm]
    end
    
    subgraph Wasm["🦀 Rust/Wasm Engine"]
        B[MarketEngine<br/>• Spread Calculation<br/>• SMA Technical Indicator<br/>• Price History Buffer]
    end
    
    subgraph React["⚛️ React Layer"]
        C[useTradingEngine Hook<br/>State Orchestrator]
        D[useCandleData Hook<br/>OHLCV Aggregation]
    end
    
    subgraph UI["🖥️ Visualization"]
        E[ECharts K-Line<br/>Candlestick + MA Lines]
        F[Order Book Panel<br/>50-Level Depth]
        G[Stats Dashboard<br/>Real-time Metrics]
    end
    
    A -->|"OrderBook JSON<br/>(postMessage)"| C
    C -->|"Tick Data"| B
    B -->|"AnalysisResult<br/>{spread, sma5}"| C
    C -->|"Price Stream"| D
    D -->|"Candle[]"| E
    C -->|"Bids/Asks"| F
    C -->|"Metrics"| G
    
    style A fill:#2d333b,stroke:#00d4ff,color:#fff
    style B fill:#4a2c0a,stroke:#f7931e,color:#fff
    style C fill:#1a365d,stroke:#61dafb,color:#fff
    style D fill:#1a365d,stroke:#61dafb,color:#fff
    style E fill:#3c1f3c,stroke:#aa344d,color:#fff
    style F fill:#1e3a2f,stroke:#0ecb81,color:#fff
    style G fill:#1e3a2f,stroke:#0ecb81,color:#fff
```

### Data Pipeline

| Stage | Component | Responsibility |
|-------|-----------|----------------|
| **1. Generation** | `mockWorker.ts` | Random-walk price simulation with burst-mode volatility |
| **2. Computation** | `MarketEngine` (Rust) | Spread calculation, SMA(5) indicator, history management |
| **3. Orchestration** | `useTradingEngine` | Wasm lifecycle, state coordination, price trend detection |
| **4. Aggregation** | `useCandleData` | Tick-to-OHLCV conversion, MA(5/10/20/30) computation |
| **5. Rendering** | React + ECharts | 60fps candlestick charts, depth visualization |

---

## 🛠️ Technology Stack

### Core Engine (Rust/Wasm)

| Crate | Version | Purpose |
|-------|---------|---------|
| `wasm-bindgen` | 0.2 | JS ↔ Rust FFI bridge |
| `serde` | 1.0 | Serialization framework |
| `serde-wasm-bindgen` | 0.4 | Zero-copy Wasm serialization |
| `console_error_panic_hook` | 0.1 | Debug-friendly panic messages |

### Frontend Stack

| Package | Version | Purpose |
|---------|---------|---------|
| **React** | 18.3 | UI component framework |
| **TypeScript** | 5.6 | Type-safe development |
| **Vite** | 5.4 | Next-gen build tooling |
| **Tailwind CSS** | 4.0 | Utility-first styling |
| **ECharts** | 6.0 | Professional charting library |
| **vite-plugin-wasm** | 3.3 | Seamless Wasm integration |

### Build Optimizations

```toml
# Cargo.toml - Release Profile
[profile.release]
opt-level = "s"    # Size optimization
lto = true         # Link-Time Optimization
```

---

## 🚀 Operation (Setup)

### Prerequisites

- **Node.js** ≥ 18.x
- **Rust** ≥ 1.70 ([Install via rustup](https://rustup.rs/))
- **wasm-pack** ([Installation Guide](https://rustwasm.github.io/wasm-pack/installer/))

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Duri686/RustQuantLab.git
cd RustQuantLab

# 2. Install frontend dependencies
npm install

# 3. Build Rust → WebAssembly module
cd core && wasm-pack build --target web --out-dir pkg && cd ..

# 4. Start development server
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Build Wasm + Start Vite dev server (port 3000) |
| `npm run build` | Production build (Wasm + Vite) |
| `npm run build:wasm` | Compile Rust to WebAssembly only |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint checks |

---

## 📁 Project Structure

```
RustQuantLab/
├── core/                      # Rust/Wasm Engine
│   ├── src/lib.rs             # MarketEngine implementation
│   ├── Cargo.toml             # Rust dependencies
│   └── pkg/                   # Compiled Wasm output (generated)
├── src/
│   ├── components/
│   │   ├── Dashboard/         # StatsPanel, OrderBook
│   │   ├── Layout/            # Header, LoadingScreen, ErrorScreen
│   │   └── KLineChart.tsx     # ECharts candlestick component
│   ├── hooks/
│   │   ├── useTradingEngine.ts   # Main orchestrator hook
│   │   ├── useMockMarket.ts      # Worker communication
│   │   └── useCandleData.ts      # OHLCV aggregation
│   ├── workers/
│   │   └── mockWorker.ts      # Market data simulator
│   ├── types/index.ts         # TypeScript interfaces
│   └── App.tsx                # Root component
├── vite.config.ts             # Vite + Wasm plugin config
└── package.json
```

---

## 📜 License

[MIT](./LICENSE)
