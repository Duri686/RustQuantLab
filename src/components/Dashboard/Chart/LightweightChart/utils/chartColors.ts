/**
 * 图表颜色配置
 * 仿币安永续合约 K 线图表风格
 */

export const CHART_COLORS = {
  // K 线颜色
  UP: '#0ECB81',           // 涨 - 绿色
  DOWN: '#F6465D',         // 跌 - 红色
  
  // 背景和网格
  BACKGROUND: '#161a1e',   // 背景色
  GRID: 'rgba(255, 255, 255, 0.04)', // 网格线
  CROSSHAIR: 'rgba(136, 136, 136, 0.8)', // 十字光标
  
  // MA 均线
  MA7: '#F7931A',          // MA7 - 橙色
  MA25: '#9B59B6',         // MA25 - 紫色
  MA99: '#00D4FF',         // MA99 - 青色
  
  // EMA 均线
  EMA7: '#E91E63',         // EMA7 - 粉色
  EMA25: '#00BCD4',        // EMA25 - 青色
  
  // BOLL 布林带
  BOLL_UPPER: '#F7931A',   // 上轨 - 橙色
  BOLL_MID: '#9B59B6',     // 中轨 - 紫色
  BOLL_LOWER: '#00D4FF',   // 下轨 - 青色
  
  // MACD
  MACD_DIF: '#F7931A',     // DIF 线 - 橙色
  MACD_DEA: '#9B59B6',     // DEA 线 - 紫色
  MACD_HIST_UP: '#0ECB81', // 柱状图正值 - 绿色
  MACD_HIST_DOWN: '#F6465D', // 柱状图负值 - 红色
  
  // RSI
  RSI: '#F7931A',          // RSI 线 - 橙色
  RSI_OVERBOUGHT: 'rgba(246, 70, 93, 0.3)', // 超买区域
  RSI_OVERSOLD: 'rgba(14, 203, 129, 0.3)',  // 超卖区域
  RSI_OVERBOUGHT_LINE: 'rgba(246, 70, 93, 0.5)', // 超买线
  RSI_OVERSOLD_LINE: 'rgba(14, 203, 129, 0.5)',  // 超卖线
  
  // 成交量
  VOLUME_UP: 'rgba(14, 203, 129, 0.5)',   // 涨时成交量
  VOLUME_DOWN: 'rgba(246, 70, 93, 0.5)',  // 跌时成交量
  
  // 文字颜色
  TEXT_PRIMARY: '#d1d4dc',   // 主要文字
  TEXT_SECONDARY: '#888888', // 次要文字
  TEXT_MUTED: '#666666',     // 暗淡文字
  
  // 边框
  BORDER: '#333333',
  
  // 窗格分隔线
  PANE_SEPARATOR: '#2b2f36',
} as const;

/** 默认显示的 K 线数量 */
export const DEFAULT_VISIBLE_CANDLES = 100;

/** 移动端断点 (px) */
export const MOBILE_BREAKPOINT = 768;

/** 窗格高度配置 */
export const PANE_HEIGHTS = {
  mobile: {
    main: 0.55,     // 主图占 55%
    sub: 0.15,      // 每个副图占 15%
    minSubHeight: 80,
  },
  desktop: {
    main: 0.6,      // 主图占 60%
    sub: 0.2,       // 每个副图占 20%
    minSubHeight: 100,
  },
} as const;

