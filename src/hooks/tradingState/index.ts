/**
 * @fileoverview 交易状态管理 Hook
 *
 * 与 Rust Wasm 交易引擎集成，管理仓位、风控和事件。
 *
 * ## 核心功能
 * - 状态同步: 每 Tick 调用 `onTick()` 更新价格并同步状态
 * - 事件消费: 自动处理 `EngineEvent` 并触发 Toast 通知
 * - 风险监控: 实时更新风险评估和预警
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '../../components/Toast';
import { wasmLock } from '../wasmLock';
import { useSharedEngine } from './useSharedEngine';
import { handleEngineEvents } from './eventHandler';
import type {
  TradingState,
  Position,
  LiquidationResult,
  EngineEvent,
  OpenPositionRequest,
  OpenPositionResult,
  ClosePositionResult,
  CancelOrderResult,
  UseTradingStateReturn,
  MarginMode,
  OrderType,
  PendingOrder,
} from '../../types/trading';

// 重新导出子模块
export { handleEngineEvents, safeToFixed } from './eventHandler';
export { useSharedEngine } from './useSharedEngine';
export type { TradingWasmEngine, ToastHandler } from './types';
export type { UseSharedEngineReturn } from './useSharedEngine';

/**
 * useTradingState Hook
 *
 * 管理与 Rust Wasm 交易引擎的交互。
 *
 * @example
 * ```tsx
 * const {
 *   tradingState,
 *   position,
 *   hasPosition,
 *   onTick,
 *   placeOrder,
 *   closePosition,
 * } = useTradingState();
 *
 * // 每 Tick 更新
 * useEffect(() => {
 *   if (latestPrice) onTick(latestPrice);
 * }, [latestPrice, onTick]);
 *
 * // 开仓
 * const handleBuy = () => placeOrder('LONG', 0.1, 10);
 * ```
 */
