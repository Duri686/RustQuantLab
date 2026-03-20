/**
 * 市场模拟常量配置
 */

// ============================================================================
// 交易对配置
// ============================================================================

export interface SymbolConfig {
  basePrice: number;
  volatility: number;
  precision: number;
}

export const SYMBOL_CONFIG: Record<string, SymbolConfig> = {
  'BTC-USDT': { basePrice: 95000, volatility: 1.0, precision: 2 },
  'ETH-USDT': { basePrice: 2600, volatility: 1.2, precision: 2 },
  // 兼容前端传参格式 (不带横杠)
  'BTC': { basePrice: 95000, volatility: 1.0, precision: 2 },
  'ETH': { basePrice: 2600, volatility: 1.2, precision: 2 },
  'BTCUSDT': { basePrice: 95000, volatility: 1.0, precision: 2 },
  'ETHUSDT': { basePrice: 2600, volatility: 1.2, precision: 2 },
} as const;

/**
 * 获取交易对配置
 */
export function getSymbolConfig(symbol: string): SymbolConfig {
  return SYMBOL_CONFIG[symbol] || SYMBOL_CONFIG['BTC-USDT'];
}

/**
 * 获取随机基准价格
 */
export function getRandomBasePrice(symbol: string = 'BTC-USDT'): number {
  const config = getSymbolConfig(symbol);
  // 随机波动 ±20% 作为初始价格
  const variation = 1 + (Math.random() * 0.4 - 0.2);
  return config.basePrice * variation;
}

export const LEVELS = 50; // 订单簿深度
export const PRICE_PRECISION = 100; // 价格精度 (0.01)

// ============================================================================
// 波动率时间分形约束 (Volatility Scaling Constraint)
// 公式: Range_1m ≈ Range_1H / √60
// ============================================================================

/** 1分钟K线最大振幅限制 (High-Low)/Open */
export const MAX_RANGE_1M = 0.003; // 0.3%
/** 1分钟K线常规振幅限制 */
export const NORMAL_RANGE_1M = 0.001; // 0.1%

/** 不同时间周期的振幅缩放因子 (基于平方根法则) */
export const VOLATILITY_SCALE = {
  60: 1.0, // 1分钟基准
  300: Math.sqrt(5), // 5分钟 ≈ 2.24x
  900: Math.sqrt(15), // 15分钟 ≈ 3.87x
  3600: Math.sqrt(60), // 1小时 ≈ 7.75x
  14400: Math.sqrt(240), // 4小时 ≈ 15.5x
  86400: Math.sqrt(1440), // 1天 ≈ 37.9x
} as const;

// ============================================================================
// 价格惯性与动量约束 (Price Inertia & Momentum)
// ============================================================================

/** 价格动量衰减系数 (越低动量越持久) */
export const MOMENTUM_DECAY = 0.85;
/** 价格惯性强度 (方向延续概率增量) */
export const INERTIA_STRENGTH = 0.15;
/** Tick级别最大跳动幅度 */
export const MAX_TICK_JUMP = 0.002; // 0.2%

// ============================================================================
// 影线类型分布 (Noise vs Manipulation Wicks)
// ============================================================================

/** 常规噪音影线概率 (影线很短) */
export const NOISE_WICK_PROB = 0.95;
/** 流动性真空触发条件 - 成交量极低阈值 */
export const LOW_VOLUME_THRESHOLD = 0.3;
/** 流动性真空触发条件 - 成交量极高阈值 */
export const HIGH_VOLUME_THRESHOLD = 2.5;

// ============================================================================
// 微观趋势持续时间 (Micro-Trend Duration)
// ============================================================================

/** 插针展开最小K线数 */
export const WICK_EVENT_MIN_DURATION = 5;
/** 插针展开最大K线数 */
export const WICK_EVENT_MAX_DURATION = 15;
/** V型反转各阶段比例 [下跌, 换手, 回升] */
export const V_REVERSAL_PHASES = [0.35, 0.15, 0.5] as const;
