/**
 * Tooltip 和图例模块
 * 包含 Tooltip 格式化、axisPointer 配置、图例生成
 */

import { CHART_COLORS, INDICATOR_COLOR_MAP } from './constants';

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
 */
export function getTooltipConfig() {
  return {
    trigger: 'axis' as const,
    axisPointer: {
      type: 'cross' as const,
      crossStyle: { color: CHART_COLORS.CROSSHAIR },
      lineStyle: { color: CHART_COLORS.CROSSHAIR, type: 'dashed' as const },
    },
    backgroundColor: 'rgba(20, 20, 20, 0.95)',
    borderColor: '#333',
    borderWidth: 1,
    textStyle: { color: '#fff', fontSize: 12 },
    formatter: createTooltipFormatter(),
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
