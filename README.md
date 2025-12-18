# 🦀 RustQuantLab

**探索 WebAssembly 在高频金融数据处理场景中的性能边界**

[![Rust](https://img.shields.io/badge/Rust-2021-orange?logo=rust)](https://www.rust-lang.org/)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-Enabled-654FF0?logo=webassembly)](https://webassembly.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

## 项目背景

在证券交易 Web 端，面临高频行情推送（每秒数十至上百次更新）时，JavaScript 在主线程进行大量数据的序列化、排序、聚合及金融指标计算，容易造成 **UI 掉帧与卡顿**。

本项目旨在通过 **Rust + WebAssembly** 接管核心计算逻辑，验证其相比纯 JavaScript 的性能优势。

## 研究目标

- 🔬 **性能对比**：量化 Wasm vs JavaScript 在大规模数据处理中的性能差异
- 📊 **实战场景**：模拟高频行情推送、订单簿聚合、技术指标计算（SMA/MACD）
- 🧠 **最佳实践**：探索 JS ↔ Rust 数据传递的优化策略（零拷贝、SharedArrayBuffer）

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      React 18 + TypeScript                  │
│                        (展示层 / UI)                         │
├─────────────────────────────────────────────────────────────┤
│                      wasm-bindgen                           │
│                      (通信桥梁)                              │
├─────────────────────────────────────────────────────────────┤
│                   Rust → WebAssembly                        │
│              (核心计算: 排序/聚合/指标计算)                    │
├─────────────────────────────────────────────────────────────┤
│                     Web Worker                              │
│                  (Mock 高频数据生成器)                        │
└─────────────────────────────────────────────────────────────┘
```

| 层级 | 技术选型 |
|------|----------|
| 构建工具 | Vite 5 + vite-plugin-wasm |
| 前端框架 | React 18 + TypeScript |
| 核心计算 | Rust (2021 Edition) → WebAssembly |
| 样式方案 | Tailwind CSS v4 |
| 数据模拟 | Web Worker + Mock Generator |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（自动编译 Rust → Wasm）
npm run dev
```

> **前置条件**：需安装 [Rust](https://rustup.rs/) 和 [wasm-pack](https://rustwasm.github.io/wasm-pack/)

## 项目状态

🚧 **开发中** - 当前为 MVP 阶段，已完成基础框架搭建

- [x] Vite + React + TypeScript 工程初始化
- [x] Rust + wasm-pack 编译流程
- [x] JS ↔ Wasm 双向通信验证
- [ ] 高频行情 Mock 数据生成器
- [ ] 订单簿聚合算法 (Rust)
- [ ] SMA/MACD 技术指标计算
- [ ] 性能对比面板

## 适合谁

- 🎯 前端工程师希望学习 **Rust + WebAssembly**
- 🎯 对金融交易系统性能优化感兴趣的开发者
- 🎯 探索浏览器端高性能计算方案的研究者

## License

[MIT](./LICENSE)
