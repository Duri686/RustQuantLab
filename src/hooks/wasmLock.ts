/**
 * 全局 Wasm 处理锁
 * 防止多个 hook 并发调用 Wasm 方法导致 "recursive use of an object" 错误
 */

export const wasmLock = {
  isLocked: false,

  acquire(): boolean {
    if (this.isLocked) return false;
    this.isLocked = true;
    return true;
  },

  release(): void {
    this.isLocked = false;
  },
};
