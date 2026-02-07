# Phase 4: 交互优化

> **预计耗时:** 1.5 小时

---

## Task 4.1: 添加键盘快捷键

**文件:** 修改 `/src/App.tsx`

```tsx
// 键盘快捷键
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // 排除输入框焦点
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    if (e.key.toLowerCase() === 'b' && !drawerOpen) {
      openDrawer('long');
    } else if (e.key.toLowerCase() === 's' && !drawerOpen) {
      openDrawer('short');
    }
    // Esc 已在 TradeDrawer 内处理
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [drawerOpen]);
```

**验证:**
- 按 `B` 打开做多 Drawer
- 按 `S` 打开做空 Drawer
- 按 `Esc` 关闭 Drawer

---

## Task 4.2: 添加 Drawer 动画

**文件:** 修改 `/src/index.css`

```css
/* Drawer 动画 */
@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes slide-in-bottom {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.drawer-animate-right {
  animation: slide-in-right 0.3s ease-out;
}

.drawer-animate-bottom {
  animation: slide-in-bottom 0.3s ease-out;
}

.drawer-overlay-animate {
  animation: fade-in 0.2s ease-out;
}
```

**验证:** Drawer 滑入动画流畅

---

## Task 4.3: 按钮颜色随 Side 变化

**文件:** 修改 TradeDrawer 提交按钮

```tsx
<button
  className={`
    w-full h-12 rounded-lg font-semibold text-white transition-colors
    ${side === 'long'
      ? 'bg-success hover:bg-success/90'
      : 'bg-danger hover:bg-danger/90'
    }
    active:scale-[0.98]
  `}
>
  确认{side === 'long' ? '做多' : '做空'}
</button>
```

**验证:** 按钮颜色正确

---

## Task 4.4: 触觉反馈

**文件:** 修改按钮点击

```tsx
const handleClick = () => {
  // 触觉反馈
  if (navigator.vibrate) {
    navigator.vibrate(20);
  }
  onClick?.();
};
```

**验证:** 移动端点击有轻微振动反馈

---

## 最终验收

1. ✅ 移动端图表全屏
2. ✅ 底部按钮始终可点击
3. ✅ 持仓摘要浮动右下角
4. ✅ Drawer 滑入时图表仍可见
5. ✅ 键盘快捷键 B/S/Esc 生效
6. ✅ 桌面端固定模式 localStorage 持久化
7. ✅ `npm run build` 无错误
