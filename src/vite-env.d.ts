/// <reference types="vite/client" />

// Wasm 模块类型声明
declare module '*.wasm' {
  const content: WebAssembly.Module;
  export default content;
}
