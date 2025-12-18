import { useState, useEffect, useCallback } from 'react';

// Wasm 模块类型声明
interface WasmModule {
  greet: (name: string) => string;
  add: (a: number, b: number) => number;
}

function App() {
  const [wasmModule, setWasmModule] = useState<WasmModule | null>(null);
  const [greeting, setGreeting] = useState<string>('');
  const [inputName, setInputName] = useState<string>('World');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 初始化 Wasm 模块
  useEffect(() => {
    const initWasm = async () => {
      try {
        // 动态导入 wasm-pack 生成的模块
        const wasm = await import('../core/pkg/quant_core');

        // 初始化 wasm 模块（如果需要）
        if (typeof wasm.default === 'function') {
          await wasm.default();
        }

        setWasmModule(wasm as unknown as WasmModule);
        setLoading(false);
      } catch (err) {
        console.error('Wasm 模块加载失败:', err);
        setError(err instanceof Error ? err.message : '未知错误');
        setLoading(false);
      }
    };

    initWasm();
  }, []);

  // 调用 Rust greet 函数
  const handleGreet = useCallback(() => {
    if (wasmModule) {
      const result = wasmModule.greet(inputName);
      setGreeting(result);
    }
  }, [wasmModule, inputName]);

  // 模块加载完成后自动问候
  useEffect(() => {
    if (wasmModule && !greeting) {
      handleGreet();
    }
  }, [wasmModule, greeting, handleGreet]);

  // 渲染加载状态
  if (loading) {
    return (
      <div className="app">
        <h1>🦀 RustQuantLab</h1>
        <div className="card">
          <p className="loading">正在加载 WebAssembly 模块...</p>
        </div>
      </div>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <div className="app">
        <h1>🦀 RustQuantLab</h1>
        <div className="card">
          <p className="error">加载失败: {error}</p>
          <p>
            请确保已运行 <code>npm run build:wasm</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <h1>🦀 RustQuantLab</h1>
      <p>Rust + WebAssembly + React 通信测试</p>

      <div className="card">
        <h2>Greet Function</h2>
        <div style={{ marginTop: '1rem' }}>
          <input
            type="text"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            placeholder="输入名称"
          />
          <button onClick={handleGreet}>调用 Rust</button>
        </div>

        {greeting && (
          <div className="result">
            <strong>Rust 返回:</strong> {greeting}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Add Function</h2>
        <p>2 + 3 = {wasmModule?.add(2, 3)}</p>
      </div>
    </div>
  );
}

export default App;
