/**
 * 交易事件处理模块
 * 处理引擎事件并触发 Toast 通知
 */

import type { EngineEvent } from '../../types/trading';
import {
  isPositionOpenedEvent,
  isPositionClosedEvent,
  isLiquidatedEvent,
  isMarginWarningEvent,
  RISK_LEVEL_CONFIG,
} from '../../types/trading';
import type { ToastHandler } from './types';

/**
 * 安全格式化数字
 */
export function safeToFixed(value: number | undefined, digits: number): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0.00';
  }
  return value.toFixed(digits);
}

/**
 * 处理引擎事件并触发 Toast 通知
 *
 * 🔴 注意: Rust serde 可能序列化为 snake_case 或 camelCase
 * 需要兼容两种格式
 */
export function handleEngineEvents(
  events: EngineEvent[],
  toast: ToastHandler,
): void {
  for (const event of events) {
    // Debug: 打印原始事件结构
    console.log('[TradingState] Event received:', event);

    // 兼容 snake_case 和 camelCase (Rust serde)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = event as any;

    if (isPositionOpenedEvent(event) || e.type === 'positionOpened') {
      const side = e.side ?? 'UNKNOWN';
      const size = e.size ?? e.position_size ?? 0;
      const entryPrice = e.entryPrice ?? e.entry_price ?? 0;
      toast.success(
        `开仓成功: ${side} ${safeToFixed(size, 4)} BTC @ ${safeToFixed(
          entryPrice,
          2,
        )}`,
      );
    } else if (isPositionClosedEvent(event) || e.type === 'positionClosed') {
      const realizedPnl = e.realizedPnl ?? e.realized_pnl ?? 0;
      const pnlSign = realizedPnl >= 0 ? '+' : '';
      toast.success(
        `平仓成功: 盈亏 ${pnlSign}${safeToFixed(realizedPnl, 2)} USDT`,
      );
    } else if (isLiquidatedEvent(event) || e.type === 'liquidated') {
      const side = e.side ?? 'UNKNOWN';
      const size = e.size ?? 0;
      const lostMargin = e.lostMargin ?? e.lost_margin ?? 0;
      toast.error(
        `⚠️ 强制平仓: ${side} ${safeToFixed(size, 4)} BTC，损失 ${safeToFixed(
          lostMargin,
          2,
        )} USDT`,
        8000,
      );
    } else if (isMarginWarningEvent(event) || e.type === 'marginWarning') {
      const riskLevel = e.riskLevel ?? e.risk_level ?? 'Unknown';
      const marginRatio = e.marginRatio ?? e.margin_ratio ?? 0;
      const config =
        RISK_LEVEL_CONFIG[riskLevel as keyof typeof RISK_LEVEL_CONFIG];
      toast.warning(
        `风险预警 [${config?.label || riskLevel}]: 保证金率 ${safeToFixed(
          marginRatio,
          2,
        )}x`,
        5000,
      );
    } else if (e.type === 'limitOrderCreated') {
      const side = e.side ?? 'UNKNOWN';
      const size = e.size ?? 0;
      const limitPrice = e.limitPrice ?? e.limit_price ?? 0;
      toast.info(
        `限价单已创建: ${side} ${safeToFixed(size, 4)} @ ${safeToFixed(
          limitPrice,
          2,
        )}`,
      );
    } else if (e.type === 'limitOrderFilled') {
      const side = e.side ?? 'UNKNOWN';
      const size = e.size ?? 0;
      const fillPrice = e.fillPrice ?? e.fill_price ?? 0;
      toast.success(
        `限价单已成交: ${side} ${safeToFixed(size, 4)} @ ${safeToFixed(
          fillPrice,
          2,
        )}`,
      );
    } else if (e.type === 'limitOrderCancelled') {
      const releasedMargin = e.releasedMargin ?? e.released_margin ?? 0;
      toast.info(`挂单已取消，解冻 ${safeToFixed(releasedMargin, 2)} USDT`);
    } else {
      // 未知事件类型，记录日志
      console.warn('[TradingState] Unknown event type:', e.type, event);
    }
  }
}
