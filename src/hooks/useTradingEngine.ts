import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useMockMarket } from './useMockMarket';
import { useCandleData } from './useCandleData';
import { wasmLock } from './wasmLock';
import type {
  AnalysisResult,
  MarketEngineInstance,
  WasmModule,
  TradingEngineState,
  WasmTimeframe,
  WasmCandleHistory,
  SimOrderResult,
  OrderRecord,
  MarginMode,
} from '../types/index';

// ============================================================================
// 模块级别单例 - 防止 React StrictMode / HMR 重复初始化
// ============================================================================

interface WasmSingleton {
  engine: MarketEngineInstance | null;
  initPromise: Promise<MarketEngineInstance> | null;
  isInitializing: boolean;
  instanceCount: number;
}

/** 全局 Wasm 单例状态 */
const wasmSingleton: WasmSingleton = {
  engine: null,
  initPromise: null,
  isInitializing: false,
  instanceCount: 0,
};

/**
 * 初始化 Wasm 引擎 (单例模式)
 * 确保全局只有一个 MarketEngine 实例
 */
async function initWasmEngine(): Promise<MarketEngineInstance> {
  // 如果已有引擎，直接返回
  if (wasmSingleton.engine) {
    return wasmSingleton.engine;
  }

  // 如果正在初始化，等待现有 Promise
  if (wasmSingleton.initPromise) {
    return wasmSingleton.initPromise;
  }

  // 开始初始化
  wasmSingleton.isInitializing = true;
  wasmSingleton.initPromise = (async () => {
    try {
      const wasm = await import('../../core/pkg/quant_core');
      if (typeof wasm.default === 'function') {
        await wasm.default();
      }

      const wasmMod = wasm as unknown as WasmModule;
      const engine = new wasmMod.MarketEngine();

      wasmSingleton.engine = engine;
      wasmSingleton.instanceCount += 1;
      console.log(
        `[Wasm] MarketEngine 初始化成功 (instance #${wasmSingleton.instanceCount})`,
      );

      return engine;
    } catch (err) {
      wasmSingleton.initPromise = null;
      throw err;
    } finally {
      wasmSingleton.isInitializing = false;
    }
  })();

  return wasmSingleton.initPromise;
}

/**
 * 获取共享的 Wasm 引擎实例 (供其他 hook 使用)
 */
export function getSharedWasmEngine(): MarketEngineInstance | null {
  return wasmSingleton.engine;
}

/**
 * 释放 Wasm 引擎 (仅在 HMR 或页面卸载时调用)
 */
function destroyWasmEngine(): void {
  if (wasmSingleton.engine) {
    try {
      wasmSingleton.engine.free();
      console.log('[Wasm] MarketEngine 已释放');
    } catch {
      // 忽略已释放的引擎
    }
    wasmSingleton.engine = null;
    wasmSingleton.initPromise = null;
  }
}

// HMR 热更新时清理引擎，防止内存泄漏
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[HMR] 模块卸载，释放 Wasm 引擎');
    destroyWasmEngine();
  });
}

/**
 * useTradingEngine Hook
 * 交易引擎主控制器 - 整合 Wasm、Mock 数据和 K 线聚合
 *
 * 职责：
 * 1. 初始化 Wasm MarketEngine
 * 2. 管理 Mock 市场数据流
 * 3. 将 Tick 数据传递给 Wasm 计算
 * 4. 桥接 K 线聚合 + 指标数据
 *
 * @param tickInterval - Tick 数据间隔（毫秒），默认 100ms
 * @returns TradingEngineState - UI 所需的所有数据和控制函数
 */
