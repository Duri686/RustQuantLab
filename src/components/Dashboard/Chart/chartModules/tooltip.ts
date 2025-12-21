/**
 * Tooltip 和图例模块
 * 包含 Tooltip 格式化、axisPointer 配置、图例生成
 */

import { CHART_COLORS, INDICATOR_COLOR_MAP } from './constants';
import type { ChartData } from './constants';
import type { IndicatorData } from '../../../../types/index';
import type { GridConfig } from './layout';
import { formatVolumeValue } from './series';

/**
 * Tooltip 参数类型
 */
interface TooltipParam {
  axisValue: string;
  seriesName: string;
  data: number | number[] | { value: number };
  color: string;
}

/**
 * 生成 Tooltip 格式化函数
 */
export function createTooltipFormatter() {
  return (params: unknown) => {
    const paramArr = params as TooltipParam[];
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
      } else if (
        INDICATOR_COLOR_MAP[p.seriesName] &&
        typeof p.data === 'number'
      ) {
        // 通用指标显示
        html += `<div style="color:${INDICATOR_COLOR_MAP[p.seriesName]}">${
          p.seriesName
        }: ${p.data.toFixed(2)}</div>`;
      } else if (p.seriesName === 'MACD-Hist') {
        const val =
          typeof p.data === 'object' && 'value' in p.data
            ? (p.data as { value: number }).value
            : p.data;
        if (typeof val === 'number') {
          const color =
            val >= 0 ? CHART_COLORS.MACD_HIST_UP : CHART_COLORS.MACD_HIST_DOWN;
          html += `<div style="color:${color}">MACD-Hist: ${val.toFixed(
            4,
          )}</div>`;
        }
      }
    });

    return html;
  };
}

/**
 * 获取 Tooltip 配置对象
 * TradingView 风格：隐藏悬浮框内容，保留十字准线
 * 数据显示在左上角固定 DOM 中
 */
export function getTooltipConfig() {
  return {
    show: true, // 必须为 true 才能显示 axisPointer
    trigger: 'axis' as const,
    // 隐藏悬浮框内容，只保留十字准线
    formatter: () => '',
    backgroundColor: 'transparent',
    borderWidth: 0,
    axisPointer: {
      axis: 'y' as const,
      type: 'line' as const,
      // 水平线样式 (价格轴 Y 方向)
      lineStyle: {
        color: CHART_COLORS.CROSSHAIR,
        type: 'dashed' as const,
        width: 1,
      },
      // 轴标签配置
      label: {
        show: true,
        backgroundColor: CHART_COLORS.CROSSHAIR_LABEL_BG,
        color: CHART_COLORS.CROSSHAIR_LABEL_TEXT,
        fontSize: 11,
        fontFamily: 'monospace',
        padding: [4, 8],
        borderRadius: 2,
      },
    },
  };
}

/* ============================================
   动态图例生成
   ============================================ */

/**
 * 图例项类型 (包含颜色)
 */
export interface LegendItem {
  name: string;
  icon: string;
  itemStyle: { color: string };
}

/**
 * 根据激活的指标生成图例数据
 * 颜色严格对齐 CHART_COLORS 定义
 * @param activeMainIndicators - 激活的主图指标
 * @param activeSubIndicators - 激活的副图指标
 */
export function buildLegendData(
  activeMainIndicators: string[],
  activeSubIndicators: string[],
): LegendItem[] {
  const legendItems: LegendItem[] = [];

  if (activeMainIndicators.includes('MA')) {
    legendItems.push(
      {
        name: 'MA7',
        icon: 'roundRect',
        itemStyle: { color: CHART_COLORS.MA7 },
      },
      {
        name: 'MA25',
        icon: 'roundRect',
        itemStyle: { color: CHART_COLORS.MA25 },
      },
      {
        name: 'MA99',
        icon: 'roundRect',
        itemStyle: { color: CHART_COLORS.MA99 },
      },
    );
  }

  if (activeMainIndicators.includes('EMA')) {
    legendItems.push(
      {
        name: 'EMA7',
        icon: 'roundRect',
        itemStyle: { color: CHART_COLORS.EMA7 },
      },
      {
        name: 'EMA25',
        icon: 'roundRect',
        itemStyle: { color: CHART_COLORS.EMA25 },
      },
    );
  }

  if (activeMainIndicators.includes('BOLL')) {
    legendItems.push(
      {
        name: 'BOLL-Upper',
        icon: 'roundRect',
        itemStyle: { color: CHART_COLORS.BOLL_UPPER },
      },
      {
        name: 'BOLL-Mid',
        icon: 'roundRect',
        itemStyle: { color: CHART_COLORS.BOLL_MID },
      },
      {
        name: 'BOLL-Lower',
        icon: 'roundRect',
        itemStyle: { color: CHART_COLORS.BOLL_LOWER },
      },
    );
  }

  activeSubIndicators.forEach((sub) => {
    if (sub === 'MACD') {
      legendItems.push(
        {
          name: 'MACD-DIF',
          icon: 'roundRect',
          itemStyle: { color: CHART_COLORS.MACD_DIF },
        },
        {
          name: 'MACD-DEA',
          icon: 'roundRect',
          itemStyle: { color: CHART_COLORS.MACD_DEA },
        },
      );
    } else if (sub === 'RSI') {
      legendItems.push({
        name: 'RSI',
        icon: 'roundRect',
        itemStyle: { color: CHART_COLORS.RSI },
      });
    } else if (sub === 'VOL') {
      legendItems.push({
        name: '成交量',
        icon: 'roundRect',
        itemStyle: { color: CHART_COLORS.UP },
      });
    }
  });

  return legendItems;
}

