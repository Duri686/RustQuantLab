/**
 * 市场模拟类型定义
 */

/** Wyckoff 市场周期阶段 */
export type MarketPhase =
  | 'ACCUMULATION' // 吸筹阶段：底部横盘，成交量放大但价格不涨
  | 'MARKUP' // 拉升阶段：爬楼梯上涨
  | 'DISTRIBUTION' // 派发阶段：顶部横盘，成交量放大但价格不跌
  | 'MARKDOWN'; // 下跌阶段：电梯下跌

/** 市场操纵事件类型 */
export type ManipulationEvent =
  | 'NONE' // 无事件
  | 'SCAM_WICK' // 插针扫损 → 微观趋势展开
  | 'BART_PATTERN' // 画门
  | 'CASCADE_LONG' // 多头连环爆仓
  | 'CASCADE_SHORT' // 空头连环爆仓
  | 'STOP_HUNT_LOW' // 向下停损狩猎 → 微观趋势展开
  | 'STOP_HUNT_HIGH' // 向上停损狩猎 → 微观趋势展开
  | 'FAKEOUT_BULL' // 假突破向上
  | 'FAKEOUT_BEAR'; // 假突破向下

/** 成交量-波动率关系模式 */
export type VolumeMode =
  | 'NORMAL' // 正常：成交量与波动率正相关
  | 'PAINT_TAPE_UP' // 无量空涨（诱多）
  | 'PAINT_TAPE_DOWN' // 无量空跌（诱空）
  | 'VOLUME_CLIMAX_TOP' // 放量滞涨（顶部信号）
  | 'VOLUME_CLIMAX_BOTTOM'; // 放量止跌（底部信号）

/** Bart 形态阶段 */
export type BartStage = 'PUMP' | 'CONSOLIDATE' | 'DUMP' | 'NONE';

/**
 * 微观趋势阶段 (将大波动分解为多根K线)
 * - PANIC: 恐慌加速阶段，连续阴/阳线，实体逐渐增大
 * - CLIMAX: 高潮换手阶段，极高成交量，实体变小或十字星
 * - REVERSAL: 反转回升阶段，逐渐收复失地
 */
export type MicroTrendPhase = 'PANIC' | 'CLIMAX' | 'REVERSAL' | 'NONE';

/** 微观趋势状态 */
export interface MicroTrendState {
  phase: MicroTrendPhase;
  direction: 1 | -1; // 1=向上插针, -1=向下插针
  targetAmplitude: number; // 目标总振幅 (百分比)
  accumulatedMove: number; // 已累积的移动量
  phaseProgress: number; // 当前阶段进度 (0-1)
  phaseDuration: number; // 当前阶段总K线数
  phaseIndex: number; // 当前阶段内K线索引
  startPrice: number; // 起始价格
  extremePrice: number; // 极值价格 (最高或最低点)
}

/** 技术指标数据 */
export interface TechnicalIndicators {
  ma20: number;
  ma50: number;
  bollUpper: number;
  bollMid: number;
  bollLower: number;
  recentHigh: number;
  recentLow: number;
  rangeHigh: number; // 箱体上沿
  rangeLow: number; // 箱体下沿
}

/** 流动性状态 (影响影线生成) */
export type LiquidityState =
  | 'NORMAL' // 正常流动性
  | 'VACUUM_LOW' // 流动性真空 (成交量极低)
  | 'VACUUM_HIGH'; // 流动性冲击 (成交量极高，爆仓)

/** 市场状态 */
export interface MarketState {
  // 核心状态
  phase: MarketPhase;
  phaseProgress: number; // 当前阶段进度 0-1
  phaseDuration: number; // 阶段持续 K 线数
  phaseCounter: number;

  // 操纵事件
  currentEvent: ManipulationEvent;
  eventProgress: number;
  eventDuration: number;

  // Bart 形态状态
  bartStage: BartStage;
  bartStartPrice: number;
  bartTargetPrice: number;
  bartStageProgress: number;
  bartStageDuration: number;

  // 微观趋势状态 (将大波动分解为多根K线的V型展开)
  microTrend: MicroTrendState;

  // 价格状态
  currentPrice: number;
  basePrice: number; // 均值回归基准
  momentum: number; // 动量 -1 到 1
  volatilityMultiplier: number;
  lastPriceDirection: 1 | -1 | 0; // 上一根K线的方向 (用于惯性计算)

  // 成交量状态
  volumeMode: VolumeMode;
  avgVolume: number;
  liquidityState: LiquidityState; // 流动性状态

  // 技术指标
  indicators: TechnicalIndicators;

  // 历史数据缓存（用于指标计算）
  priceHistory: number[];

  // 交易对
  symbol: string;
}

/** K 线生成结果 */
export interface CandleResult {
  close: number;
  high: number;
  low: number;
  volume: number;
}

/** postMessage 回调类型 */
export type PostMessageFn = (msg: unknown) => void;

