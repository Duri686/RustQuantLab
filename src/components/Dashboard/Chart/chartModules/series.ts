/**
 * 图表系列生成器模块
 * 包含 K线、MA、EMA、BOLL、MACD、RSI、VOL 等系列的生成函数
 */

import type { SeriesOption } from 'echarts';
import type { IndicatorData } from '../../../../types/index';
import { CHART_COLORS } from './constants';
import type { ChartData } from './constants';

/* ============================================
   主图指标系列生成器
   ============================================ */

/**
 * 生成 K 线蜡烛图系列
 * @param klineData - K 线数据
 */
export function createCandlestickSeries(klineData: number[][]): SeriesOption {
  return {
    name: 'K线',
    type: 'candlestick',
    data: klineData,
    xAxisIndex: 0,
    yAxisIndex: 0,
    itemStyle: {
      color: CHART_COLORS.UP,
      color0: CHART_COLORS.DOWN,
      borderColor: CHART_COLORS.UP,
      borderColor0: CHART_COLORS.DOWN,
    },
  };
}

/**
 * 生成 MA 均线系列
 * @param indicatorData - 指标数据
 */
export function createMASeries(indicatorData: IndicatorData): SeriesOption[] {
  return [
    {
      name: 'MA7',
      type: 'line',
      data: indicatorData.ma7,
      xAxisIndex: 0,
      yAxisIndex: 0,
      smooth: true,
      showSymbol: false,
      lineStyle: { color: CHART_COLORS.MA7, width: 1.5 },
      z: 10,
    },
    {
      name: 'MA25',
      type: 'line',
      data: indicatorData.ma25,
      xAxisIndex: 0,
      yAxisIndex: 0,
      smooth: true,
      showSymbol: false,
      lineStyle: { color: CHART_COLORS.MA25, width: 1.5 },
      z: 10,
    },
    {
      name: 'MA99',
      type: 'line',
      data: indicatorData.ma99,
      xAxisIndex: 0,
      yAxisIndex: 0,
      smooth: true,
      showSymbol: false,
      lineStyle: { color: CHART_COLORS.MA99, width: 1.5 },
      z: 10,
    },
  ];
}

/**
 * 生成 EMA 均线系列
 * @param indicatorData - 指标数据
 */
export function createEMASeries(indicatorData: IndicatorData): SeriesOption[] {
  return [
    {
      name: 'EMA7',
      type: 'line',
      data: indicatorData.ema7,
      xAxisIndex: 0,
      yAxisIndex: 0,
      smooth: true,
      showSymbol: false,
      lineStyle: { color: CHART_COLORS.EMA7, width: 1.5 },
      z: 10,
    },
    {
      name: 'EMA25',
      type: 'line',
      data: indicatorData.ema25,
      xAxisIndex: 0,
      yAxisIndex: 0,
      smooth: true,
      showSymbol: false,
      lineStyle: { color: CHART_COLORS.EMA25, width: 1.5 },
      z: 10,
    },
  ];
}

/**
 * 生成 BOLL 布林带系列 (包含填充区域)
 * @param indicatorData - 指标数据
 */
export function createBOLLSeries(indicatorData: IndicatorData): SeriesOption[] {
  return [
    {
      name: 'BOLL-Upper',
      type: 'line',
      data: indicatorData.bollUpper,
      xAxisIndex: 0,
      yAxisIndex: 0,
      smooth: true,
      showSymbol: false,
      lineStyle: { color: CHART_COLORS.BOLL_UPPER, width: 1 },
      z: 8,
    },
    {
      name: 'BOLL-Mid',
      type: 'line',
      data: indicatorData.bollMid,
      xAxisIndex: 0,
      yAxisIndex: 0,
      smooth: true,
      showSymbol: false,
      lineStyle: { color: CHART_COLORS.BOLL_MID, width: 1.5 },
      z: 9,
    },
    {
      name: 'BOLL-Lower',
      type: 'line',
      data: indicatorData.bollLower,
      xAxisIndex: 0,
      yAxisIndex: 0,
      smooth: true,
      showSymbol: false,
      lineStyle: { color: CHART_COLORS.BOLL_LOWER, width: 1 },
      areaStyle: {
        color: CHART_COLORS.BOLL_BAND,
        origin: 'auto',
      },
      z: 7,
    },
  ];
}

