/**
 * @fileoverview 交易操作 Hook
 *
 * 从 useWasmEngine 拆分出的交易操作方法，
 * 负责开仓、平仓、设置杠杆、重置账户、取消挂单等操作。
 *
 * @module hooks/tradingEngine/useTradingActions
 */

import { useCallback } from 'react';
import { useDebounceFn } from 'ahooks';
import { handleEngineEvents, safeToFixed } from '../tradingState/eventHandler';
import type {
  TradingState,
  OpenPositionRequest,
  OpenPositionResult,
  ClosePositionResult,
  CancelOrderResult,
  MarginMode,
  OrderType,
} from '../../types/trading';
import type { TradingWasmEngine, AddMarginResult, EstimateLiquidationResult } from '../tradingState/types';
import type { MarketEngineInstance } from '../../types/index';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Toast 处理器接口
 */
interface ToastHandler {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

/**
 * useTradingActions 参数
 */
export interface UseTradingActionsParams {
  /** 引擎引用 */
  engineRef: React.RefObject<MarketEngineInstance | null>;
  /** 引擎是否存活 */
  engineAlive: React.RefObject<boolean>;
  /** 是否正在处理中 */
  isProcessingRef: React.MutableRefObject<boolean>;
  /** Toast 处理器 */
  toast: ToastHandler;
  /** 状态更新回调 */
  onStateUpdate: (state: TradingState) => void;
  /** 事件更新回调 */
  onEventsUpdate: (events: TradingState['pendingEvents']) => void;
}

/**
 * useTradingActions 返回类型
 */
export interface UseTradingActionsReturn {
  /** 开仓 */
  placeOrder: (
    side: 'LONG' | 'SHORT',
    size: number,
    leverage?: number,
    marginMode?: MarginMode,
    orderType?: OrderType,
    price?: number,
    currentPrice?: number,
  ) => OpenPositionResult | null;
  /** 平仓 */
  closePosition: (
    symbolOrPrice?: string | number,
    exitPrice?: number,
  ) => ClosePositionResult | null;
  /** 设置杠杆 */
  setLeverage: (leverage: number) => boolean;
  /** 重置账户 */
  resetAccount: (initialBalance?: number) => void;
  /** 取消挂单 */
  cancelOrder: (orderId: string) => CancelOrderResult | null;
  /** 增加保证金 (逐仓模式) */
  addMargin: (positionId: string, amount: number) => AddMarginResult | null;
  /** 预估强平价格 (Wasm 引擎计算) */
  estimateLiquidation: (
    side: 'LONG' | 'SHORT',
    size: number,
    leverage: number,
    marginMode: string,
  ) => EstimateLiquidationResult | null;
}

// 导出类型（从 tradingState/types 重导出）
export type { AddMarginResult, EstimateLiquidationResult } from '../tradingState/types';

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 交易操作 Hook
 *
 * @param params - 参数对象
 * @returns 交易操作方法
 */
export function useTradingActions(
  params: UseTradingActionsParams,
): UseTradingActionsReturn {
  const {
    engineRef,
    engineAlive,
    isProcessingRef,
    toast,
    onStateUpdate,
    onEventsUpdate,
  } = params;

  // ========== Toast 防抖控制 ==========
  const { run: debouncedLeverageToast } = useDebounceFn(
    (leverage: number) => toast.success(`杠杆已设置为 ${leverage}x`),
    { wait: 300 },
  );

  // ========== 辅助函数：同步状态 ==========
  const syncState = useCallback(
    (engine: TradingWasmEngine) => {
      const state = engine.get_trading_state();
      onStateUpdate(state);

      if (state.pendingEvents && state.pendingEvents.length > 0) {
        handleEngineEvents(state.pendingEvents, toast);
        onEventsUpdate(state.pendingEvents);
      }

      return state;
    },
    [toast, onStateUpdate, onEventsUpdate],
  );

  // ========== 开仓 ==========
  const placeOrder = useCallback(
    (
      side: 'LONG' | 'SHORT',
      size: number,
      leverage?: number,
      marginMode?: MarginMode,
      orderType?: OrderType,
      price?: number,
      currentPrice?: number,
    ): OpenPositionResult | null => {
      if (!engineAlive.current || !engineRef.current) {
        console.warn('[useTradingActions] 引擎未就绪');
        return null;
      }

      if (isProcessingRef.current) {
        console.warn('[useTradingActions] 引擎正忙');
        return null;
      }

      isProcessingRef.current = true;
      let result: OpenPositionResult | null = null;

      try {
        const engine = engineRef.current as unknown as TradingWasmEngine;

        // 设置杠杆 (如果指定)
        if (leverage !== undefined) {
          engine.set_leverage(leverage);
        }

        // 构建开仓请求
        const request: OpenPositionRequest = {
          side: side.toLowerCase(),
          size,
          marginMode: marginMode ?? 'cross',
          orderType: orderType ?? 'market',
          price: orderType === 'limit' ? price : undefined,
          currentPrice: orderType === 'limit' ? currentPrice : undefined,
        };

        // 调用 Rust 开仓
        result = engine.open_position(request);

        // 同步状态
        syncState(engine);

        // 失败时显示错误
        if (!result.success) {
          toast.error(`开仓失败: ${result.message}`);
        }

        return result;
      } catch (err) {
        console.error('[useTradingActions] 开仓失败:', err);
        if (!result) {
          toast.error(
            `开仓失败: ${err instanceof Error ? err.message : '未知错误'}`,
          );
        }
        return result;
      } finally {
        isProcessingRef.current = false;
      }
    },
    [engineRef, engineAlive, isProcessingRef, toast, syncState],
  );

  // ========== 平仓 ==========
  const closePosition = useCallback(
    (
      symbolOrPrice?: string | number,
      exitPrice?: number,
    ): ClosePositionResult | null => {
      if (!engineAlive.current || !engineRef.current) {
        console.warn('[useTradingActions] 引擎未就绪');
        return null;
      }

      if (isProcessingRef.current) {
        console.warn('[useTradingActions] 引擎正忙');
        return null;
      }

      isProcessingRef.current = true;
      let result: ClosePositionResult | null = null;

      try {
        const engine = engineRef.current as unknown as TradingWasmEngine;

        // 调用 Rust 平仓
        if (typeof symbolOrPrice === 'string') {
          result = engine.close_position_by_symbol(symbolOrPrice, exitPrice);
        } else {
          result = engine.close_position(symbolOrPrice);
        }

        // 同步状态
        syncState(engine);

        // 失败时显示错误
        if (!result.success) {
          toast.error(`平仓失败: ${result.message}`);
        }

        return result;
      } catch (err) {
        console.error('[useTradingActions] 平仓失败:', err);
        if (!result) {
          toast.error(
            `平仓失败: ${err instanceof Error ? err.message : '未知错误'}`,
          );
        }
        return result;
      } finally {
        isProcessingRef.current = false;
      }
    },
    [engineRef, engineAlive, isProcessingRef, toast, syncState],
  );

  // ========== 设置杠杆 ==========
  const setLeverage = useCallback(
    (leverage: number): boolean => {
      if (!engineAlive.current || !engineRef.current) {
        console.warn('[useTradingActions] 引擎未就绪');
        return false;
      }

      try {
        const engine = engineRef.current as unknown as TradingWasmEngine;
        const success = engine.set_leverage(leverage);

        if (success) {
          const state = engine.get_trading_state();
          onStateUpdate(state);

          // 防抖 Toast
          debouncedLeverageToast(leverage);
        } else {
          toast.error('无法修改杠杆: 持仓期间不能修改杠杆');
        }
        return success;
      } catch (err) {
        console.error('[useTradingActions] 设置杠杆失败:', err);
        return false;
      }
    },
    [engineRef, engineAlive, toast, onStateUpdate, debouncedLeverageToast],
  );

  // ========== 重置账户 ==========
  const resetAccount = useCallback(
    (initialBalance?: number): void => {
      if (!engineAlive.current || !engineRef.current) {
        console.warn('[useTradingActions] 引擎未就绪');
        return;
      }

      try {
        const engine = engineRef.current as unknown as TradingWasmEngine;
        engine.reset_balance(initialBalance);

        const state = engine.get_trading_state();
        onStateUpdate(state);

        toast.success(
          `账户已重置，余额: ${safeToFixed(state.balance, 2)} USDT`,
        );
      } catch (err) {
        console.error('[useTradingActions] 重置账户失败:', err);
      }
    },
    [engineRef, engineAlive, toast, onStateUpdate],
  );

  // ========== 取消挂单 ==========
  const cancelOrder = useCallback(
    (orderId: string): CancelOrderResult | null => {
      if (!engineAlive.current || !engineRef.current) {
        console.warn('[useTradingActions] 引擎未就绪');
        return null;
      }

      try {
        const engine = engineRef.current as unknown as TradingWasmEngine;
        const result = engine.cancel_order(orderId);

        // 同步状态
        syncState(engine);

        return result;
      } catch (err) {
        console.error('[useTradingActions] 取消挂单失败:', err);
        toast.error(
          `取消挂单失败: ${err instanceof Error ? err.message : '未知错误'}`,
        );
        return null;
      }
    },
    [engineRef, engineAlive, toast, syncState],
  );

  // ========== 增加保证金 (逐仓模式) ==========
  const addMargin = useCallback(
    (positionId: string, amount: number): AddMarginResult | null => {
      if (!engineAlive.current || !engineRef.current) {
        console.warn('[useTradingActions] 引擎未就绪');
        return null;
      }

      if (amount <= 0) {
        toast.error('增加金额必须大于0');
        return null;
      }

      try {
        const engine = engineRef.current as unknown as TradingWasmEngine;
        const result = engine.add_margin(positionId, amount);

        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message || result.error || '增加保证金失败');
        }

        // 同步状态
        syncState(engine);

        return result;
      } catch (err) {
        console.error('[useTradingActions] 增加保证金失败:', err);
        toast.error(
          `增加保证金失败: ${err instanceof Error ? err.message : '未知错误'}`,
        );
        return null;
      }
    },
    [engineRef, engineAlive, toast, syncState],
  );

  // ========== 预估强平价格 ==========
  const estimateLiquidation = useCallback(
    (
      side: 'LONG' | 'SHORT',
      size: number,
      leverage: number,
      marginMode: string,
    ): EstimateLiquidationResult | null => {
      if (!engineAlive.current || !engineRef.current) return null;

      try {
        const engine = engineRef.current as unknown as TradingWasmEngine;
        return engine.estimate_liquidation_price(
          side.toLowerCase(),
          size,
          leverage,
          marginMode,
        );
      } catch (err) {
        console.warn('[useTradingActions] 预估强平价格失败:', err);
        return null;
      }
    },
    [engineRef, engineAlive],
  );

  return {
    placeOrder,
    closePosition,
    setLeverage,
    resetAccount,
    cancelOrder,
    addMargin,
    estimateLiquidation,
  };
}
