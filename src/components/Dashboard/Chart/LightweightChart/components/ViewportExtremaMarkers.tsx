/**
 * ViewportExtremaMarkers 组件
 *
 * 职责：渲染当前可视范围内 K 线的最高/最低价标记（箭头 + 价格文本）。
 * - 最高价：在上方显示，箭头向下
 * - 最低价：在下方显示，箭头向上
 * - 边缘防截断：接近左右边界时内收
 */

import React from 'react';
import type { ViewportExtremaPoint } from '../hooks/useViewportExtrema';

export interface ViewportExtremaMarkersProps {
  high: ViewportExtremaPoint | null;
  low: ViewportExtremaPoint | null;
  /** 主图 pane 顶部偏移量（像素） */
  pricePaneTop: number;
  /** 主图 pane 宽度（像素） */
  paneWidth: number;
}

export const ViewportExtremaMarkers: React.FC<ViewportExtremaMarkersProps> =
  React.memo(function ViewportExtremaMarkers({
    high,
    low,
    pricePaneTop,
    paneWidth,
  }) {
    // 文本宽度的简易估算（像素），避免被左右边缘截断
    const estimateLabelWidth = (label: string) =>
      Math.min(96, Math.max(48, label.length * 8));

    const H_OFFSET = 6; // 水平内收间距
    const V_GAP = 6; // 与 K 线的垂直间距，避免遮挡

    const renderHigh = () => {
      if (!high) return null;
      const width = estimateLabelWidth(high.label);
      let left = high.x - width / 2;
      if (left < H_OFFSET) left = H_OFFSET;
      if (left + width > paneWidth - H_OFFSET)
        left = paneWidth - H_OFFSET - width;
      const top = pricePaneTop + Math.max(0, high.y - V_GAP - 18); // 18 约等于标签高度
      return (
        <div
          className="absolute z-20 text-[10px] leading-none font-mono text-neutral-100 pointer-events-none"
          style={{ left: `${left}px`, top: `${top}px`, width: `${width}px` }}
        >
          {/* 文本 */}
          <div className="mx-auto w-full text-center px-2 py-1 rounded bg-bg-surface-alt/90 backdrop-blur-sm">
            {high.label}
          </div>
          {/* 向下箭头 */}
          <div className="mx-auto w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-bg-surface-alt" />
        </div>
      );
    };

    const renderLow = () => {
      if (!low) return null;
      const width = estimateLabelWidth(low.label);
      let left = low.x - width / 2;
      if (left < H_OFFSET) left = H_OFFSET;
      if (left + width > paneWidth - H_OFFSET)
        left = paneWidth - H_OFFSET - width;
      const top = pricePaneTop + low.y + V_GAP;
      return (
        <div
          className="absolute z-20 text-[10px] leading-none font-mono text-neutral-100 pointer-events-none"
          style={{ left: `${left}px`, top: `${top}px`, width: `${width}px` }}
        >
          {/* 向上箭头 */}
          <div className="mx-auto w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-bg-surface-alt" />
          {/* 文本 */}
          <div className="mx-auto w-full text-center px-2 py-1 rounded bg-bg-surface-alt/90 backdrop-blur-sm">
            {low.label}
          </div>
        </div>
      );
    };

    return (
      <>
        {renderHigh()}
        {renderLow()}
      </>
    );
  });
