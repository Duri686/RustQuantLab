/**
 * @fileoverview 交易状态管理 Hook
 *
 * 与 Rust Wasm 交易引擎集成，管理仓位、风控和事件。
 *
 * ## 核心功能
 * - 状态同步: 每 Tick 调用 `onTick()` 更新价格并同步状态
 * - 事件消费: 自动处理 `EngineEvent` 并触发 Toast 通知
 * - 风险监控: 实时更新风险评估和预警
 *
 * @see core/src/engine.rs - Rust 交易引擎实现
 * @module hooks/useTradingState
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '../components/Toast';
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
} from '../types/trading';
import {
  isPositionOpenedEvent,
  isPositionClosedEvent,
  isLiquidatedEvent,
  isMarginWarningEvent,
  RISK_LEVEL_CONFIG,
} from '../types/trading';
import { wasmLock } from './wasmLock';
import { getSharedWasmEngine } from './useTradingEngine';

// ============================================================================
// Wasm 接口类型 (扩展现有 WasmMarketEngine)
// ============================================================================

/**
 * 扩展的 Wasm MarketEngine 接口 (包含交易方法)
 */
interface TradingWasmEngine {
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
}

// ============================================================================
// 事件处理类型
// ============================================================================

/**
 * Toast 接口 (匹配项目 useToast)
 */
interface ToastHandler {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

/**
 * 安全格式化数字
 */
function safeToFixed(value: number | undefined, digits: number): string {
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
function handleEngineEvents(events: EngineEvent[], toast: ToastHandler): void {
  for (const event of events) {
    // Debug: 打印原始事件结构
    // eslint-disable-next-line no-console
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

// ============================================================================
// Hook 实现
// ============================================================================

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

  // ========== Wasm 状态 ==========
  const [wasmReady, setWasmReady] = useState(false);
  const engineRef = useRef<TradingWasmEngine | null>(null);
  const engineAlive = useRef(false);

  // ========== 交易状态 ==========
  const [tradingState, setTradingState] = useState<TradingState | null>(null);
  const [lastEvents, setLastEvents] = useState<EngineEvent[]>([]);

  // ========== 并发控制 ==========
  const isProcessingRef = useRef(false);

  // ========== Toast 防抖控制 ==========
  const leverageToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // ========== 使用共享 Wasm 引擎 ==========
  // 不再独立初始化，复用 useTradingEngine 的引擎实例
  useEffect(() => {
    let aborted = false;
    let checkInterval: ReturnType<typeof setInterval>;

    const checkSharedEngine = () => {
      if (aborted) return;

      // 尝试获取共享引擎
      const sharedEngine = getSharedWasmEngine();
      if (sharedEngine) {
        // 共享引擎已就绪
        engineRef.current = sharedEngine as unknown as TradingWasmEngine;
        engineAlive.current = true;
        setWasmReady(true);

        // 清除轮询
        if (checkInterval) clearInterval(checkInterval);

        // 获取初始状态
        if (wasmLock.acquire()) {
          try {
            const state = engineRef.current.get_trading_state();
            setTradingState(state);
          } catch {
            // 初始状态获取失败不阻塞
          } finally {
            wasmLock.release();
          }
        }
      }
    };

    // 立即检查一次
    checkSharedEngine();

    // 如果没有就绪，轮询检查
    if (!engineRef.current) {
      checkInterval = setInterval(checkSharedEngine, 100);
    }

    return () => {
      aborted = true;
      engineAlive.current = false;
      if (checkInterval) clearInterval(checkInterval);
      if (leverageToastTimerRef.current)
        clearTimeout(leverageToastTimerRef.current);
      engineRef.current = null;
    };
  }, []);

  // ========== 便捷访问 ==========
  const position: Position | null = tradingState?.position ?? null;
  const riskAssessment: LiquidationResult | null =
    tradingState?.riskAssessment ?? null;
  const hasPosition = position !== null;

  // ========== onTick: 价格更新 + 状态同步 ==========
  // 使用 setTimeout 延迟执行，避免与 useTradingEngine 的 on_tick 冲突
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
        } catch (err) {
          // 静默处理
        } finally {
          isProcessingRef.current = false;
          wasmLock.release();
        }
      }, 50);
    },
    [toast],
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

        // 处理事件 (单独 try-catch 防止事件处理错误影响结果)
        if (state.pendingEvents && state.pendingEvents.length > 0) {
          try {
            handleEngineEvents(state.pendingEvents, toast);
          } catch (eventErr) {
            console.error('[TradingState] 事件处理错误:', eventErr);
            // 事件处理错误不影响开仓结果
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
        // 只有在 result 为空时才显示错误（真正的开仓失败）
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
    [toast],
  );

  // ========== closePosition: 平仓 (支持按 symbol 平仓) ==========
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
        // 调用 Wasm 平仓 (支持按 symbol 或 exitPrice 平仓)
        if (typeof symbolOrPrice === 'string') {
          // 按 symbol 平仓
          result = engineRef.current.close_position_by_symbol(
            symbolOrPrice,
            exitPrice,
          );
        } else {
          // 向后兼容: 传入 exitPrice
          result = engineRef.current.close_position(symbolOrPrice);
        }

        // 同步状态
        const state = engineRef.current.get_trading_state();
        setTradingState(state);

        // 处理事件 (单独 try-catch)
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
    [toast],
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
          // 防抖 Toast：滑动过程中只在停止后显示一次
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
    [toast],
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
    [toast],
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
    [toast],
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