/* ============================================
   副图指标系列生成器
   ============================================ */

/**
 * 生成 MACD 系列 (柱状图 + 双线)
 * @param indicatorData - 指标数据
 * @param subGridIndex - 副图 Grid 索引 (通常为 1)
 */
export function createMACDSeries(
  indicatorData: IndicatorData,
  subGridIndex: number,
): SeriesOption[] {
  // MACD 柱状图需要根据正负值设置颜色
  const histData = indicatorData.macdHist.map((val) => ({
    value: val,
    itemStyle: {
      color:
        val !== null && val >= 0
          ? CHART_COLORS.MACD_HIST_UP
          : CHART_COLORS.MACD_HIST_DOWN,
    },
  }));

  return [
    {
      name: 'MACD-Hist',
      type: 'bar',
      data: histData,
      xAxisIndex: subGridIndex,
      yAxisIndex: subGridIndex,
      barMaxWidth: 6,
      z: 5,
    },
    {
      name: 'MACD-DIF',
      type: 'line',
      data: indicatorData.macdDif,
      xAxisIndex: subGridIndex,
      yAxisIndex: subGridIndex,
      smooth: true,
      showSymbol: false,
      lineStyle: { color: CHART_COLORS.MACD_DIF, width: 1.5 },
      z: 10,
    },
    {
      name: 'MACD-DEA',
      type: 'line',
      data: indicatorData.macdDea,
      xAxisIndex: subGridIndex,
      yAxisIndex: subGridIndex,
      smooth: true,
      showSymbol: false,
      lineStyle: { color: CHART_COLORS.MACD_DEA, width: 1.5 },
      z: 10,
    },
  ];
}

/**
 * 生成 RSI 系列
 * @param indicatorData - 指标数据
 * @param subGridIndex - 副图 Grid 索引
 */
export function createRSISeries(
  indicatorData: IndicatorData,
  subGridIndex: number,
): SeriesOption[] {
  return [
    {
      name: 'RSI',
      type: 'line',
      data: indicatorData.rsi14,
      xAxisIndex: subGridIndex,
      yAxisIndex: subGridIndex,
      smooth: true,
      showSymbol: false,
      lineStyle: { color: CHART_COLORS.RSI, width: 1.5 },
      // RSI 超买超卖区域标记线 (专业样式)
      markLine: {
        silent: true,
        symbol: 'none',
        animation: false,
        data: [
          {
            yAxis: 70,
            lineStyle: {
              color: CHART_COLORS.RSI_OVERBOUGHT,
              type: 'dashed',
              width: 1,
              opacity: 0.6,
            },
            label: {
              show: true,
              position: 'insideEndTop',
              formatter: '70',
              fontSize: 9,
              color: 'rgba(246, 70, 93, 0.8)',
              padding: [0, 4, 0, 0],
            },
          },
          {
            yAxis: 30,
            lineStyle: {
              color: CHART_COLORS.RSI_OVERSOLD,
              type: 'dashed',
              width: 1,
              opacity: 0.6,
            },
            label: {
              show: true,
              position: 'insideEndBottom',
              formatter: '30',
              fontSize: 9,
              color: 'rgba(14, 203, 129, 0.8)',
              padding: [0, 4, 0, 0],
            },
          },
        ],
      },
      // RSI 中性区域高亮 (30-70)
      markArea: {
        silent: true,
        itemStyle: {
          color: CHART_COLORS.RSI_NEUTRAL_ZONE,
        },
        data: [[{ yAxis: 30 }, { yAxis: 70 }]],
      },
      z: 10,
    },
  ];
}

/**
 * 生成成交量系列
 * @param chartData - 基础图表数据
 * @param subGridIndex - 副图 Grid 索引
 */
export function createVolumeSeries(
  chartData: ChartData,
  subGridIndex: number,
): SeriesOption[] {
  return [
    {
      name: '成交量',
      type: 'bar',
      data: chartData.volumeData,
      xAxisIndex: subGridIndex,
      yAxisIndex: subGridIndex,
      barMaxWidth: 20,
    },
  ];
}