export function useTradingState(): UseTradingStateReturn {
  // ========== Toast ==========
  const toast = useToast();

  // ========== 共享引擎 ==========
  const { wasmReady, engineRef, engineAlive, isProcessingRef, initialState } =
    useSharedEngine();

  // ========== 交易状态 ==========
  const [tradingState, setTradingState] = useState<TradingState | null>(null);
  const [lastEvents, setLastEvents] = useState<EngineEvent[]>([]);

  // ========== Toast 防抖控制 ==========
  const leverageToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // 初始化交易状态
  useEffect(() => {
    if (initialState) {
      setTradingState(initialState);
    }
  }, [initialState]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (leverageToastTimerRef.current) {
        clearTimeout(leverageToastTimerRef.current);
      }
    };
  }, []);

  // ========== 便捷访问 ==========
  const position: Position | null = tradingState?.position ?? null;
  const riskAssessment: LiquidationResult | null =
    tradingState?.riskAssessment ?? null;
  const hasPosition = position !== null;

  // ========== onTick: 价格更新 + 状态同步 ==========
  const onTick = useCallback(
    (_currentPrice: number) => {
      if (!engineAlive.current || !engineRef.current) return;
      if (isProcessingRef.current) return;

      // 延迟 50ms 执行，确保 useTradingEngine 的 on_tick 已完成
      setTimeout(() => {
        if (!engineAlive.current || !engineRef.current) return;
        if (isProcessingRef.current) return;
        if (!wasmLock.acquire()) return;

        isProcessingRef.current = true;

        try {
          const state = engineRef.current.get_trading_state();
          setTradingState(state);

          // 处理事件
          if (state.pendingEvents && state.pendingEvents.length > 0) {
            try {
              handleEngineEvents(state.pendingEvents, toast);
            } catch (eventErr) {
              console.error('[TradingState] 事件处理错误:', eventErr);
            }
            setLastEvents(state.pendingEvents);
          }
        } catch {
          // 静默处理
        } finally {
          isProcessingRef.current = false;
          wasmLock.release();
        }
      }, 50);
    },
    [toast, engineRef, engineAlive, isProcessingRef],
  );

  // ========== placeOrder: 开仓 ==========
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
        console.warn('[TradingState] 引擎未就绪');
        return null;
      }

      if (isProcessingRef.current) {
        console.warn('[TradingState] 引擎正忙');
        return null;
      }

      isProcessingRef.current = true;

      let result: OpenPositionResult | null = null;

      try {
        // 设置杠杆 (如果指定)
        if (leverage !== undefined) {
          engineRef.current.set_leverage(leverage);
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

        // 调用 Wasm 开仓
        result = engineRef.current.open_position(request);

        // 同步状态
        const state = engineRef.current.get_trading_state();
        setTradingState(state);

        // 处理事件
        if (state.pendingEvents && state.pendingEvents.length > 0) {
          try {
            handleEngineEvents(state.pendingEvents, toast);
          } catch (eventErr) {
            console.error('[TradingState] 事件处理错误:', eventErr);
          }
          setLastEvents(state.pendingEvents);
        }

        // Wasm 返回失败时显示错误
        if (!result.success) {
          toast.error(`开仓失败: ${result.message}`);
        }

        return result;
      } catch (err) {
        console.error('[TradingState] 开仓失败:', err);
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
    [toast, engineRef, engineAlive, isProcessingRef],
  );

  // ========== closePosition: 平仓 ==========
  const closePosition = useCallback(
    (
      symbolOrPrice?: string | number,
      exitPrice?: number,
    ): ClosePositionResult | null => {
      if (!engineAlive.current || !engineRef.current) {
        console.warn('[TradingState] 引擎未就绪');
        return null;
      }

      if (isProcessingRef.current) {
        console.warn('[TradingState] 引擎正忙');
        return null;
      }

      isProcessingRef.current = true;

      let result: ClosePositionResult | null = null;

      try {
        // 调用 Wasm 平仓
        if (typeof symbolOrPrice === 'string') {
          result = engineRef.current.close_position_by_symbol(
            symbolOrPrice,
            exitPrice,
          );
        } else {
          result = engineRef.current.close_position(symbolOrPrice);
        }

        // 同步状态
        const state = engineRef.current.get_trading_state();
        setTradingState(state);

        // 处理事件
        if (state.pendingEvents && state.pendingEvents.length > 0) {
          try {
            handleEngineEvents(state.pendingEvents, toast);
          } catch (eventErr) {
            console.error('[TradingState] 事件处理错误:', eventErr);
          }
          setLastEvents(state.pendingEvents);
        }

        // Wasm 返回失败时显示错误
        if (!result.success) {
          toast.error(`平仓失败: ${result.message}`);
        }

        return result;
      } catch (err) {
        console.error('[TradingState] 平仓失败:', err);
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
    [toast, engineRef, engineAlive, isProcessingRef],
  );

  // ========== setLeverage: 设置杠杆 ==========
  const setLeverage = useCallback(
    (leverage: number): boolean => {
      if (!engineAlive.current || !engineRef.current) {
        console.warn('[TradingState] 引擎未就绪');
        return false;
      }

      try {
        const success = engineRef.current.set_leverage(leverage);
        if (success) {
          // 同步状态
          const state = engineRef.current.get_trading_state();
          setTradingState(state);
          // 防抖 Toast
          if (leverageToastTimerRef.current) {
            clearTimeout(leverageToastTimerRef.current);
          }
          leverageToastTimerRef.current = setTimeout(() => {
            toast.success(`杠杆已设置为 ${leverage}x`);
            leverageToastTimerRef.current = null;
          }, 300);
        } else {
          toast.error('无法修改杠杆: 持仓期间不能修改杠杆');
        }
        return success;
      } catch (err) {
        console.error('[TradingState] 设置杠杆失败:', err);
        return false;
      }
    },
    [toast, engineRef, engineAlive],
  );

  // ========== resetAccount: 重置账户 ==========
  const resetAccount = useCallback(
    (initialBalance?: number): void => {
      if (!engineAlive.current || !engineRef.current) {
        console.warn('[TradingState] 引擎未就绪');
        return;
      }

      try {
        engineRef.current.reset_balance(initialBalance);

        // 同步状态
        const state = engineRef.current.get_trading_state();
        setTradingState(state);

        toast.success(`账户已重置，余额: ${state.balance.toFixed(2)} USDT`);
      } catch (err) {
        console.error('[TradingState] 重置账户失败:', err);
      }
    },
    [toast, engineRef, engineAlive],
  );

  // ========== cancelOrder: 取消挂单 ==========
  const cancelOrder = useCallback(
    (orderId: string): CancelOrderResult | null => {
      if (!engineAlive.current || !engineRef.current) {
        console.warn('[TradingState] 引擎未就绪');
        return null;
      }

      try {
        const result = engineRef.current.cancel_order(orderId);

        // 同步状态
        const state = engineRef.current.get_trading_state();
        setTradingState(state);

        // 处理事件
        if (state.pendingEvents && state.pendingEvents.length > 0) {
          try {
            handleEngineEvents(state.pendingEvents, toast);
          } catch (eventErr) {
            console.error('[TradingState] 事件处理错误:', eventErr);
          }
          setLastEvents(state.pendingEvents);
        }

        return result;
      } catch (err) {
        console.error('[TradingState] 取消挂单失败:', err);
        toast.error(
          `取消挂单失败: ${err instanceof Error ? err.message : '未知错误'}`,
        );
        return null;
      }
    },
    [toast, engineRef, engineAlive],
  );

  // ========== 挂单列表便捷访问 ==========
  const pendingOrders: PendingOrder[] = tradingState?.pendingOrders ?? [];

  return {
    // 状态
    wasmReady,
    tradingState,
    position,
    riskAssessment,
    hasPosition,
    lastEvents,
    pendingOrders,

    // 操作方法
    onTick,
    placeOrder,
    closePosition,
    setLeverage,
    resetAccount,
    cancelOrder,
  };
}

export default useTradingState;
