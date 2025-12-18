# RustQuantLab

## 1. 项目背景与目标

**背景**：在证券交易Web端，面临高频行情推送（每秒数十/上百次更新）时，JavaScript 在主线程进行大量数据的序列化、反序列化、排序、聚合以及金融指标（如均线）计算时，容易造成 UI 掉帧、卡顿。

**目标**：

- 搭建 `Vite` + `React` + `Rust` (`wasm-pack`) 的完整开发工作流。
- 通过 Rust 接管核心的数据清洗、聚合与指标计算逻辑。
- 通过 **Mock Generator** 模拟高频“服务端”推送，验证 **Wasm** 相比纯 JS 的性能优势。
- 实现一个流畅的、即时响应的简易交易盘口与 K 线图表。

## 2. 技术栈架构

- **构建工具**：`Vite` (插件: `vite-plugin-rsw` 或 `vite-plugin-wasm-pack`)
- **前端框架**：`React 18+` (Hooks, Context API)
- **核心逻辑**：`Rust` (编译为 **WebAssembly**)
- **通信桥梁**：`wasm-bindgen` (JS <-> Rust 交互)
- **数据模拟**：`JavaScript` `setInterval` + `Web Worker` (模拟独立线程的 WebSocket 推送)
- **图表库**：`Apache ECharts` 或简单的 `HTML Canvas` (由 React 管理，数据由 Rust 提供)

## 3. 功能模块需求 (Functional Requirements)

我们将项目分为三个核心层：**数据源层 (Mock)**、**计算层 (Rust Core)**、**展示层 (React UI)**。

### 3.1 模块一：高频行情模拟器 (Mock Data Generator)

**目的**：模拟后端压力，产生让纯 JS "汗流浃背" 的数据量。

**功能描述**：

- 在前端启动一个 **Web Worker**。
- 每隔 `100ms` (可调快至 `10ms` 进行压力测试) 生成一次行情快照。
- **数据内容**：包含 `timestamp`（时间戳）、`price`（当前价）、`volume`（成交量）、`depth`（深度数据，包含买一到买五十、卖一到卖五十的数组）。
- **数据格式**：为了模拟真实场景，Worker 发送给主线程（或 Wasm）的应该是一个扁平的 `Uint8Array` (二进制流) 或者一个巨大的 JSON 字符串，刻意制造解析成本。

### 3.2 模块二：Rust 核心计算引擎 (The Wasm Module)

**目的**：实战 Rust 的内存管理、算法性能与 JS 互操作。

此模块需暴露给 JS 以下 API：

#### 3.2.1 行情清洗与深度聚合 (Order Book Aggregation)

- **输入**：接收 Mock 生成的原始深度数据（假设是一个包含 1000 个挂单的乱序数组）。
- **处理**：
  - **解析**：将输入数据转换为 Rust 结构体。
  - **排序**：对买单进行降序排序，对卖单进行升序排序。
  - **聚合**：合并相同价格的挂单量。
  - **截取**：只保留前 20 档数据用于显示。
- **输出**：返回给 JS 一个干净的 JavaScript Object（包含 `bids` 和 `asks` 数组）。

#### 3.2.2 实时指标计算 (Technical Indicator Calculation)

- **输入**：
  - 历史 K 线数据缓存（维护在 Rust 内存中，例如 `Vec<Candle>`）。
  - 最新的一笔实时价格 Tick。
- **处理**：
  - 更新 K 线状态。
  - **计算 SMA (移动平均线)**：计算 `SMA(5)`, `SMA(10)`, `SMA(20)`。需要遍历数组进行累加平均。
  - **计算 MACD (指数平滑异同移动平均线)**：这是一个涉及递归和 EMA 计算的经典算法，非常适合测试 Wasm 性能。
- **输出**：返回计算后的最新指标值，供图表渲染。

### 3.3 模块三：React 交易界面 (UI Presentation)

**目的**：验证数据渲染是否流畅，体验“计算与渲染分离”。

- **`OrderBook` 组件**：
  - 使用 `Flex` 或 `Grid` 布局渲染买卖 20 档。
  - 接收来自 Wasm 处理好的数据进行渲染。
  - **挑战点**：高频更新下的 React Re-render 优化（使用 `memo` 或直接操作 DOM）。
- **`Chart` 组件**：
  - 简单渲染一个 `SVG` 或 `Canvas` 的折线图。
  - 显示价格走势 + Wasm 计算出的 SMA 均线。
- **控制面板**：
  - **开关**：开启/关闭 Wasm 模式（用于对比纯 JS 模式）。
  - **滑条**：调节 Mock 数据的推送频率（模拟从正常交易到市场崩盘时的流量）。

## 4. 关键实战路径 (Implementation Roadmap)

建议按照以下 4 个阶段进行开发，每个阶段解决一个具体的 `Rust+Wasm` 知识点。

### 阶段一：环境搭建与 Hello World

- **任务**：
  - 初始化 `Vite` + `React` TS 项目。
  - 初始化 `Rust` 项目 (`cargo new --lib`)。
  - 配置 `wasm-pack` 构建流程，确保 React 能 `import` 编译后的 `.wasm` 文件。
  - 实现一个简单的 `add(a, b)` 函数，证明 JS 可以调用 Rust。

### 阶段二：数据流模拟与结构体传递 (JSON vs Struct)

- **任务**：
  - 编写 JS 的 Mock Worker，生成乱序的订单数组。
  - **Rust 侧**：定义 `Order` 和 `OrderBook` 结构体，使用 `#[wasm_bindgen]` 宏导出。
- **挑战**：在 Rust 中实现 `process_orders(data: &JsValue)`。
- 学习如何使用 `serde-wasm-bindgen` 在 JS 对象和 Rust 结构体之间转换。

### 阶段三：计算密集型任务实装 (核心)

- **任务**：
  - 在 Rust 中实现排序算法（利用 Rust 高效的 `sort_by`）。
  - 实现 `SMA/MACD` 算法。
  - **对比测试**：写一段同样的 JS 逻辑。在 React 中设置一个 Toggle 按钮，分别记录“JS处理耗时”和“Wasm处理耗时”并在界面显示。
- **预期结果**：在数据量小的时候 JS 可能更快（因为 Wasm 有内存拷贝开销），但在处理 10万+ 数组循环时，Wasm 将展现优势。

### 阶段四：内存优化 (进阶)

- **任务**：
  - 避免频繁的 `JsValue` 序列化。
  - 尝试使用 **Shared Memory** 模式（如果浏览器支持）或者直接传递 `Uint8Array` (Byte Array) 到 Rust 内存中，Rust 通过指针读取数据，实现“零拷贝”解析。

## 5. 项目目录结构建议

```bash
rust-quant-lab/
├── api/                 # 模拟后端数据生成
│   └── mockWorker.js    # Web Worker
├── src/                 # React 源码
│   ├── components/
│   │   ├── OrderBook.tsx
│   │   └── Chart.tsx
│   ├── hooks/
│   │   └── useWasm.ts   # 封装调用 Wasm 的逻辑
│   ├── App.tsx
│   └── main.tsx
├── core/                # Rust 源码 (Crate)
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs       # 入口，暴露给 JS 的函数
│       ├── models.rs    # 数据结构定义
│       └── calc.rs      # 金融指标算法 (SMA, MACD)
├── vite.config.ts       # 配置 Wasm 插件
└── package.json