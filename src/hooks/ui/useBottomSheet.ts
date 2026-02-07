/**
 * useBottomSheet — 移动端 Bottom Sheet 手势 Hook
 *
 * 基于 @use-gesture/react + @react-spring/web
 * 支持上滑展开、下滑收起、拖拽跟随手指
 */

import { useCallback, useRef } from 'react';
import { useSpring } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

export interface UseBottomSheetOptions {
  /** 是否展开 */
  open: boolean;
  /** 展开/收起回调 */
  onOpenChange: (open: boolean) => void;
  /** sheet 最大高度 (vh 百分比, 默认 85) */
  maxHeightVh?: number;
  /** 下滑关闭阈值 (px, 默认 80) */
  closeThreshold?: number;
  /** 上滑打开阈值 (px, 默认 60) */
  openThreshold?: number;
}

export interface UseBottomSheetReturn {
  /** 绑定到 drag handle 的手势属性 */
  bindDrag: ReturnType<typeof useDrag>;
  /** 绑定到收起态 bar 的上滑手势 */
  bindSwipeUp: ReturnType<typeof useDrag>;
  /** spring style (translateY + opacity) 用于 animated.div */
  sheetStyle: {
    y: ReturnType<typeof useSpring>[0]['y'];
  };
  /** backdrop spring style */
  backdropStyle: {
    opacity: ReturnType<typeof useSpring>[0]['opacity'];
  };
}

export function useBottomSheet({
  open,
  onOpenChange,
  maxHeightVh = 85,
  closeThreshold = 80,
  openThreshold = 60,
}: UseBottomSheetOptions): UseBottomSheetReturn {
  const sheetHeightRef = useRef(0);

  // 计算 sheet 实际高度 (px)
  const getSheetHeight = useCallback(() => {
    if (sheetHeightRef.current > 0) return sheetHeightRef.current;
    const h = (window.innerHeight * maxHeightVh) / 100;
    sheetHeightRef.current = h;
    return h;
  }, [maxHeightVh]);

  // Sheet spring: y=0 表示完全展开, y=sheetHeight 表示完全收起
  const [sheetSpring, sheetApi] = useSpring(() => ({
    y: open ? 0 : getSheetHeight(),
    config: { tension: 300, friction: 30 },
  }));

  // Backdrop spring
  const [backdropSpring, backdropApi] = useSpring(() => ({
    opacity: open ? 1 : 0,
    config: { tension: 300, friction: 30 },
  }));

  // 展开
  const openSheet = useCallback(() => {
    sheetApi.start({ y: 0 });
    backdropApi.start({ opacity: 1 });
    onOpenChange(true);
  }, [sheetApi, backdropApi, onOpenChange]);

  // 收起
  const closeSheet = useCallback(() => {
    sheetApi.start({ y: getSheetHeight() });
    backdropApi.start({ opacity: 0 });
    onOpenChange(false);
  }, [sheetApi, backdropApi, onOpenChange, getSheetHeight]);

  // Sheet 内部拖拽 (drag handle 区域)
  const bindDrag = useDrag(
    ({ down, movement: [, my], velocity: [, vy] }) => {
      // 只允许向下拖拽 (my > 0)
      if (my < 0) {
        sheetApi.start({ y: 0, immediate: true });
        return;
      }

      if (down) {
        // 拖拽中: sheet 跟随手指
        sheetApi.start({ y: my, immediate: true });
        backdropApi.start({
          opacity: Math.max(0, 1 - my / getSheetHeight()),
          immediate: true,
        });
      } else {
        // 松手: 判断是否超过阈值或速度够快
        if (my > closeThreshold || vy > 0.5) {
          closeSheet();
        } else {
          // 弹回展开态
          sheetApi.start({ y: 0 });
          backdropApi.start({ opacity: 1 });
        }
      }
    },
    {
      axis: 'y',
      filterTaps: true,
      bounds: { top: 0 },
      rubberband: true,
    },
  );

  // 收起态上滑手势
  const bindSwipeUp = useDrag(
    ({ down, movement: [, my], velocity: [, vy], direction: [, dy] }) => {
      if (down) return; // 只在松手时判断
      // 上滑 (my < 0, dy < 0) 超过阈值
      if (my < -openThreshold || (vy > 0.3 && dy < 0)) {
        openSheet();
      }
    },
    {
      axis: 'y',
      filterTaps: true,
    },
  );

  return {
    bindDrag,
    bindSwipeUp,
    sheetStyle: { y: sheetSpring.y },
    backdropStyle: { opacity: backdropSpring.opacity },
  };
}
