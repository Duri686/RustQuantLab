import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), wasm(), topLevelAwait()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    // 排除 wasm 模块，避免预构建问题
    exclude: ['quant_core'],
  },
});
