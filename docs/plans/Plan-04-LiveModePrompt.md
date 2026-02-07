# Plan-04: LIVE 模式交易提示 Implementation Plan (实施计划)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal (目标):** 在 LIVE (Binance 实时行情) 模式下显示交易面板的 disabled 状态并说明原因，消除用户困惑。

**Architecture (架构设计):**  
在 `App.tsx` 中将 LIVE 模式下隐藏交易面板的逻辑改为显示 disabled 状态的交易面板，并增加提示文案引导用户切换到 Mock 模式。

```
┌──────────────────────────────────────────────────────────────┐
│                    LIVE 模式                                 │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ⓘ 实时行情模式                                     │    │
│  │                                                     │    │
│  │     实时行情仅供观察学习                             │    │
│  │     如需模拟交易，请切换至 Mock 模式                 │    │
│  │                                                     │    │
│  │     [切换至 Mock 模式]                              │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

**Tech Stack (技术栈):** React 18, TypeScript 5, Tailwind CSS

---

## Task 1: 创建 LiveModeNotice 组件

**Files:**
- Create: `/Users/duri/githubStudy/RustQuantLab/src/components/Dashboard/Trade/LiveModeNotice.tsx`

**Step 1: 创建组件**

```tsx
import { memo } from 'react';

interface LiveModeNoticeProps {
  onSwitchToMock?: () => void;
}

/**
 * LiveModeNotice - LIVE 模式交易提示
 * 
 * 在 Binance 实时行情模式下显示，提示用户切换至 Mock 模式进行模拟交易
 */
function LiveModeNotice({ onSwitchToMock }: LiveModeNoticeProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] 
                    p-6 text-center">
      {/* 图标 */}
      <div className="w-16 h-16 mb-4 rounded-full bg-blue-500/10 
                      flex items-center justify-center">
        <svg 
          className="w-8 h-8 text-blue-400" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
      </div>

      {/* 标题 */}
      <h3 className="text-lg font-semibold text-white mb-2">
        实时行情模式
      </h3>

      {/* 说明 */}
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
        当前连接 Binance 实时行情，仅供观察学习。
        <br />
        如需模拟交易，请切换至 Mock 模式。
      </p>

      {/* 切换按钮 */}
      {onSwitchToMock && (
        <button
          type="button"
          onClick={onSwitchToMock}
          className="px-6 py-2.5 text-sm font-medium text-white 
                     bg-gradient-to-r from-yellow-500 to-yellow-600 
                     hover:from-yellow-400 hover:to-yellow-500
                     rounded-lg transition-all shadow-lg shadow-yellow-500/20"
        >
          切换至 Mock 模式
        </button>
      )}

      {/* 补充说明 */}
      <p className="text-xs text-gray-500 mt-4 max-w-xs">
        💡 Mock 模式使用模拟数据，安全无风险
      </p>
    </div>
  );
}

export default memo(LiveModeNotice);
```

**Step 2: 导出组件**

在 `/Users/duri/githubStudy/RustQuantLab/src/components/Dashboard/Trade/index.ts` 添加：

```tsx
export { default as LiveModeNotice } from './LiveModeNotice';
```

**Step 3: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误

---

## Task 2: 修改 App.tsx 渲染逻辑

**Files:**
- Modify: `/Users/duri/githubStudy/RustQuantLab/src/App.tsx`

**Step 1: 导入 LiveModeNotice**

```tsx
import { LiveModeNotice } from './components/Dashboard/Trade';
```

**Step 2: 找到交易面板渲染逻辑**

当前代码（约第 511 行）：

```tsx
{dataSource === 'mock' && (
  <section className="hidden xl:block ...">
    <TradePanel ... />
  </section>
)}
```

**Step 3: 修改为始终显示，根据模式切换内容**

```tsx
{/* 交易面板 - 根据数据源显示不同内容 */}
<section className="hidden xl:block w-80 flex-shrink-0 space-y-4">
  {dataSource === 'mock' ? (
    <TradePanel 
      // ... 原有 props
    />
  ) : (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800">
      <LiveModeNotice 
        onSwitchToMock={() => setDataSource('mock')} 
      />
    </div>
  )}
</section>
```

**Step 4: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误
- Manual: 切换至 LIVE 模式，验证显示友好提示而非空白

---

## Task 3: 添加 Header 数据源切换提示

**Files:**
- Modify: `/Users/duri/githubStudy/RustQuantLab/src/App.tsx` (Header 区域)

**Step 1: 在数据源切换按钮旁添加提示 Badge**

找到数据源切换按钮，添加模式说明：

```tsx
{/* 数据源切换区域 */}
<div className="flex items-center gap-2">
  {/* 原有切换按钮 */}
  <button onClick={() => setDataSource(dataSource === 'mock' ? 'binance' : 'mock')}>
    {dataSource === 'mock' ? 'Mock' : 'LIVE'}
  </button>
  
  {/* 新增: 模式说明 Badge */}
  <span className={`text-xs px-2 py-0.5 rounded-full ${
    dataSource === 'mock' 
      ? 'bg-green-500/10 text-green-400'
      : 'bg-blue-500/10 text-blue-400'
  }`}>
    {dataSource === 'mock' ? '可交易' : '仅观察'}
  </span>
</div>
```

**Step 2: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误
- Manual: 切换模式，验证 Badge 正确显示"可交易"或"仅观察"

---

## Task 4: Mobile 端 LIVE 模式提示

**Files:**
- Modify: `/Users/duri/githubStudy/RustQuantLab/src/App.tsx` (Mobile 区域)

**Step 1: 找到 Mobile 底部交易栏逻辑**

当前移动端 TradePanel 也可能有类似的条件渲染，需要统一处理。

**Step 2: 添加 LIVE 模式时的底部提示栏**

```tsx
{/* Mobile 底部区域 */}
<div className="xl:hidden fixed bottom-0 left-0 right-0 safe-area-inset-bottom">
  {dataSource === 'mock' ? (
    // 原有 TradePanel BottomSheet
    <MobileTradebar ... />
  ) : (
    // LIVE 模式提示
    <div className="bg-gray-900 border-t border-gray-800 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-blue-400">ⓘ</span>
          <span className="text-sm text-gray-400">实时行情仅供观察</span>
        </div>
        <button
          onClick={() => setDataSource('mock')}
          className="text-sm text-yellow-400 font-medium"
        >
          切换至 Mock
        </button>
      </div>
    </div>
  )}
</div>
```

**Step 3: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误
- Manual: 在移动端视图下切换至 LIVE 模式，验证底部提示显示

---

## 验证清单

| 任务 | 验证方式 | 预期结果 |
|------|----------|----------|
| Task 1 | 编译通过 | LiveModeNotice 组件创建成功 |
| Task 2 | LIVE 模式 Desktop | 交易区域显示友好提示+切换按钮 |
| Task 3 | 切换数据源 | Header Badge 显示"可交易"或"仅观察" |
| Task 4 | LIVE 模式 Mobile | 底部显示提示栏+切换按钮 |

---

> 📌 完成后更新 [README.md](./README.md) 中 Plan-04 状态为 ✅
