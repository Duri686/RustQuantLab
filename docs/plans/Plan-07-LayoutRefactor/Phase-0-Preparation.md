# Phase 0: 准备工作

> **预计耗时:** 30 分钟

---

## Task 0.1: 创建功能分支

**操作:**
```bash
git checkout -b feat/layout-refactor-plan07
```

**验证:** `git branch` 显示当前在新分支

---

## Task 0.2: 备份现有布局代码

**文件:** `/src/App.tsx`

**操作:** 复制当前 App.tsx 的核心布局结构作为参考 (无需实际文件)

**验证:** 理解现有 3 栏布局结构

---

## Task 0.3: 创建组件目录结构

**操作:**
```bash
mkdir -p src/components/Layout/FloatingPnL
mkdir -p src/components/Layout/QuickTradeBar
mkdir -p src/components/Layout/TradeDrawer
mkdir -p src/components/Layout/ChartTabs
```

**验证:** 目录已创建

---

## Task 0.4: 添加 localStorage Hook

**文件:** 创建 `/src/hooks/useLocalStorage.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    setStoredValue((prev) => {
      const valueToStore = value instanceof Function ? value(prev) : value;
      localStorage.setItem(key, JSON.stringify(valueToStore));
      return valueToStore;
    });
  }, [key]);

  return [storedValue, setValue] as const;
}
```

**验证:** `npx tsc --noEmit` 无错误
