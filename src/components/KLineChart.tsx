import { useMemo, useRef, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { EChartsReactProps } from 'echarts-for-react';
import type { Candle } from '../types/index';

/**
 * K 线图表颜色配置 (TradingView/Binance 风格)
 */
const CHART_COLORS = {
  /** 上涨颜色 - Neon Green */
  UP: '#0ECB81',
  /** 下跌颜色 - Neon Red */
  DOWN: '#F6465D',
  /** MA5 线颜色 - Purple */
  MA5: '#A371F7',
  /** MA10 线颜色 - Yellow/Gold */
  MA10: '#EBCB8B',
  /** MA20 线颜色 - Cyan/Blue */
  MA20: '#61C3EA',
  /** MA30 线颜色 - Soft Red */
  MA30: '#FF6B6B',
  /** 背景色 */
  BACKGROUND: 'transparent',
  /** 网格线颜色 */
  GRID_LINE: 'rgba(255, 255, 255, 0.06)',
  /** 轴标签颜色 */
  AXIS_LABEL: '#888',
  /** 轴线颜色 */
  AXIS_LINE: '#333',
  /** 十字准星颜色 */
  CROSSHAIR: 'rgba(255, 255, 255, 0.3)',
};

/**
 * KLineChart 组件 Props
 */
interface KLineChartProps {
  /** 已完成的 K 线历史数据 */
  candleHistory: Candle[];
  /** 当前实时 K 线（正在形成中） */
  currentLiveCandle: Candle | null;
}

/**
 * 专业 K 线图表组件
 * 使用 Apache ECharts 渲染 TradingView 风格的蜡烛图
 */
function KLineChart({ candleHistory, currentLiveCandle }: KLineChartProps) {
  const chartRef = useRef<ReactECharts>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * 触发图表 resize
   */
  const handleResize = useCallback(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    if (chartInstance) {
      chartInstance.resize();
    }
  }, []);

  /**
   * 监听容器尺寸变化（ResizeObserver）
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      // 使用 requestAnimationFrame 避免过于频繁的 resize
      requestAnimationFrame(handleResize);
    });

    resizeObserver.observe(container);

    // 同时监听 window resize 作为备用
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);

  // 合并历史 + 实时 K 线
  const allCandles = useMemo(() => {
    if (currentLiveCandle) {
      return [...candleHistory, currentLiveCandle];
    }
    return candleHistory;
  }, [candleHistory, currentLiveCandle]);

  // 提取图表数据
  const chartData = useMemo(() => {
    const times = allCandles.map((c) => c.timeStr);
    // ECharts candlestick 数据格式: [open, close, low, high]
    const klineData = allCandles.map((c) => [c.open, c.close, c.low, c.high]);
    const volumeData = allCandles.map((c) => ({
      value: c.volume,
      itemStyle: {
        color: c.close >= c.open ? CHART_COLORS.UP : CHART_COLORS.DOWN,
        opacity: 0.7,
      },
    }));
    const ma5Data = allCandles.map((c) => c.ma5);
    const ma10Data = allCandles.map((c) => c.ma10);
    const ma20Data = allCandles.map((c) => c.ma20);
    const ma30Data = allCandles.map((c) => c.ma30);

    return {
      times,
      klineData,
      volumeData,
      ma5Data,
      ma10Data,
      ma20Data,
      ma30Data,
    };
  }, [allCandles]);

  // 计算 Y 轴价格范围（自适应）
  const priceRange = useMemo(() => {
    if (allCandles.length === 0) return { min: 0, max: 100 };
    const allPrices = allCandles.flatMap((c) => [c.high, c.low]);
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const padding = (max - min) * 0.05 || 1;
    return { min: min - padding, max: max + padding };
  }, [allCandles]);

  // ECharts 配置
  const option: EChartsOption = useMemo(
    () => ({
      animation: true,
      animationDuration: 0,
      animationDurationUpdate: 300,
      animationEasing: 'cubicOut',
      backgroundColor: CHART_COLORS.BACKGROUND,

      // 工具提示
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: CHART_COLORS.CROSSHAIR,
          },
          lineStyle: {
            color: CHART_COLORS.CROSSHAIR,
            type: 'dashed',
          },
        },
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        borderColor: '#333',
        borderWidth: 1,
        textStyle: {
          color: '#fff',
          fontSize: 12,
        },
        formatter: (params: unknown) => {
          const paramArr = params as Array<{
            axisValue: string;
            seriesName: string;
            data: number | number[] | { value: number };
            color: string;
          }>;
          if (!paramArr || paramArr.length === 0) return '';

          const time = paramArr[0].axisValue;
          let html = `<div style="font-weight:600;margin-bottom:6px;color:#aaa">${time}</div>`;

          paramArr.forEach((p) => {
            if (p.seriesName === 'K线') {
              const d = p.data as number[];
              if (d && d.length >= 4) {
                const [open, close, low, high] = d;
                const isUp = close >= open;
                const color = isUp ? CHART_COLORS.UP : CHART_COLORS.DOWN;
                html += `
                  <div style="display:flex;justify-content:space-between;gap:16px">
                    <span style="color:#888">开</span><span style="color:${color}">${open.toFixed(
                  2,
                )}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;gap:16px">
                    <span style="color:#888">高</span><span style="color:${color}">${high.toFixed(
                  2,
                )}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;gap:16px">
                    <span style="color:#888">低</span><span style="color:${color}">${low.toFixed(
                  2,
                )}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;gap:16px">
                    <span style="color:#888">收</span><span style="color:${color}">${close.toFixed(
                  2,
                )}</span>
                  </div>
                `;
              }
            } else if (p.seriesName === 'MA5' && typeof p.data === 'number') {
              html += `<div style="color:${
                CHART_COLORS.MA5
              }">MA5: ${p.data.toFixed(2)}</div>`;
            } else if (p.seriesName === 'MA10' && typeof p.data === 'number') {
              html += `<div style="color:${
                CHART_COLORS.MA10
              }">MA10: ${p.data.toFixed(2)}</div>`;
            } else if (p.seriesName === 'MA20' && typeof p.data === 'number') {
              html += `<div style="color:${
                CHART_COLORS.MA20
              }">MA20: ${p.data.toFixed(2)}</div>`;
            } else if (p.seriesName === 'MA30' && typeof p.data === 'number') {
              html += `<div style="color:${
                CHART_COLORS.MA30
              }">MA30: ${p.data.toFixed(2)}</div>`;
            } else if (p.seriesName === '成交量') {
              const val =
                typeof p.data === 'object' && 'value' in p.data
                  ? (p.data as { value: number }).value
                  : p.data;
              if (typeof val === 'number') {
                html += `<div style="color:#888;margin-top:4px">成交量: ${val.toFixed(
                  2,
                )}</div>`;
              }
            }
          });

          return html;
        },
      },

      // 图例 - TradingView 风格紧凑左上角
      legend: {
        data: [
          { name: 'MA5', icon: 'roundRect' },
          { name: 'MA10', icon: 'roundRect' },
          { name: 'MA20', icon: 'roundRect' },
          { name: 'MA30', icon: 'roundRect' },
        ],
        top: 5,
        left: 10,
        orient: 'horizontal',
        itemWidth: 12,
        itemHeight: 3,
        itemGap: 15,
        textStyle: {
          color: '#ccc',
          fontSize: 11,
          fontWeight: 'bold',
          fontFamily: 'monospace',
        },
        inactiveColor: '#555',
        selectedMode: true,
      },

      // 网格布局：双 Grid（价格 + 成交量）- 贴边设计，Y轴右侧
      grid: [
        {
          // 价格区域 - 左侧贴边，右侧留空给 Y 轴标签
          left: 0,
          right: 60,
          top: 40,
          bottom: '32%',
          containLabel: false,
        },
        {
          // 成交量区域
          left: 0,
          right: 60,
          top: '72%',
          height: '18%',
          containLabel: false,
        },
      ],

      // X 轴（共享）
      xAxis: [
        {
          type: 'category',
          data: chartData.times,
          gridIndex: 0,
          axisLine: { lineStyle: { color: CHART_COLORS.AXIS_LINE } },
          axisLabel: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
        },
        {
          type: 'category',
          data: chartData.times,
          gridIndex: 1,
          axisLine: { lineStyle: { color: CHART_COLORS.AXIS_LINE } },
          axisLabel: {
            color: CHART_COLORS.AXIS_LABEL,
            fontSize: 10,
            interval: 'auto',
          },
          axisTick: { lineStyle: { color: CHART_COLORS.AXIS_LINE } },
          splitLine: { show: false },
        },
      ],

      // Y 轴 - 全部放置在右侧（TradingView/Binance 风格）
      yAxis: [
        {
          // 价格 Y 轴
          type: 'value',
          scale: true,
          min: priceRange.min,
          max: priceRange.max,
          gridIndex: 0,
          position: 'right',
          offset: 0,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: CHART_COLORS.AXIS_LABEL,
            fontSize: 10,
            inside: false,
            margin: 8,
            formatter: (value: number) => `$${value.toFixed(0)}`,
          },
          splitLine: {
            lineStyle: { color: CHART_COLORS.GRID_LINE },
          },
        },
        {
          // 成交量 Y 轴
          type: 'value',
          scale: true,
          gridIndex: 1,
          position: 'right',
          offset: 0,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: CHART_COLORS.AXIS_LABEL,
            fontSize: 10,
            inside: false,
            margin: 8,
            formatter: (value: number) => {
              if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
              return value.toFixed(0);
            },
          },
          splitLine: {
            lineStyle: { color: CHART_COLORS.GRID_LINE },
          },
        },
      ],

      // 数据缩放 - 默认显示最后 60 根 K 线
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
          start: Math.max(0, 100 - (60 / Math.max(allCandles.length, 1)) * 100),
          end: 100,
          minValueSpan: 10,
        },
        {
          type: 'slider',
          xAxisIndex: [0, 1],
          start: Math.max(0, 100 - (60 / Math.max(allCandles.length, 1)) * 100),
          end: 100,
          top: '94%',
          height: 16,
          borderColor: 'transparent',
          backgroundColor: 'rgba(255,255,255,0.05)',
          fillerColor: 'rgba(0, 212, 255, 0.15)',
          handleStyle: { color: '#00d4ff', borderColor: '#00d4ff' },
          textStyle: { color: '#888', fontSize: 10 },
          dataBackground: {
            lineStyle: { color: 'transparent' },
            areaStyle: { color: 'transparent' },
          },
        },
      ],

      // 系列数据
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: chartData.klineData,
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: {
            color: CHART_COLORS.UP, // 上涨填充色
            color0: CHART_COLORS.DOWN, // 下跌填充色
            borderColor: CHART_COLORS.UP, // 上涨边框
            borderColor0: CHART_COLORS.DOWN, // 下跌边框
          },
        },
        {
          name: 'MA5',
          type: 'line',
          data: chartData.ma5Data,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: {
            color: CHART_COLORS.MA5,
            width: 1.5,
          },
          z: 10,
        },
        {
          name: 'MA10',
          type: 'line',
          data: chartData.ma10Data,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: {
            color: CHART_COLORS.MA10,
            width: 1.5,
          },
          z: 10,
        },
        {
          name: 'MA20',
          type: 'line',
          data: chartData.ma20Data,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: {
            color: CHART_COLORS.MA20,
            width: 1.5,
          },
          z: 10,
        },
        {
          name: 'MA30',
          type: 'line',
          data: chartData.ma30Data,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          lineStyle: {
            color: CHART_COLORS.MA30,
            width: 1.5,
          },
          z: 10,
        },
        {
          name: '成交量',
          type: 'bar',
          data: chartData.volumeData,
          xAxisIndex: 1,
          yAxisIndex: 1,
          barMaxWidth: 20,
        },
      ],
    }),
    [chartData, priceRange, allCandles.length],
  );

  // 当数据更新时，使用 setOption 增量更新（避免重建图表）
  useEffect(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    if (chartInstance) {
      chartInstance.setOption(option, { notMerge: false, lazyUpdate: true });
    }
  }, [option]);

  // 空数据占位
  if (allCandles.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-neutral-500 font-mono text-sm">等待 K 线数据...</p>
        </div>
      </div>
    );
  }

  const echartsProps: EChartsReactProps = {
    option,
    style: { height: '100%', width: '100%' },
    notMerge: false,
    lazyUpdate: true,
  };

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden">
      <ReactECharts ref={chartRef} {...echartsProps} />
    </div>
  );
}

export default KLineChart;