export function useTradingEngine(
  tickInterval: number = 100,
): TradingEngineState {
  // Mock Market Hook
  const { latestData, isRunning, start, stop } = useMockMarket(tickInterval);

  // Wasm 状态
  const [wasmReady, setWasmReady] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 账户余额状态（模拟交易）
  const [availableBalance, setAvailableBalance] = useState<number>(100000);

  // 订单记录
  const [orders, setOrders] = useState<OrderRecord[]>([]);

  // Engine 实例引用
  const engineRef = useRef<MarketEngineInstance | null>(null);
  const prevPriceRef = useRef<number | null>(null);

  // Wasm 分析结果
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );

  // Rust K 线历史数据
  const [rustCandleHistory, setRustCandleHistory] =
    useState<WasmCandleHistory | null>(null);

  // K 线聚合 Hook - 使用 Rust K 线数据
  const {
    candleHistory,
    currentLiveCandle,
    indicatorData,
    currentIndicators,
    currentTimeframe,
  } = useCandleData({
    latestTick: latestData,
    analysisResult,
    rustCandleHistory,
    useRustCandles: true,
  });

  /**
   * 标记引擎是否可用（防止 free 后继续调用）
   */
  const engineAlive = useRef<boolean>(false);

  /**
   * 组件挂载计数 (用于检测 StrictMode 双重挂载)
   */
  const mountCountRef = useRef(0);

  /**
   * 初始化 Wasm 模块 (使用单例模式)
   */
  useEffect(() => {
    mountCountRef.current += 1;
    const currentMount = mountCountRef.current;
    let aborted = false;

    const init = async () => {
      try {
        // 使用单例初始化，避免重复创建
        const engine = await initWasmEngine();

        if (aborted) return;

        // 绑定到当前组件的 ref
        engineRef.current = engine;
        engineAlive.current = true;

        setWasmReady(true);
        setLoading(false);
      } catch (err) {
        if (!aborted) {
          console.error('Wasm 模块加载失败:', err);
          setError(err instanceof Error ? err.message : '未知错误');
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      aborted = true;
      engineAlive.current = false;
      engineRef.current = null;

      // 只有最后一个挂载的组件卸载时才释放引擎
      // 在 StrictMode 下，第一次卸载不释放，第二次挂载复用
      // 注意：这里不调用 destroyWasmEngine()，因为 HMR 会导致问题
      // 引擎在页面刷新时自然释放
      console.log(`[Wasm] 组件卸载 (mount #${currentMount}), 引擎保持活跃`);
    };
  }, []);

  /**
   * 自动启动数据流
   */
  const hasAutoStarted = useRef(false);
  useEffect(() => {
    if (wasmReady && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      start();
    }
  }, [wasmReady, start]);

  /**
   * 防止并发调用锁 (使用时间戳增强)
   */
  const isProcessingRef = useRef(false);
  const lastProcessTimeRef = useRef(0);

  /**
   * 连续错误计数
   */
  const errorCountRef = useRef(0);
  const MAX_ERRORS = 5; // 提高容错阈值

  /**
   * 处理市场数据（高频 Tick）
   * 使用锁机制防止 Wasm 对象的并发/递归访问
   */
  useEffect(() => {
    // 双重检查：引用存在 + 引擎可用 + 单例存在
    if (!latestData || !engineRef.current || !engineAlive.current) return;
    if (!wasmSingleton.engine) return;

    // 防止并发调用 - Wasm 对象不支持递归访问
    if (isProcessingRef.current) {
      return;
    }

    // 使用共享锁防止与 useTradingState 的并发调用
    if (!wasmLock.acquire()) {
      return;
    }

    // 增加最小调用间隔保护 (10ms)
    const now = Date.now();
    if (now - lastProcessTimeRef.current < 10) {
      wasmLock.release();
      return;
    }

    isProcessingRef.current = true;
    lastProcessTimeRef.current = now;

    try {
      // 额外检查引擎是否仍然有效
      if (!wasmSingleton.engine || engineRef.current !== wasmSingleton.engine) {
        isProcessingRef.current = false;
        wasmLock.release();
        return;
      }

      const result = engineRef.current.on_tick(latestData);
      setAnalysisResult(result);
      prevPriceRef.current = latestData.price;

      // 获取当前时间周期的 K 线数据
      try {
        const candles = engineRef.current.get_active_candles();
        setRustCandleHistory(candles);
      } catch {
        // K 线获取失败不影响主流程
      }

      // 成功后重置错误计数
      errorCountRef.current = 0;
    } catch (err) {
      // 如果引擎已被释放，静默忽略
      if (!engineAlive.current || !wasmSingleton.engine) {
        isProcessingRef.current = false;
        return;
      }

      errorCountRef.current += 1;

      // 只在首次和每 5 次错误时打印日志，减少控制台噪音
      if (errorCountRef.current === 1 || errorCountRef.current % 5 === 0) {
        console.error(
          `MarketEngine.on_tick 错误 (${errorCountRef.current}/${MAX_ERRORS}):`,
          err,
        );
      }

      // 连续错误过多时，尝试重新初始化引擎
      if (errorCountRef.current >= MAX_ERRORS) {
        console.warn('MarketEngine 连续错误过多，尝试重新初始化...');
        engineAlive.current = false;

        // 清理并重新初始化
        destroyWasmEngine();
        setTimeout(async () => {
          try {
            const newEngine = await initWasmEngine();
            engineRef.current = newEngine;
            engineAlive.current = true;
            errorCountRef.current = 0;
            console.log('[Wasm] 引擎重新初始化成功');
          } catch (reinitErr) {
            console.error('[Wasm] 引擎重新初始化失败:', reinitErr);
          }
        }, 100);
      }
    } finally {
      isProcessingRef.current = false;
      wasmLock.release();
    }
  }, [latestData]);

  /**
   * 爆仓检测
   * 当市场价格触及爆仓价时，自动强制平仓
   */
  useEffect(() => {
    if (!latestData) return;

    const currentPrice = latestData.price;

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
  }, [latestData]);

  /**
   * 切换数据流开关
   */
  const toggleFeed = useCallback(() => {
    if (isRunning) {
      stop();
    } else {
      start();
    }
  }, [isRunning, start, stop]);

  /**
   * 切换时间周期
   * 调用 Rust 引擎的 set_timeframe 方法
   */
  const setTimeframe = useCallback((timeframe: WasmTimeframe): boolean => {
    if (!engineAlive.current || !engineRef.current || !wasmSingleton.engine) {
      console.warn('[useTradingEngine] 引擎未就绪，无法切换时间周期');
      return false;
    }

    try {
      // 调用 Rust 引擎切换时间周期
      const success = engineRef.current.set_timeframe(timeframe);
      if (success) {
        console.log(`[useTradingEngine] 时间周期已切换为 ${timeframe}`);

        // 立即获取新周期的 K 线数据
        try {
          const candles = engineRef.current.get_active_candles();
          setRustCandleHistory(candles);
        } catch {
          // K 线获取失败不影响主流程
        }
      } else {
        console.warn(`[useTradingEngine] 切换时间周期失败: ${timeframe}`);
      }
      return success;
    } catch (err) {
      console.error('[useTradingEngine] 切换时间周期失败:', err);
      return false;
    }
  }, []);

  /**
   * 提交模拟订单
   * 调用 Rust 引擎的 submit_order 方法
   * 订单执行后会影响市场价格和成交量
   */
  const submitOrder = useCallback(
    (order: {
      side: 'buy' | 'sell';
      price: number;
      size: number;
      leverage: number;
      marginMode: MarginMode;
    }): SimOrderResult | null => {
      if (!engineAlive.current || !engineRef.current || !wasmSingleton.engine) {
        console.warn('[useTradingEngine] 引擎未就绪，无法提交订单');
        return null;
      }

      // 防止在处理其他操作时并发调用
      if (isProcessingRef.current) {
        console.warn('[useTradingEngine] 引擎正忙，请稍后重试');
        return null;
      }

      isProcessingRef.current = true;

      try {
        // 计算所需保证金 = 订单价值 / 杠杆
        const orderValue = order.price * order.size;
        const requiredMargin = orderValue / order.leverage;

        // 检查余额是否足够
        if (requiredMargin > availableBalance) {
          console.warn(
            `[useTradingEngine] 余额不足: 需要 ${requiredMargin.toFixed(
              2,
            )} USDT, 可用 ${availableBalance.toFixed(2)} USDT`,
          );
          return null;
        }

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
        // 多单爆仓价 = 开仓价 × (1 - (1 - 维持保证金率) / 杠杆)
        // 空单爆仓价 = 开仓价 × (1 + (1 - 维持保证金率) / 杠杆)
        const maintenanceMarginRate = 0.005; // 0.5% 维持保证金率
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
        setOrders((prev) => [orderRecord, ...prev].slice(0, 50)); // 保留最近 50 条

        console.log(
          `[useTradingEngine] 订单已执行: ${
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
        console.error('[useTradingEngine] 订单提交失败:', err);
        return null;
      } finally {
        isProcessingRef.current = false;
      }
    },
    [availableBalance],
  );

  /**
   * 平仓操作
   * 关闭指定订单，计算并结算盈亏
   */
  const closeOrder = useCallback(
    (orderId: string, currentPrice: number): boolean => {
      const orderIndex = orders.findIndex((o) => o.id === orderId && !o.closed);
      if (orderIndex === -1) {
        console.warn('[useTradingEngine] 订单不存在或已平仓:', orderId);
        return false;
      }

      const order = orders[orderIndex];

      // 计算实现盈亏
      const pnlPercent =
        order.side === 'buy'
          ? ((currentPrice - order.executedPrice) / order.executedPrice) *
            100 *
            order.leverage
          : ((order.executedPrice - currentPrice) / order.executedPrice) *
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
                closePrice: currentPrice,
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
        `[useTradingEngine] 平仓成功: ${order.side.toUpperCase()} ${
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
        console.warn('[useTradingEngine] 追加保证金金额必须大于0');
        return false;
      }

      if (amount > availableBalance) {
        console.warn('[useTradingEngine] 余额不足，无法追加保证金');
        return false;
      }

      const orderIndex = orders.findIndex(
        (o) => o.id === orderId && !o.closed && o.marginMode === 'isolated',
      );
      if (orderIndex === -1) {
        console.warn('[useTradingEngine] 订单不存在、已平仓或非逐仓模式');
        return false;
      }

      const order = orders[orderIndex];

      // 计算新的爆仓价格
      const newMargin = order.margin + amount;
      const maintenanceMarginRate = 0.005;
      // 新爆仓价 = 开仓价 × (1 - (新保证金 / 仓位价值) × (1 - 维持保证金率))
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
        `[useTradingEngine] 追加保证金成功: ${order.side.toUpperCase()} ${
          order.size
        } BTC, ` +
          `新保证金: ${newMargin.toFixed(2)} USDT, ` +
          `新爆仓价: ${newLiquidationPrice.toFixed(2)}`,
      );

      return true;
    },
    [orders, availableBalance],
  );

  /**
   * 价格趋势计算
   */
  const priceTrend = useMemo((): 'up' | 'down' | 'neutral' => {
    if (!latestData || prevPriceRef.current === null) return 'neutral';
    if (latestData.price > prevPriceRef.current) return 'up';
    if (latestData.price < prevPriceRef.current) return 'down';
    return 'neutral';
  }, [latestData]);

  /**
   * 价格颜色映射
   */
  const priceColorClass = useMemo(() => {
    if (priceTrend === 'up') return 'text-[#00f090]';
    if (priceTrend === 'down') return 'text-[#ff3b30]';
    return 'text-white';
  }, [priceTrend]);

  return {
    latestData,
    analysisResult,
    candleHistory,
    currentLiveCandle,
    indicatorData,
    currentIndicators,
    currentTimeframe,
    isRunning,
    wasmReady,
    loading,
    error,
    priceTrend,
    priceColorClass,
    availableBalance,
    orders,
    toggleFeed,
    setTimeframe,
    submitOrder,
    closeOrder,
    addMargin,
  };
}
