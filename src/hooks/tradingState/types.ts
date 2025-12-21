/**
 * 交易状态模块类型定义
 */

import type {
  TradingState,
  OpenPositionRequest,
  OpenPositionResult,
  ClosePositionResult,
  CancelOrderResult,
} from '../../types/trading';

/**
 * 扩展的 Wasm MarketEngine 接口 (包含交易方法)
 */
export interface TradingWasmEngine {
  // 交易状态方法
  get_trading_state(): TradingState;
  open_position(request: OpenPositionRequest): OpenPositionResult;
  close_position(exitPrice?: number): ClosePositionResult;
  close_position_by_symbol(
    symbol?: string,
    exitPrice?: number,
    closeSize?: number,
  ): ClosePositionResult;
  set_leverage(leverage: number): boolean;
  get_leverage(): number;
  get_balance(): number;
  reset_balance(initialBalance?: number): void;
  has_position(): boolean;
  pending_event_count(): number;
  // 挂单管理方法
  pending_order_count(): number;
  cancel_order(orderId: string): CancelOrderResult;
  cancel_all_orders(): CancelOrderResult;
  // 逐仓保证金管理
  add_margin(positionId: string, amount: number): AddMarginResult;
}

/** 增加保证金结果 */
export interface AddMarginResult {
  success: boolean;
  message: string;
  newMargin?: number;
  error?: string;
}

/**
 * Toast 接口 (匹配项目 useToast)
 */
export interface ToastHandler {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}
