# Plan-06: 风险可视化升级 Implementation Plan (实施计划)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal (目标):** 升级风险信息的视觉层级，将强平距离改为进度条可视化，保证金率使用仪表盘展示，优化 Critical 状态反馈。

**Architecture (架构设计):**  
创建 `RiskGauge` 和 `LiquidationProgress` 可视化组件，替换 PositionCard 中的纯数字/Badge 展示。使用 CSS 渐变实现颜色过渡（绿→黄→红）。

```
┌─────────────────────────────────────────────────────────────┐
│                    风险可视化升级                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Before                        After                       │
│   ┌─────────────┐              ┌─────────────────────┐      │
│   │ 距强平 15%   │              │ ██████████░░░░░ 15% │ ←进度条│
│   │ Badge:Safe  │   ───►       │ [━━━━━] 保证金率 85%  │ ←仪表盘│
│   └─────────────┘              │ 状态: 🟢 安全        │      │
│                                └─────────────────────┘      │
│                                                             │
│   Critical 状态优化:                                         │
│   - 移除持续 pulse 动画 (刺眼)                                │
│   - 改为: 红色边框 + 一次性震动 + Toast 通知                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Tech Stack (技术栈):** React 18, TypeScript 5, Tailwind CSS, CSS Gradient

---

## Task 1: 创建 LiquidationProgress 组件

**Files:**
- Create: `/Users/duri/githubStudy/RustQuantLab/src/components/Dashboard/Trade/components/LiquidationProgress.tsx`

**Step 1: 创建组件**

```tsx
import { memo, useMemo } from 'react';
import type { RiskLevel } from '../../../../types/trading';

interface LiquidationProgressProps {
  /** 距强平百分比 (0-100)，如 15 表示距强平 15% */
  distancePercent: number;
  /** 风险等级 */
  riskLevel: RiskLevel;
  /** 是否显示标签 */
  showLabel?: boolean;
}

/**
 * LiquidationProgress - 强平距离进度条
 * 
 * 可视化展示距离强平的百分比，颜色根据风险等级渐变
 * - Safe: 绿色 (距离远)
 * - Warning: 黄色
 * - Danger: 橙色
 * - Critical: 红色 (即将强平)
 */
