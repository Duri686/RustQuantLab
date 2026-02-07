# Phase 3: TradeDrawer 交易面板

> **预计耗时:** 3 小时

---

## 架构设计

```
移动端 (底部滑出):                    桌面端 (右侧滑出):
┌──────────────────────┐             ┌─────────────────┬──────────────┐
│ Chart                │             │                 │  TradeDrawer │
├──────────────────────┤             │     Chart       │  w: 360px    │
│ ┌──────────────────┐ │             │                 │ ┌──────────┐ │
│ │   TradeDrawer    │ │             │                 │ │ [📌] [✕] │ │
│ │   h: 60vh-85vh   │ │             │                 │ │ 杠杆 10x │ │
│ │                  │ │             │                 │ │ [做多]   │ │
│ └──────────────────┘ │             │                 │ └──────────┘ │
└──────────────────────┘             └─────────────────┴──────────────┘
```

---

## Task 3.1: 创建 TradeDrawer 组件

**文件:** 创建 `/src/components/Layout/TradeDrawer/index.tsx`

```tsx
import { memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocalStorage } from '../../../hooks/useLocalStorage';

type TradeSide = 'long' | 'short';

interface TradeDrawerProps {
  open: boolean;
  side: TradeSide;
  onClose: () => void;
  children: React.ReactNode;
}

function TradeDrawer({ open, side, onClose, children }: TradeDrawerProps) {
  const [isPinned, setIsPinned] = useLocalStorage('drawer_pinned', false);
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;

  // Esc 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !isPinned) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, isPinned]);

  if (!open) return null;

  const content = (
    <>
      {/* 遮罩层 - 仅移动端 */}
      {!isDesktop && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer 面板 */}
      <div
        className={`
          fixed z-50 bg-terminal-bg border-border-dark
          transition-transform duration-300 ease-out
          ${isDesktop
            ? 'top-0 right-0 h-full w-[360px] border-l'
            : 'bottom-0 left-0 right-0 h-[60vh] rounded-t-2xl border-t'
          }
          ${open
            ? 'translate-x-0 translate-y-0'
            : isDesktop ? 'translate-x-full' : 'translate-y-full'
          }
        `}
      >
        {/* 顶部栏 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-dark">
          <span className={`font-semibold ${side === 'long' ? 'text-success' : 'text-danger'}`}>
            {side === 'long' ? '做多' : '做空'}
          </span>
          <div className="flex items-center gap-2">
            {isDesktop && (
              <button
                onClick={() => setIsPinned(!isPinned)}
                className={`p-1.5 rounded ${isPinned ? 'bg-gray-700' : 'hover:bg-gray-800'}`}
                title={isPinned ? '取消固定' : '固定'}
              >
                📌
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-gray-800"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-4 overflow-y-auto max-h-[calc(100%-56px)]">
          {children}
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}

export default memo(TradeDrawer);
```

**验证:** `npx tsc --noEmit` 无错误

---

## Task 3.2: 创建 Drawer 内容组件

**文件:** 创建 `/src/components/Layout/TradeDrawer/DrawerContent.tsx`

```tsx
import { memo } from 'react';
import type { Position, TradeFormState } from '../../../types/trading';

interface DrawerContentProps {
  side: 'long' | 'short';
  formState: TradeFormState;
  position?: Position | null;
  onSubmit: () => void;
  onClose: () => void;
}

function DrawerContent({ side, formState, position, onSubmit, onClose }: DrawerContentProps) {
  // 复用现有 TradePanel 的表单逻辑
  return (
    <div className="space-y-4">
      {/* 杠杆滑块 */}
      <div>杠杆: {formState.leverage}x</div>
      
      {/* 保证金模式 */}
      <div>模式: {formState.marginMode}</div>
      
      {/* 数量输入 */}
      <div>Size: {formState.size}</div>
      
      {/* 提交按钮 */}
      <button
        onClick={onSubmit}
        className={`
          w-full h-12 rounded-lg font-semibold text-white
          ${side === 'long' ? 'bg-success' : 'bg-danger'}
        `}
      >
        确认{side === 'long' ? '做多' : '做空'}
      </button>
      
      {/* 持仓信息 */}
      {position && (
        <div className="border-t border-border-dark pt-4 mt-4">
          <div>当前持仓: {position.side} {position.size}</div>
        </div>
      )}
    </div>
  );
}

export default memo(DrawerContent);
```

**验证:** `npx tsc --noEmit` 无错误

---

## Task 3.3: 集成到 App.tsx

**文件:** 修改 `/src/App.tsx`

```tsx
import TradeDrawer from './components/Layout/TradeDrawer';

// 状态
const [drawerOpen, setDrawerOpen] = useState(false);
const [drawerSide, setDrawerSide] = useState<'long' | 'short'>('long');

// 打开函数
const openDrawer = (side: 'long' | 'short') => {
  setDrawerSide(side);
  setDrawerOpen(true);
};

// 渲染
<TradeDrawer
  open={drawerOpen}
  side={drawerSide}
  onClose={() => setDrawerOpen(false)}
>
  <DrawerContent
    side={drawerSide}
    formState={tradeFormState}
    position={currentPosition}
    onSubmit={handleSubmitOrder}
    onClose={() => setDrawerOpen(false)}
  />
</TradeDrawer>
```

**验证:**
- `npm run build` 无错误
- 点击底部按钮，Drawer 正确滑入
- 桌面端固定功能生效
