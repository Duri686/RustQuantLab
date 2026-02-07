/**
 * 交易配置常量
 *
 * 集中管理手续费率、杠杆阈值等可配置参数
 * 所有交易相关组件从此处读取配置，避免硬编码
 */

// ============================================================================
// 手续费配置
// ============================================================================

export const FEE_CONFIG = {
  /** Taker 手续费率 (市价单) */
  takerRate: 0.0004,
  /** Maker 手续费率 (限价单) */
  makerRate: 0.0002,
} as const;

// ============================================================================
// 杠杆配置
// ============================================================================

export const LEVERAGE_CONFIG = {
  /** 最小杠杆 */
  min: 1,
  /** 最大杠杆 */
  max: 125,
  /** 默认杠杆 */
  default: 10,
  /** 快捷选择档位 */
  steps: [1, 10, 20, 50, 100, 125] as const,

  // 风险阈值
  /** 确认弹窗触发阈值: 杠杆 > 此值时弹出确认弹窗 */
  warningThreshold: 50,
  /** 内联警告阈值: 杠杆 > 此值时显示极高风险警告文本 */
  dangerThreshold: 75,
} as const;

// ============================================================================
// 风险等级颜色映射 (基于杠杆值)
// ============================================================================

/**
 * 根据杠杆值返回风险等级信息
 */
export function getLeverageRiskLevel(leverage: number) {
  if (leverage <= 20) {
    return { level: 'low', label: 'Low Risk', colorClass: 'text-warning' } as const;
  }
  if (leverage <= 50) {
    return { level: 'medium', label: 'Medium Risk', colorClass: 'text-warning-alt' } as const;
  }
  if (leverage <= LEVERAGE_CONFIG.dangerThreshold) {
    return { level: 'high', label: 'High Risk', colorClass: 'text-danger' } as const;
  }
  return { level: 'extreme', label: 'Extreme Risk', colorClass: 'text-danger' } as const;
}

// ============================================================================
// 下单配置
// ============================================================================

export const ORDER_CONFIG = {
  /** 下单数量百分比预设 */
  sizePresets: [25, 50, 75, 100] as const,
  /** 订单类型选项 */
  orderTypes: ['Limit', 'Market'] as const,
  /** 维持保证金率 (MMR) */
  maintenanceMarginRate: 0.005,
} as const;

// ============================================================================
// 保证金模式配置
// ============================================================================

export const MARGIN_MODE_CONFIG = [
  { value: 'cross' as const, label: '全仓', desc: '共享保证金' },
  { value: 'isolated' as const, label: '逐仓', desc: '独立保证金' },
] as const;

// ============================================================================
// 计算辅助函数
// ============================================================================

/**
 * 预估手续费
 *
 * @param size - 下单数量 (BTC)
 * @param price - 价格 (USDT)
 * @param orderType - 订单类型
 * @returns 手续费 (USDT)
 */
export function estimateFee(
  size: number,
  price: number,
  orderType: 'market' | 'limit',
): number {
  const rate = orderType === 'market' ? FEE_CONFIG.takerRate : FEE_CONFIG.makerRate;
  return size * price * rate;
}

/**
 * 预估保证金
 *
 * @param size - 下单数量 (BTC)
 * @param price - 价格 (USDT)
 * @param leverage - 杠杆倍数
 * @returns 所需保证金 (USDT)
 */
export function estimateMargin(
  size: number,
  price: number,
  leverage: number,
): number {
  if (leverage <= 0) return 0;
  return (size * price) / leverage;
}

/**
 * 前端预估强平价格 (简化版)
 *
 * 用于 Wasm 接口不可用时的 fallback
 * 精确值应使用 Wasm engine.estimate_liquidation_price()
 *
 * @param entryPrice - 开仓价格
 * @param leverage - 杠杆倍数
 * @param side - 方向
 * @returns 预估强平价格
 */
export function estimateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  side: 'LONG' | 'SHORT',
): number {
  const mmr = ORDER_CONFIG.maintenanceMarginRate;
  if (side === 'LONG') {
    return entryPrice * (1 - 1 / leverage + mmr);
  }
  return entryPrice * (1 + 1 / leverage - mmr);
}
