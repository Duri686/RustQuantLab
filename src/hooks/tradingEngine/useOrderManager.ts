/**
 * 订单管理 Hook
 * 处理订单提交、平仓、追加保证金和爆仓检测
 */

import { useState, useEffect, useCallback } from 'react';
import { wasmSingleton } from './wasmSingleton';
import type {
  MarketEngineInstance,
  SimOrderResult,
  OrderRecord,
  MarginMode,
  WasmCandleHistory,
} from '../../types/index';

/** 订单提交参数 */
export interface SubmitOrderParams {
  side: 'buy' | 'sell';
  price: number;
  size: number;
  leverage: number;
  marginMode: MarginMode;
}

/** 订单管理 Hook 参数 */
export interface UseOrderManagerParams {
  /** 引擎实例引用 */
  engineRef: React.RefObject<MarketEngineInstance | null>;
  /** 引擎是否可用 */
  engineAlive: React.RefObject<boolean>;
  /** 是否正在处理中 */
  isProcessingRef: React.RefObject<boolean>;
  /** 最新价格 */
  currentPrice: number | null;
  /** 设置 Rust K 线历史 */
  setRustCandleHistory: (candles: WasmCandleHistory | null) => void;
}

/** 订单管理 Hook 返回值 */
export interface UseOrderManagerReturn {
  /** 可用余额 */
  availableBalance: number;
  /** 订单列表 */
  orders: OrderRecord[];
  /** 提交订单 */
  submitOrder: (order: SubmitOrderParams) => SimOrderResult | null;
  /** 平仓 */
  closeOrder: (orderId: string, currentPrice: number) => boolean;
  /** 追加保证金 */
  addMargin: (orderId: string, amount: number) => boolean;
}

/**
 * 订单管理 Hook
 * 处理订单的完整生命周期
 */