function LiquidationProgress({
  distancePercent,
  riskLevel,
  showLabel = true,
}: LiquidationProgressProps) {
  // 计算进度条样式
  const { progressWidth, progressColor, bgColor } = useMemo(() => {
    // 将距离百分比反转为"已用百分比"以便可视化
    // 距离 0% = 100% 已用 (红色), 距离 100% = 0% 已用 (绿色)
    const usedPercent = Math.max(0, Math.min(100, 100 - distancePercent));
    
    // 根据风险等级确定颜色
    const colorMap: Record<RiskLevel, { progress: string; bg: string }> = {
      Safe: { 
        progress: 'bg-gradient-to-r from-green-500 to-green-400', 
        bg: 'bg-green-500/10' 
      },
      Low: { 
        progress: 'bg-gradient-to-r from-green-400 to-yellow-400', 
        bg: 'bg-yellow-500/10' 
      },
      Medium: { 
        progress: 'bg-gradient-to-r from-yellow-400 to-orange-400', 
        bg: 'bg-orange-500/10' 
      },
      High: { 
        progress: 'bg-gradient-to-r from-orange-400 to-red-400', 
        bg: 'bg-red-500/10' 
      },
      Critical: { 
        progress: 'bg-gradient-to-r from-red-500 to-red-600', 
        bg: 'bg-red-500/20' 
      },
    };
    
    return {
      progressWidth: usedPercent,
      progressColor: colorMap[riskLevel].progress,
      bgColor: colorMap[riskLevel].bg,
    };
  }, [distancePercent, riskLevel]);

  return (
    <div className="space-y-1">
      {/* 标签 */}
      {showLabel && (
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">距强平</span>
          <span className={
            riskLevel === 'Critical' ? 'text-red-400 font-medium' :
            riskLevel === 'High' ? 'text-orange-400' :
            riskLevel === 'Medium' ? 'text-yellow-400' :
            'text-gray-400'
          }>
            {distancePercent.toFixed(1)}%
          </span>
        </div>
      )}
      
      {/* 进度条 */}
      <div className={`h-2 rounded-full overflow-hidden ${bgColor}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>
    </div>
  );
}

export default memo(LiquidationProgress);
```

**Step 2: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误

---

## Task 2: 创建 MarginRatioGauge 组件

**Files:**
- Create: `/Users/duri/githubStudy/RustQuantLab/src/components/Dashboard/Trade/components/MarginRatioGauge.tsx`

**Step 1: 创建仪表盘组件**

```tsx
import { memo, useMemo } from 'react';
import type { RiskLevel } from '../../../../types/trading';

interface MarginRatioGaugeProps {
  /** 保证金率百分比 (0-100+) */
  marginRatio: number;
  /** 维持保证金率 (用于显示警戒线) */
  maintenanceMarginRate?: number;
  /** 风险等级 */
  riskLevel: RiskLevel;
}

/**
 * MarginRatioGauge - 保证金率仪表盘
 * 
 * 半圆仪表盘展示保证金率健康程度
 * - 绿色区: 充足 (> 50%)
 * - 黄色区: 警告 (20-50%)
 * - 红色区: 危险 (< 20%)
 */
function MarginRatioGauge({
  marginRatio,
  maintenanceMarginRate = 1,
  riskLevel,
}: MarginRatioGaugeProps) {
  // 计算仪表盘角度和颜色
  const { angle, strokeColor, statusIcon } = useMemo(() => {
    // 将保证金率映射到 0-180 度
    // 0% → 180° (最危险), 100%+ → 0° (最安全)
    const clampedRatio = Math.max(0, Math.min(100, marginRatio));
    const deg = 180 - (clampedRatio / 100) * 180;
    
    // 根据风险等级确定颜色和图标
    const colorMap: Record<RiskLevel, { stroke: string; icon: string }> = {
      Safe: { stroke: '#22c55e', icon: '✓' },
      Low: { stroke: '#84cc16', icon: '✓' },
      Medium: { stroke: '#eab308', icon: '⚠' },
      High: { stroke: '#f97316', icon: '⚠' },
      Critical: { stroke: '#ef4444', icon: '⛔' },
    };
    
    return {
      angle: deg,
      strokeColor: colorMap[riskLevel].stroke,
      statusIcon: colorMap[riskLevel].icon,
    };
  }, [marginRatio, riskLevel]);

  return (
    <div className="flex items-center gap-3">
      {/* 简化版文字展示 (替代复杂 SVG 仪表盘) */}
      <div className="relative flex items-center gap-2">
        {/* 状态图标 */}
        <span 
          className="text-lg"
          style={{ color: strokeColor }}
        >
          {statusIcon}
        </span>
        
        {/* 保证金率数值 */}
        <div className="flex flex-col">
          <span className="text-xs text-gray-500">保证金率</span>
          <span 
            className="text-sm font-medium"
            style={{ color: strokeColor }}
          >
            {marginRatio.toFixed(1)}%
          </span>
        </div>
      </div>
      
      {/* 维持保证金率参考线 */}
      {maintenanceMarginRate > 0 && (
        <div className="text-xs text-gray-600">
          维持: {maintenanceMarginRate}%
        </div>
      )}
    </div>
  );
}

export default memo(MarginRatioGauge);
```

**Step 2: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误

---

## Task 3: 更新 PositionCard 集成新组件

**Files:**
- Modify: `/Users/duri/githubStudy/RustQuantLab/src/components/Dashboard/Trade/PositionCard.tsx`

**Step 1: 导入新组件**

```tsx
import LiquidationProgress from './components/LiquidationProgress';
import MarginRatioGauge from './components/MarginRatioGauge';
```

**Step 2: 替换原有风险展示区域**

找到原有的风险信息展示区域（包含 Badge 和 "距强平 XX%" 文本），替换为：

```tsx
{/* 风险可视化区域 */}
{riskAssessment && (
  <div className="mt-3 pt-3 border-t border-gray-800 space-y-3">
    {/* 强平距离进度条 */}
    <LiquidationProgress
      distancePercent={riskAssessment.distanceToLiquidation ?? 0}
      riskLevel={riskAssessment.riskLevel}
    />
    
    {/* 保证金率仪表盘 */}
    <MarginRatioGauge
      marginRatio={riskAssessment.marginRatio ?? 0}
      maintenanceMarginRate={riskAssessment.maintenanceMarginRate}
      riskLevel={riskAssessment.riskLevel}
    />
  </div>
)}
```

**Step 3: 移除原有的小字体风险文本和 Badge**

删除之前使用 `9px` 字体的 "距强平 XX%" 和 `10px` Badge。

**Step 4: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误
- Manual: 开仓后查看 PositionCard，验证进度条和仪表盘正确显示

---

## Task 4: 优化 Critical 状态反馈

**Files:**
- Modify: `/Users/duri/githubStudy/RustQuantLab/src/components/Dashboard/Trade/PositionCard.tsx`

**Step 1: 移除持续 pulse 动画**

找到 `animate-pulse` 类名，删除或替换：

```tsx
// 原来:
className={`... ${riskLevel === 'Critical' && 'animate-pulse'}`}

// 改为: 静态红色边框
className={`... ${riskLevel === 'Critical' && 'border-red-500 shadow-red-500/20 shadow-lg'}`}
```

**Step 2: 添加 Critical 状态一次性震动效果**

使用 `useEffect` 在进入 Critical 状态时触发一次震动：

```tsx
import { useEffect, useRef } from 'react';

// 在组件内
const prevRiskLevel = useRef<RiskLevel | null>(null);

useEffect(() => {
  // 仅在从非 Critical 变为 Critical 时触发
  if (
    riskAssessment?.riskLevel === 'Critical' && 
    prevRiskLevel.current !== 'Critical'
  ) {
    // 触发震动 (如果设备支持)
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 200]);
    }
    
    // 添加一次性 shake 动画
    const card = document.getElementById(`position-card-${position.id}`);
    if (card) {
      card.classList.add('animate-shake');
      setTimeout(() => card.classList.remove('animate-shake'), 500);
    }
  }
  prevRiskLevel.current = riskAssessment?.riskLevel ?? null;
}, [riskAssessment?.riskLevel, position.id]);
```

**Step 3: 添加 shake 动画 CSS**

在 `/Users/duri/githubStudy/RustQuantLab/src/index.css` 添加：

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

.animate-shake {
  animation: shake 0.5s ease-in-out;
}
```

**Step 4: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误
- Manual: 调整杠杆使仓位进入 Critical 状态，验证震动效果

---

## Task 5: 导出新组件

**Files:**
- Modify: `/Users/duri/githubStudy/RustQuantLab/src/components/Dashboard/Trade/components/index.ts`

**Step 1: 创建或更新导出文件**

```tsx
export { default as LiquidationProgress } from './LiquidationProgress';
export { default as MarginRatioGauge } from './MarginRatioGauge';
```

**Step 2: Verification (Validation)**
- Command: `npm run build`
- Expected: 无编译错误

---

## 验证清单

| 任务 | 验证方式 | 预期结果 |
|------|----------|----------|
| Task 1 | 编译通过 | LiquidationProgress 组件创建成功 |
| Task 2 | 编译通过 | MarginRatioGauge 组件创建成功 |
| Task 3 | 有持仓时查看 PositionCard | 显示进度条和仪表盘 |
| Task 4 | 进入 Critical 状态 | 红色边框 + 一次性震动，无持续 pulse |
| Task 5 | 编译通过 | 组件导出正常 |

---

## 设计规格

### 颜色渐变规则

| 风险等级 | 进度条颜色 | 仪表盘颜色 | 状态图标 |
|----------|-----------|-----------|----------|
| Safe | `green-500 → green-400` | `#22c55e` | ✓ |
| Low | `green-400 → yellow-400` | `#84cc16` | ✓ |
| Medium | `yellow-400 → orange-400` | `#eab308` | ⚠ |
| High | `orange-400 → red-400` | `#f97316` | ⚠ |
| Critical | `red-500 → red-600` | `#ef4444` | ⛔ |

### Critical 状态交互

- **视觉**: 红色边框 + 红色阴影 (静态，不闪烁)
- **触觉**: 进入 Critical 时一次性震动 `[100, 50, 200]ms`
- **动画**: 一次性 shake 动画 (0.5s)
- **Toast**: 节流通知 "接近强平价格" (由现有逻辑处理)

---

> 📌 完成后更新 [README.md](./README.md) 中 Plan-06 状态为 ✅
