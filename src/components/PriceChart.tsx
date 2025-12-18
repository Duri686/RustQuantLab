import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

/**
 * 价格图表数据点类型
 */
interface PriceDataPoint {
  /** 时间戳字符串 */
  time: string;
  /** 市场价格 */
  price: number;
  /** SMA(5) 值，初始计算中可能为 null */
  sma: number | null;
}

/**
 * PriceChart 组件 Props
 */
interface PriceChartProps {
  /** 价格历史数据数组 */
  data: PriceDataPoint[];
}

/**
 * 实时价格与 SMA 折线图组件
 * 使用 Apache ECharts 渲染高频更新的金融数据
 */
function PriceChart({ data }: PriceChartProps) {
  // 提取图表所需数据
  const times = data.map((d) => d.time);
  const prices = data.map((d) => d.price);
  const smaValues = data.map((d) => d.sma);

  // ECharts 配置
  const option: EChartsOption = {
    animation: false, // 禁用动画以提升高频更新性能
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(30, 30, 30, 0.9)',
      borderColor: '#444',
      textStyle: {
        color: '#fff',
      },
    },
    legend: {
      data: ['Price', 'SMA (5)'],
      textStyle: {
        color: '#ccc',
      },
      top: 10,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: 50,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: times,
      axisLine: {
        lineStyle: {
          color: '#555',
        },
      },
      axisLabel: {
        color: '#aaa',
        fontSize: 10,
      },
    },
    yAxis: {
      type: 'value',
      scale: true, // 启用缩放，避免线条过于平坦
      axisLine: {
        lineStyle: {
          color: '#555',
        },
      },
      axisLabel: {
        color: '#aaa',
        formatter: (value: number) => `$${value.toFixed(2)}`,
      },
      splitLine: {
        lineStyle: {
          color: '#333',
        },
      },
    },
    series: [
      {
        name: 'Price',
        type: 'line',
        data: prices,
        showSymbol: false,
        lineStyle: {
          color: '#00ba00',
          width: 2,
        },
        itemStyle: {
          color: '#00ba00',
        },
      },
      {
        name: 'SMA (5)',
        type: 'line',
        data: smaValues,
        showSymbol: false,
        lineStyle: {
          color: '#ff6000',
          width: 2,
          type: 'dashed',
        },
        itemStyle: {
          color: '#ff6000',
        },
      },
    ],
  };

  return (
    <div className="w-full h-full">
      <ReactECharts
        option={option}
        style={{ height: '100%', width: '100%' }}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
}

export default PriceChart;
