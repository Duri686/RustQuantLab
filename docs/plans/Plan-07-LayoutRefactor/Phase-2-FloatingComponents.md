# Phase 2: 浮动组件

> **预计耗时:** 2 小时

---

## Task 2.1: 创建 FloatingPnL 组件

**文件:** 创建 `/src/components/Layout/FloatingPnL/index.tsx`

```tsx
import { memo } from 'react';
import type { Position } from '../../../types/trading';

interface FloatingPnLProps {
  position?: Position | null;
  onClick?: () => void;
  className?: string;
}

function FloatingPnL({ position, onClick, className = '' }: FloatingPnLProps) {
  const hasPosition = !!position;
  const pnl = position?.unrealizedPnL ?? 0;
  const pnlPercent = position?.unrealizedPnLPercent ?? 0;
  const isProfit = pnl >= 0;

  return (
    <button
      onClick={onClick}
      className={`
        bg-bg-surface/90 backdrop-blur-sm rounded-lg border border-border-dark
        px-3 py-2 shadow-lg transition-all
        hover:bg-bg-surface-elevated active:scale-[0.98]
        ${className}
      `}
    >
      {hasPosition ? (
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-gray-500">
            {position.side === 'Long' ? '多' : '空'}
          </span>
          <span className={`text-sm font-mono font-semibold ${isProfit ? 'text-success' : 'text-danger'}`}>
            {isProfit ? '+' : ''}{pnl.toFixed(2)} USDT
          </span>
          <span className={`text-xs ${isProfit ? 'text-success/70' : 'text-danger/70'}`}>
            ({isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%)
          </span>
        </div>
      ) : (
        <span className="text-xs text-gray-500">暂无持仓</span>
      )}
    </button>
  );
}

export default memo(FloatingPnL);
```

**验证:** `npx tsc --noEmit` 无错误

---

## Task 2.2: 创建 QuickTradeBar 组件

**文件:** 创建 `/src/components/Layout/QuickTradeBar/index.tsx`

```tsx
import { memo } from 'react';

interface QuickTradeBarProps {
  onBuy?: () => void;
  onSell?: () => void;
  disabled?: boolean;
  className?: string;
}

function QuickTradeBar({ onBuy, onSell, disabled, className = '' }: QuickTradeBarProps) {
  return (
    <div className={`
      flex gap-3 px-4 py-3 bg-terminal-bg border-t border-border-dark
      safe-area-pb
      ${className}
    `}>
      <button
        onClick={onBuy}
        disabled={disabled}
        className="
          flex-1 h-12 rounded-lg font-semibold text-white
          bg-success hover:bg-success/90 active:scale-[0.98]
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all
        "
      >
        做多 ↑
      </button>
      <button
        onClick={onSell}
        disabled={disabled}
        className="
          flex-1 h-12 rounded-lg font-semibold text-white
          bg-danger hover:bg-danger/90 active:scale-[0.98]
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all
        "
      >
        做空 ↓
      </button>
    </div>
  );
}

export default memo(QuickTradeBar);
```

**验证:** `npx tsc --noEmit` 无错误

---

## Task 2.3: 集成到 App.tsx

**文件:** 修改 `/src/App.tsx`

```tsx
import FloatingPnL from './components/Layout/FloatingPnL';
import QuickTradeBar from './components/Layout/QuickTradeBar';

// 在 main 区域添加浮动组件
<main className="flex-1 min-h-0 relative">
  <ChartTabs ... />
  
  {/* 浮动持仓摘要 */}
  <FloatingPnL
    position={currentPosition}
    onClick={() => setDrawerOpen(true)}
    className="absolute bottom-4 right-4"
  />
</main>

// 在底部添加快捷操作栏
<QuickTradeBar
  onBuy={() => openDrawer('long')}
  onSell={() => openDrawer('short')}
/>
```

**验证:**
- `npm run build` 无错误
- 浏览器访问，右下角显示持仓卡片，底部显示做多/做空按钮