/**
 * 获取图例配置对象
 * @param legendData - 图例数据
 * @param isMobile - 是否为移动端 (可选，默认 true)
 */
export function getLegendConfig(legendData: LegendItem[], isMobile = true) {
  return {
    data: legendData,
    // 使用百分比定位，确保与 grid 的 TOP_PADDING_PCT 配合
    top: isMobile ? '1%' : '1.5%',
    left: isMobile ? 5 : 10,
    orient: 'horizontal' as const,
    itemWidth: isMobile ? 10 : 12,
    itemHeight: isMobile ? 2 : 3,
    itemGap: isMobile ? 8 : 15,
    textStyle: {
      color: '#ccc',
      fontSize: isMobile ? 9 : 11,
      fontWeight: 'bold' as const,
      fontFamily: 'monospace',
    },
    inactiveColor: '#555',
    selectedMode: true,
    // 防止 legend 太长时换行遮挡图表
    width: '90%',
    type: 'scroll' as const, // 超长时支持滚动
  };
}

/* ============================================
   副图标题生成 (实时数据展示)
   ============================================ */

/**
 * 副图标题配置类型
 */
interface SubChartTitle {
  text: string;
  textStyle: {
    color: string;
    fontSize: number;
    fontFamily: string;
    fontWeight: 'bold' | 'normal';
  };
  left: number;
  top: string;
}

/**
 * 生成副图左上角的实时数据标题
 * 币安风格：在副图左上角显示指标名称和当前值
 * @param chartData - 图表数据
 * @param indicatorData - 指标数据
 * @param activeSubIndicators - 激活的副图指标
 * @param grids - Grid 配置数组
 * @param isMobile - 是否为移动端
 */
export function buildSubChartTitles(
  chartData: ChartData,
  indicatorData: IndicatorData,
  activeSubIndicators: string[],
  grids: GridConfig[],
  isMobile: boolean,
): SubChartTitle[] {
  const titles: SubChartTitle[] = [];

  activeSubIndicators.forEach((sub, idx) => {
    const gridIndex = idx + 1; // 副图从 index 1 开始
    const grid = grids[gridIndex];
    if (!grid) return;

    // 获取 grid 的 top 位置
    const gridTop = typeof grid.top === 'string' ? grid.top : `${grid.top}%`;

    let titleText = '';
    let titleColor = '#888';

    switch (sub) {
      case 'VOL': {
        const lastVolume =
          chartData.volumeData[chartData.volumeData.length - 1];
        const lastVolumeValue =
          typeof lastVolume === 'object' && 'value' in lastVolume
            ? lastVolume.value
            : 0;
        const isUp =
          lastVolume &&
          typeof lastVolume === 'object' &&
          lastVolume.itemStyle?.color === CHART_COLORS.UP;
        titleText = `成交量(Volume) ${formatVolumeValue(lastVolumeValue)}`;
        titleColor = isUp ? CHART_COLORS.UP : CHART_COLORS.DOWN;
        break;
      }
      case 'MACD': {
        const lastDif = indicatorData.macdDif[indicatorData.macdDif.length - 1];
        const lastDea = indicatorData.macdDea[indicatorData.macdDea.length - 1];
        const lastHist =
          indicatorData.macdHist[indicatorData.macdHist.length - 1];
        const difStr = lastDif != null ? lastDif.toFixed(2) : '-';
        const deaStr = lastDea != null ? lastDea.toFixed(2) : '-';
        const histStr = lastHist != null ? lastHist.toFixed(4) : '-';
        titleText = `MACD(12,26,9) DIF:${difStr} DEA:${deaStr} MACD:${histStr}`;
        titleColor = '#888';
        break;
      }
      case 'RSI': {
        const lastRsi = indicatorData.rsi14[indicatorData.rsi14.length - 1];
        const rsiStr = lastRsi != null ? lastRsi.toFixed(2) : '-';
        titleText = `RSI(14) ${rsiStr}`;
        titleColor = CHART_COLORS.RSI;
        break;
      }
    }

    if (titleText) {
      titles.push({
        text: titleText,
        textStyle: {
          color: titleColor,
          fontSize: isMobile ? 10 : 11,
          fontFamily: 'monospace',
          fontWeight: 'bold',
        },
        left: isMobile ? 5 : 10,
        top: gridTop,
      });
    }
  });

  return titles;
}