export function useOrderManager({
  engineRef,
  engineAlive,
  isProcessingRef,
  currentPrice,
  setRustCandleHistory,
}: UseOrderManagerParams): UseOrderManagerReturn {
  // 账户余额状态（模拟交易）
  const [availableBalance, setAvailableBalance] = useState<number>(100000);
  // 订单记录
  const [orders, setOrders] = useState<OrderRecord[]>([]);

  /**
   * 爆仓检测
   * 当市场价格触及爆仓价时，自动强制平仓
   */
  useEffect(() => {
    if (currentPrice === null) return;

    setOrders((prevOrders) => {
      let hasLiquidation = false;
      const updatedOrders = prevOrders.map((order) => {
        // 跳过已平仓或已爆仓的订单
        if (order.closed || order.liquidated) return order;

        // 检测是否触及爆仓价
        const isLiquidated =
          order.side === 'buy'
            ? currentPrice <= order.liquidationPrice
            : currentPrice >= order.liquidationPrice;

        if (isLiquidated) {
          hasLiquidation = true;
          // 爆仓：保证金全部损失
          const realizedPnl = -order.margin;

          console.warn(
            `🔥 [爆仓] ${order.side.toUpperCase()} ${
              order.size
            } BTC @ ${order.executedPrice.toFixed(2)}, ` +
              `爆仓价 ${order.liquidationPrice.toFixed(
                2,
              )}, 当前价 ${currentPrice.toFixed(2)}, ` +
              `损失 ${order.margin.toFixed(2)} USDT`,
          );

          return {
            ...order,
            closed: true,
            liquidated: true,
            closePrice: order.liquidationPrice,
            closeTimestamp: Date.now(),
            realizedPnl,
          };
        }

        return order;
      });

      // 爆仓不返还保证金（已经在开仓时扣除）
      if (hasLiquidation) {
        return updatedOrders;
      }

      return prevOrders;
    });
  }, [currentPrice]);

  /**
   * 提交模拟订单
   * 调用 Rust 引擎的 submit_order 方法
   */
  const submitOrder = useCallback(
    (order: SubmitOrderParams): SimOrderResult | null => {
      if (!engineAlive.current || !engineRef.current || !wasmSingleton.engine) {
        console.warn('[useOrderManager] 引擎未就绪，无法提交订单');
        return null;
      }

      // 防止在处理其他操作时并发调用
      if (isProcessingRef.current) {
        console.warn('[useOrderManager] 引擎正忙，请稍后重试');
        return null;
      }

      // 计算所需保证金 = 订单价值 / 杠杆
      const orderValue = order.price * order.size;
      const requiredMargin = orderValue / order.leverage;

      // 检查余额是否足够
      if (requiredMargin > availableBalance) {
        console.warn(
          `[useOrderManager] 余额不足: 需要 ${requiredMargin.toFixed(
            2,
          )} USDT, 可用 ${availableBalance.toFixed(2)} USDT`,
        );
        return null;
      }

      try {
        // 转换订单方向为 Rust 枚举格式
        const wasmOrder = {
          side: order.side === 'buy' ? ('Buy' as const) : ('Sell' as const),
          price: order.price,
          size: order.size,
          leverage: order.leverage,
        };

        // 调用 Rust 引擎提交订单
        const result = engineRef.current.submit_order(wasmOrder);

        // 扣减保证金
        setAvailableBalance((prev) => prev - requiredMargin);

        // 计算爆仓价格
        // 维持保证金率 0.5%，当亏损达到 (1 - 维持保证金率) × 保证金 时爆仓
        const maintenanceMarginRate = 0.005;
        const liquidationPrice =
          order.side === 'buy'
            ? result.executedPrice *
              (1 - (1 - maintenanceMarginRate) / order.leverage)
            : result.executedPrice *
              (1 + (1 - maintenanceMarginRate) / order.leverage);

        // 记录订单
        const orderRecord: OrderRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          side: order.side,
          price: order.price,
          size: order.size,
          leverage: order.leverage,
          executedPrice: result.executedPrice,
          margin: requiredMargin,
          marginMode: order.marginMode,
          priceImpact: result.priceImpact,
          timestamp: Date.now(),
          liquidationPrice,
        };
        setOrders((prev) => [orderRecord, ...prev].slice(0, 50));

        console.log(
          `[useOrderManager] 订单已执行: ${
            result.side
          } @ ${result.executedPrice.toFixed(2)}, ` +
            `影响: ${
              result.priceImpact >= 0 ? '+' : ''
            }${result.priceImpact.toFixed(2)}, ` +
            `保证金: ${requiredMargin.toFixed(2)} USDT`,
        );

        // 立即更新 K 线数据以反映订单影响
        try {
          const candles = engineRef.current.get_active_candles();
          setRustCandleHistory(candles);
        } catch {
          // K 线获取失败不影响主流程
        }

        return result;
      } catch (err) {
        console.error('[useOrderManager] 订单提交失败:', err);
        return null;
      }
    },
    [
      engineRef,
      engineAlive,
      isProcessingRef,
      availableBalance,
      setRustCandleHistory,
    ],
  );

  /**
   * 平仓操作
   * 关闭指定订单，计算并结算盈亏
   */
  const closeOrder = useCallback(
    (orderId: string, closePrice: number): boolean => {
      const orderIndex = orders.findIndex((o) => o.id === orderId && !o.closed);
      if (orderIndex === -1) {
        console.warn('[useOrderManager] 订单不存在或已平仓:', orderId);
        return false;
      }

      const order = orders[orderIndex];

      // 计算实现盈亏
      const pnlPercent =
        order.side === 'buy'
          ? ((closePrice - order.executedPrice) / order.executedPrice) *
            100 *
            order.leverage
          : ((order.executedPrice - closePrice) / order.executedPrice) *
            100 *
            order.leverage;
      const realizedPnl = (order.margin * pnlPercent) / 100;

      // 更新订单状态
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                closed: true,
                closePrice,
                closeTimestamp: Date.now(),
                realizedPnl,
              }
            : o,
        ),
      );

      // 返还保证金 + 盈亏
      const returnAmount = order.margin + realizedPnl;
      setAvailableBalance((prev) => prev + returnAmount);

      console.log(
        `[useOrderManager] 平仓成功: ${order.side.toUpperCase()} ${
          order.size
        } BTC, ` +
          `盈亏: ${realizedPnl >= 0 ? '+' : ''}${realizedPnl.toFixed(
            2,
          )} USDT, ` +
          `返还: ${returnAmount.toFixed(2)} USDT`,
      );

      return true;
    },
    [orders],
  );

  /**
   * 追加保证金（仅逐仓模式）
   * 增加仓位的保证金，降低爆仓风险
   */
  const addMargin = useCallback(
    (orderId: string, amount: number): boolean => {
      if (amount <= 0) {
        console.warn('[useOrderManager] 追加保证金金额必须大于0');
        return false;
      }

      if (amount > availableBalance) {
        console.warn('[useOrderManager] 余额不足，无法追加保证金');
        return false;
      }

      const orderIndex = orders.findIndex(
        (o) => o.id === orderId && !o.closed && o.marginMode === 'isolated',
      );
      if (orderIndex === -1) {
        console.warn('[useOrderManager] 订单不存在、已平仓或非逐仓模式');
        return false;
      }

      const order = orders[orderIndex];

      // 计算新的爆仓价格
      const newMargin = order.margin + amount;
      const maintenanceMarginRate = 0.005;
      const positionValue = order.executedPrice * order.size;
      const newLiquidationPrice =
        order.side === 'buy'
          ? order.executedPrice *
            (1 - (newMargin / positionValue) * (1 - maintenanceMarginRate))
          : order.executedPrice *
            (1 + (newMargin / positionValue) * (1 - maintenanceMarginRate));

      // 更新订单
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                margin: newMargin,
                liquidationPrice: newLiquidationPrice,
              }
            : o,
        ),
      );

      // 扣减余额
      setAvailableBalance((prev) => prev - amount);

      console.log(
        `[useOrderManager] 追加保证金成功: ${order.side.toUpperCase()} ${
          order.size
        } BTC, ` +
          `新保证金: ${newMargin.toFixed(2)} USDT, ` +
          `新爆仓价: ${newLiquidationPrice.toFixed(2)}`,
      );

      return true;
    },
    [orders, availableBalance],
  );

  return {
    availableBalance,
    orders,
    submitOrder,
    closeOrder,
    addMargin,
  };
}
