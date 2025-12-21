/**
 * 图表系列生成器模块
 * 包含 K线、MA、EMA、BOLL、MACD、RSI、VOL 等系列的生成函数
 */

import type { SeriesOption } from 'echarts';
import type { IndicatorData } from '../../../../types/index';
import { CHART_COLORS } from './constants';
import type { ChartData } from './constants';

const BASE_BAR_WIDTH = '70%';
const BASE_BAR_GAP = '0%';
const BASE_BAR_CATEGORY_GAP = '10%';

/**
 * 格式化成交量显示 (K/M/B 等缩写)
 * @param val - 成交量数值
 */
export function formatVolumeValue(val: number): string {
  if (val >= 1e9) return (val / 1e9).toFixed(2) + 'B';
  if (val >= 1e6) return (val / 1e6).toFixed(2) + 'M';
  if (val >= 1e3) return (val / 1e3).toFixed(2) + 'K';
  return val.toFixed(2);
}

/* ============================================
   主图指标系列生成器
   ============================================ */

/**
 * 现价线配置参数
 */
export interface PriceLineConfig {
  /** 当前价格 */
  currentPrice: number;
  /** 开盘价 (用于判断涨跌颜色) */
  openPrice: number;
}

/**
 * 生成 K 线蜡烛图系列
 * @param klineData - K 线数据
 * @param priceLineConfig - 现价线配置 (可选)
 */
export function createCandlestickSeries(
  klineData: number[][],
  priceLineConfig?: PriceLineConfig,
): SeriesOption {
  // 判断涨跌状态
  const isUp = priceLineConfig
    ? priceLineConfig.currentPrice >= priceLineConfig.openPrice
    : true;

  // 现价线颜色
  const priceLineColor = isUp
    ? CHART_COLORS.PRICE_LINE_UP
    : CHART_COLORS.PRICE_LINE_DOWN;
  const priceLabelBg = isUp
    ? CHART_COLORS.PRICE_LABEL_BG_UP
    : CHART_COLORS.PRICE_LABEL_BG_DOWN;

  return {
    name: 'K线',
    type: 'candlestick',
    data: klineData,
    xAxisIndex: 0,
    yAxisIndex: 0,
    // 柱体宽度与副图柱状图保持一致 (百分比自适应)
    barWidth: BASE_BAR_WIDTH,
    itemStyle: {
      color: CHART_COLORS.UP,
      color0: CHART_COLORS.DOWN,
      borderColor: CHART_COLORS.UP,
      borderColor0: CHART_COLORS.DOWN,
    },
    // 币安风格：现价水平虚线
    markLine: priceLineConfig
      ? {
          silent: true,
          symbol: 'none',
          animation: false,
          data: [
            {
              yAxis: priceLineConfig.currentPrice,
              lineStyle: {
                color: priceLineColor,
                type: 'dashed',
                width: 1,
                opacity: 0.9,
              },
              label: {
                show: true,
                position: 'end',
                distance: 4,
                formatter: `{c}`,
                fontSize: 11,
                fontFamily: 'monospace',
                fontWeight: 'bold',
                color: '#fff',
                backgroundColor: priceLabelBg,
                padding: [3, 6],
                borderRadius: 2,
              },
            },
          ],
        }
      : undefined,
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
      z: 7,
    },
  ];
}

/* ============================================
   副图指标系列生成器
   ============================================ */

/**
 * 计算 MACD 柱状图颜色（趋势强弱区分）
 * - 正数且递增：深绿（上涨动能增强）
 * - 正数且递减：浅绿（上涨动能减弱）
 * - 负数且递减：深红（下跌动能增强）
 * - 负数且递增：浅红（下跌动能减弱）
 * @param current - 当前值
 * @param previous - 前一个值
 */
function getMacdHistColor(
  current: number | null,
  previous: number | null,
): string {
  if (current === null) return CHART_COLORS.MACD_HIST_UP;

  const isPositive = current >= 0;
  const prev = previous ?? 0;

  if (isPositive) {
    // 零轴上方：增强（递增）或减弱（递减）
    return current >= prev
      ? CHART_COLORS.MACD_HIST_UP_STRONG
      : CHART_COLORS.MACD_HIST_UP_WEAK;
  } else {
    // 零轴下方：增强（递减）或减弱（递增）
    return current <= prev
      ? CHART_COLORS.MACD_HIST_DOWN_STRONG
      : CHART_COLORS.MACD_HIST_DOWN_WEAK;
  }
}

/**
 * 生成 MACD 系列 (柱状图 + 双线)
 * @param indicatorData - 指标数据
 * @param subGridIndex - 副图 Grid 索引 (通常为 1)
 */
export function createMACDSeries(
  indicatorData: IndicatorData,
  subGridIndex: number,
): SeriesOption[] {
  // MACD 柱状图：根据趋势强弱设置深浅颜色
  const histData = indicatorData.macdHist.map((val, idx) => {
    const prevVal = idx > 0 ? indicatorData.macdHist[idx - 1] : null;
    return {
      value: val,
      itemStyle: {
        color: getMacdHistColor(val, prevVal),
      },
    };
  });

  return [
    {
      name: 'MACD-Hist',
      type: 'bar',
      data: histData,
      xAxisIndex: subGridIndex,
      yAxisIndex: subGridIndex,
      barWidth: BASE_BAR_WIDTH,
      barGap: BASE_BAR_GAP,
      barCategoryGap: BASE_BAR_CATEGORY_GAP,
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
      // RSI 30-70 边界虚线 (TradingView 紫色风格)
      markLine: {
        silent: true,
        symbol: 'none',
        animation: false,
        data: [
          {
            yAxis: 70,
            lineStyle: {
              color: CHART_COLORS.RSI_BOUNDARY,
              type: 'dashed',
              width: 1,
            },
            label: { show: false },
          },
          {
            yAxis: 30,
            lineStyle: {
              color: CHART_COLORS.RSI_BOUNDARY,
              type: 'dashed',
              width: 1,
            },
            label: { show: false },
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
 * 币安风格：紧凑柱状图，1px 间距，含实时成交量标签
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
      barWidth: BASE_BAR_WIDTH,
      barCategoryGap: BASE_BAR_CATEGORY_GAP,
      barGap: BASE_BAR_GAP,
    },
  ];
}
