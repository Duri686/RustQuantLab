import { useEffect, useCallback, RefObject } from 'react';
import ReactECharts from 'echarts-for-react';

/**
 * 图表尺寸响应式 Hook
 * 监听容器尺寸变化并自动触发图表 resize
 *
 * @param chartRef - ReactECharts 实例引用
 * @param containerRef - 容器 DOM 元素引用
 */
export function useChartResize(
  chartRef: RefObject<ReactECharts | null>,
  containerRef: RefObject<HTMLDivElement | null>,
): void {
  /**
   * 触发图表 resize
   */
  const handleResize = useCallback(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    if (chartInstance) {
      chartInstance.resize();
    }
  }, [chartRef]);

  /**
   * 监听容器尺寸变化（ResizeObserver + window resize）
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(handleResize);
    });

    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef, handleResize]);
}
