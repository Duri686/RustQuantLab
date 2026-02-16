/**
 * Binance 实时市场数据 Hook
 *
 * 从 Binance API 获取 BTC 合约的历史 K 线和实时数据
 * 替代 useMockMarket，提供真实市场数据
 *
 * ## 数据流
 * 1. 初始化时从 REST API 获取历史 K 线
 * 2. 通过 WebSocket 订阅实时 K 线更新
 * 3. 将数据转换为与 useMockMarket 兼容的格式
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  BinanceAPI,
  BinanceWebSocket,
  type BinanceKline,
  type BinanceInterval,
  type MarketType,
  type BinanceWsKlineMsg,
  type BinanceWsDepthMsg,
  type BinanceWsTradeMsg,
  type BinanceTicker24h,
  type ConnectionStatus,
} from '../services/binance';
import type { OrderBook, HistoryCandle } from '../types/index';

/** 最近成交记录 */
export interface TradeRecord {
  /** 交易 ID */
  id: number;
  /** 价格 */
  price: number;
  /** 数量 */
  qty: number;
  /** 成交时间 (毫秒) */
  time: number;
  /** 是否是买方主动成交 */
  isBuyerMaker: boolean;
}

// ============================================================================
// 类型定义
// ============================================================================

export interface UseBinanceMarketOptions {
  /** 交易对 */
  symbol?: string;
  /** 市场类型 */
  market?: MarketType;
  /** 历史 K 线周期 (用于加载历史数据) */
  historyInterval?: BinanceInterval;
  /** 实时 K 线周期 */
  realtimeInterval?: BinanceInterval;
  /** 历史数据数量 */
  historyCount?: number;
  /** OrderBook 更新间隔 (ms) */
  tickInterval?: number;
}

export interface UseBinanceMarketReturn {
  /** 最新订单簿数据 (兼容 useMockMarket) */
  latestData: OrderBook | null;
  /** 数据流是否运行中 */
  isRunning: boolean;
  /** 启动数据流 */
  start: (startPrice?: number) => void;
  /** 停止数据流 */
  stop: () => void;
  /** 历史 K 线数据 (1s 粒度，兼容 Rust 引擎) */
  historyCandles: HistoryCandle[];
  /** 历史数据加载中 */
  historyLoading: boolean;
  /** 请求历史数据 */
  requestHistory: () => void;
  /** WebSocket 连接状态 */
  connectionStatus: ConnectionStatus;
  /** 当前价格 */
  currentPrice: number | null;
  /** 错误信息 */
  error: string | null;
  /** 24h Ticker 统计数据 (来自 Binance REST API) */
  ticker24h: BinanceTicker24h | null;
  /** 最近成交记录 (来自 WebSocket trade stream) */
  recentTrades: TradeRecord[];
  /** Taker 买入比例 (0~1，实时计算) */
  takerBuyRatio: number | null;
}

// ============================================================================
// 常量
// ============================================================================

/** 默认配置 */
const DEFAULT_OPTIONS: Required<UseBinanceMarketOptions> = {
  symbol: 'BTCUSDT',
  market: 'spot', // 使用现货 API (支持 CORS)
  historyInterval: '1m', // 历史数据用 1 分钟 K 线（Rust 引擎需要细粒度数据）
  realtimeInterval: '1s', // 实时用 1 秒 K 线
  historyCount: 5000, // 历史 K 线数量（5000 根 1m = 约 3.5 天，足够计算所有指标）
  tickInterval: 100, // 100ms 更新一次 OrderBook
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 将 Binance K 线转换为 HistoryCandle
 */
function toHistoryCandle(k: BinanceKline): HistoryCandle {
  return {
    time: k.time,
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close,
    volume: k.volume,
    tickCount: k.trades,
  };
}

/**
 * 从本地订单簿状态生成 OrderBook 对象
 *
 * @param maxRows - 最大显示行数（买单和卖单各显示这么多行），默认50
 */
function buildOrderBookFromState(
  orderBookState: { bids: Map<number, number>; asks: Map<number, number> },
  price: number,
  symbol: string = 'BTC-USDT',
  maxRows: number = 50, // 默认显示50档（买单50 + 卖单50 = 100行）
): OrderBook {
  // 转换为数组并排序
  const bids: [number, number][] = Array.from(orderBookState.bids.entries())
    .map(([p, q]) => [p, q] as [number, number])
    .sort((a, b) => b[0] - a[0]) // 价格降序
    .slice(0, maxRows); // 取前 maxRows 档

  const asks: [number, number][] = Array.from(orderBookState.asks.entries())
    .map(([p, q]) => [p, q] as [number, number])
    .sort((a, b) => a[0] - b[0]) // 价格升序
    .slice(0, maxRows); // 取前 maxRows 档

  return {
    symbol,
    timestamp: Date.now(),
    price,
    bids,
    asks,
  };
}

/**
 * 更新本地订单簿状态（增量更新）
 */
function updateOrderBookState(
  state: {
    bids: Map<number, number>;
    asks: Map<number, number>;
    lastUpdateId: number;
  },
  depthUpdate: {
    bids: [string, string][];
    asks: [string, string][];
    u: number;
  },
): void {
  // 更新买单
  depthUpdate.bids.forEach(([priceStr, qtyStr]) => {
    const price = parseFloat(priceStr);
    const qty = parseFloat(qtyStr);

    if (qty === 0) {
      // 数量为 0 表示删除该价格档位
      state.bids.delete(price);
    } else {
      // 更新或添加
      state.bids.set(price, qty);
    }
  });

  // 更新卖单
  depthUpdate.asks.forEach(([priceStr, qtyStr]) => {
    const price = parseFloat(priceStr);
    const qty = parseFloat(qtyStr);

    if (qty === 0) {
      // 数量为 0 表示删除该价格档位
      state.asks.delete(price);
    } else {
      // 更新或添加
      state.asks.set(price, qty);
    }
  });

  state.lastUpdateId = depthUpdate.u;
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useBinanceMarket(
  options: UseBinanceMarketOptions = {},
): UseBinanceMarketReturn {
  // 合并配置
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // ========== 状态 ==========
  const [latestData, setLatestData] = useState<OrderBook | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [historyCandles, setHistoryCandles] = useState<HistoryCandle[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('disconnected');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticker24h, setTicker24h] = useState<BinanceTicker24h | null>(null);
  const [recentTrades, setRecentTrades] = useState<TradeRecord[]>([]);
  const [takerBuyRatio, setTakerBuyRatio] = useState<number | null>(null);

  // ========== Refs ==========
  const wsRef = useRef<BinanceWebSocket | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const priceRef = useRef<number | null>(null);
  /** 本地订单簿状态 (维护完整订单簿) */
  const orderBookRef = useRef<{
    bids: Map<number, number>; // 价格 -> 数量
    asks: Map<number, number>;
    lastUpdateId: number;
  } | null>(null);

  /** 当前 K 线的累计成交量（来自 Binance WebSocket） */
  const currentKlineVolumeRef = useRef<number | null>(null);
  /** 上一次的累计成交量（用于计算增量） */
  const prevKlineVolumeRef = useRef<number | null>(null);
  /** 当前 K 线的开始时间（用于判断是否是新 K 线） */
  const currentKlineStartTimeRef = useRef<number | null>(null);

  // ========== 请求历史数据 ==========
  const requestHistory = useCallback(async () => {
    console.log(
      `[Binance] 📤 请求历史数据: ${opts.historyCount} 根 ${opts.historyInterval} K 线...`,
    );
    setHistoryLoading(true);
    setError(null);

    const t0 = performance.now();

    try {
      // 从 Binance 获取历史 K 线
      const klines = await BinanceAPI.getKlinesBatch(
        opts.symbol,
        opts.historyInterval,
        opts.historyCount,
        opts.market,
      );

      console.log(
        `[Binance] 📦 收到 ${klines.length} 根 K 线 (${(
          performance.now() - t0
        ).toFixed(0)}ms)`,
      );

      if (klines.length === 0) {
        console.warn('[Binance] ⚠️ 未获取到任何历史数据');
        setHistoryLoading(false);
        return;
      }

      // 转换为 HistoryCandle 格式（包含 VOL 成交量）
      const candles = klines.map(toHistoryCandle);

      // 统计信息
      const totalVolume = candles.reduce((sum, c) => sum + c.volume, 0);
      const timeRange =
        candles.length > 0
          ? `${new Date(candles[0].time).toLocaleString()} ~ ${new Date(
              candles[candles.length - 1].time,
            ).toLocaleString()}`
          : 'N/A';

      console.log(`[Binance] 📊 历史数据统计:`);
      console.log(`  - K 线数量: ${candles.length} 根`);
      console.log(`  - 时间范围: ${timeRange}`);
      console.log(`  - 总成交量: ${totalVolume.toFixed(2)}`);
      console.log(
        `  - 价格范围: $${Math.min(...candles.map((c) => c.low)).toFixed(
          2,
        )} ~ $${Math.max(...candles.map((c) => c.high)).toFixed(2)}`,
      );

      setHistoryCandles(candles);
      setHistoryLoading(false);

      // 设置初始价格
      if (candles.length > 0) {
        const lastPrice = candles[candles.length - 1].close;
        priceRef.current = lastPrice;
        setCurrentPrice(lastPrice);
      }

      console.log(
        `[Binance] ✅ 历史数据加载完成，Rust 引擎将自动计算 MACD、RSI 等指标`,
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '获取历史数据失败';

      // 检测地区限制错误
      if (errorMsg.includes('451') || errorMsg.includes('Unavailable')) {
        console.warn('[Binance] ⚠️ API 访问受限 (可能是地区限制)');
        console.warn('[Binance] 💡 提示: 请使用 MOCK 模式，或通过 VPN 访问');
        setError('Binance API 访问受限 (地区限制)，请切换到 MOCK 模式');
      } else {
        console.error('[Binance] ❌ 获取历史数据失败:', err);
        setError(errorMsg);
      }

      setHistoryLoading(false);
    }
  }, [opts.symbol, opts.historyInterval, opts.historyCount, opts.market]);

  // ========== 启动实时数据 ==========
  const start = useCallback(
    async (startPrice?: number) => {
      if (isRunning) return;

      console.log(`[Binance] 🚀 启动实时数据流...`);
      setIsRunning(true);
      setError(null);

      // 获取 24h Ticker 统计数据
      try {
        const ticker = await BinanceAPI.getTicker24h(opts.symbol, opts.market);
        setTicker24h(ticker);
        console.log('[Binance] ✅ 24h Ticker 已加载');
      } catch (tickerErr) {
        console.warn('[Binance] ⚠️ 获取 24h Ticker 失败，使用 K 线估算:', tickerErr);
      }

      // 如果有起始价格，设置它
      if (startPrice) {
        priceRef.current = startPrice;
        setCurrentPrice(startPrice);
      }

      try {
        // 1. 先获取初始订单簿快照
        console.log('[Binance] 📥 获取初始订单簿快照...');

        let depthSnapshot: Awaited<
          ReturnType<typeof BinanceAPI.getDepth>
        > | null = null;

        try {
          depthSnapshot = await BinanceAPI.getDepth(
            opts.symbol,
            100,
            opts.market,
          ); // 获取 100 档深度数据
        } catch (depthError) {
          console.warn(
            '[Binance] ⚠️ 获取订单簿快照失败，使用降级方案:',
            depthError,
          );
          console.warn('[Binance] 💡 WebSocket 深度流会逐步填充真实数据');
        }

        // 初始化订单簿状态
        if (depthSnapshot) {
          // 成功获取快照，使用真实数据
          const bidsMap = new Map<number, number>();
          const asksMap = new Map<number, number>();

          depthSnapshot.bids.forEach(([p, q]) => {
            bidsMap.set(parseFloat(p), parseFloat(q));
          });
          depthSnapshot.asks.forEach(([p, q]) => {
            asksMap.set(parseFloat(p), parseFloat(q));
          });

          orderBookRef.current = {
            bids: bidsMap,
            asks: asksMap,
            lastUpdateId: depthSnapshot.lastUpdateId,
          };

          // 计算中间价
          const bestBid = Array.from(bidsMap.keys()).sort((a, b) => b - a)[0];
          const bestAsk = Array.from(asksMap.keys()).sort((a, b) => a - b)[0];
          const midPrice = (bestBid + bestAsk) / 2;

          priceRef.current = midPrice;
          setCurrentPrice(midPrice);

          // 生成初始 OrderBook（传递50档，因为 OrderBook 组件显示50行）
          const initialOrderBook = buildOrderBookFromState(
            orderBookRef.current,
            midPrice,
            'BTC-USDT',
            50, // 买单和卖单各50档，总共100行
          );

          // 初始时没有成交量数据，等待 K 线更新
          // 但先设置一个默认值 0，避免 undefined
          initialOrderBook.volume = 0;

          setLatestData(initialOrderBook);

          console.log('[Binance] ✅ 订单簿快照已加载');
        } else {
          // 降级方案：如果深度 API 失败，使用模拟订单簿
          // 但继续使用 WebSocket 深度流（增量更新会逐步填充真实数据）
          const fallbackPrice = priceRef.current ?? 50000;
          const bidsMap = new Map<number, number>();
          const asksMap = new Map<number, number>();

          // 生成简单的模拟订单簿（后续会被 WebSocket 增量更新替换）
          for (let i = 1; i <= 20; i++) {
            const bidPrice = fallbackPrice * (1 - 0.0001 * i);
            const askPrice = fallbackPrice * (1 + 0.0001 * i);
            bidsMap.set(bidPrice, 0.5 + Math.random() * 2);
            asksMap.set(askPrice, 0.5 + Math.random() * 2);
          }

          orderBookRef.current = {
            bids: bidsMap,
            asks: asksMap,
            lastUpdateId: 0, // 初始化为 0，等待 WebSocket 更新
          };

          priceRef.current = fallbackPrice;
          setCurrentPrice(fallbackPrice);

          const initialOrderBook = buildOrderBookFromState(
            orderBookRef.current,
            fallbackPrice,
            'BTC-USDT',
            50, // 买单和卖单各50档，总共100行
          );

          // 初始时没有成交量数据，等待 K 线更新
          // 但先设置一个默认值 0，避免 undefined
          initialOrderBook.volume = 0;

          setLatestData(initialOrderBook);

          console.log(
            '[Binance] ⚠️ 使用降级订单簿，等待 WebSocket 增量更新填充真实数据...',
          );
        }

        // 2. 创建 WebSocket 连接订阅实时更新
        const ws = new BinanceWebSocket({
          symbol: opts.symbol,
          market: opts.market,
          interval: opts.realtimeInterval,
        });

        ws.setCallbacks({
          onConnect: () => {
            console.log('[Binance] ✅ WebSocket 已连接');
            setConnectionStatus('connected');
          },
          onDisconnect: () => {
            console.log('[Binance] 🔌 WebSocket 已断开');
            setConnectionStatus('disconnected');
          },
          onError: () => {
            setConnectionStatus('error');
            setError('WebSocket 连接错误');
          },
          onKline: (k: BinanceWsKlineMsg['k']) => {
            // 更新当前价格
            const price = parseFloat(k.c);
            priceRef.current = price;
            setCurrentPrice(price);

            // 更新成交量（Binance K 线数据中的 v 是累计成交量）
            // k.x === true 表示 K 线已完结，此时 v 是该 K 线的总成交量
            // k.x === false 表示 K 线未完结，此时 v 是当前累计成交量（会持续增长）
            const volume = parseFloat(k.v);
            const klineStartTime = k.t;

            // 判断是否是新 K 线（时间戳变化）
            const isNewKline =
              currentKlineStartTimeRef.current !== klineStartTime;

            if (isNewKline) {
              // 新 K 线开始，重置累计成交量
              prevKlineVolumeRef.current = 0;
              currentKlineStartTimeRef.current = klineStartTime;
            }

            // 计算成交量增量（WASM 引擎会累加，所以传递增量）
            const prevVolume = prevKlineVolumeRef.current ?? 0;
            const volumeDeltaRaw = volume - prevVolume;
            const volumeDelta = Math.max(0, volumeDeltaRaw);

            // 更新引用（保存 Binance 当前累计成交量）
            prevKlineVolumeRef.current = volume;
            currentKlineVolumeRef.current = volume;

            // 计算 Taker 买入比例（实时）
            const takerBuyVol = parseFloat(k.V);
            if (volume > 0) {
              setTakerBuyRatio(takerBuyVol / volume);
            }
            // K 线完结后，下一根 K 线开始时 prevKlineVolumeRef 会重置为 0

            // 立即更新 OrderBook（包含成交量）
            // 注意：WASM 引擎的 Candle::update 会累加成交量
            // Binance 的 K 线数据：
            // - k.x === true: 该 K 线的总成交量（独立值，不累加）
            // - k.x === false: 当前 K 线的累计成交量（会持续增长）
            //
            // WASM 引擎逻辑：
            // - 新 K 线：Candle::new(time, price, volume) - volume 作为初始值
            // - 更新 K 线：Candle::update(price, volume) - volume 会累加
            //
            // 策略：
            // - 如果 K 线已完结（k.x === true），传递总成交量（WASM 引擎会创建新 K 线）
            // - 如果 K 线未完结（k.x === false），传递增量（WASM 引擎会累加）
            if (orderBookRef.current) {
              const currentPrice = priceRef.current ?? price;
              const orderBook = buildOrderBookFromState(
                orderBookRef.current,
                currentPrice,
                'BTC-USDT',
                50,
              );

              // 计算应该传递的成交量：统一使用增量，确保最后一根 K 线的体积等于 Binance 实际成交量
              const volumeToPass = volumeDelta;

              orderBook.volume = volumeToPass;


              setLatestData(orderBook);
            }
          },
          onDepth: (depthUpdate: BinanceWsDepthMsg) => {
            // 更新订单簿（增量更新）
            if (orderBookRef.current) {
              // 检查更新 ID 是否连续（简单验证）
              // Binance 深度更新：U 是第一个更新 ID，u 是最后一个更新 ID
              if (depthUpdate.u >= orderBookRef.current.lastUpdateId) {
                updateOrderBookState(orderBookRef.current, {
                  bids: depthUpdate.b,
                  asks: depthUpdate.a,
                  u: depthUpdate.u,
                });

                // 计算当前价格（最佳买卖价的中间价）
                const bestBid = Array.from(
                  orderBookRef.current.bids.keys(),
                ).sort((a, b) => b - a)[0];
                const bestAsk = Array.from(
                  orderBookRef.current.asks.keys(),
                ).sort((a, b) => a - b)[0];

                const currentPrice =
                  priceRef.current ??
                  (bestBid && bestAsk
                    ? (bestBid + bestAsk) / 2
                    : priceRef.current ?? 0);

                if (currentPrice > 0) {
                  priceRef.current = currentPrice;
                  setCurrentPrice(currentPrice);

                  const orderBook = buildOrderBookFromState(
                    orderBookRef.current,
                    currentPrice,
                    'BTC-USDT',
                    50, // 买单和卖单各50档，总共100行
                  );

                  // 深度更新时传递 0 作为成交量
                  // 原因：WASM 引擎的 Candle::update 会累加成交量
                  // 传递 0 不会改变 K 线的成交量（累加 0 = 不变）
                  // 但可以保持成交量数据流的连续性，让 WASM 引擎知道当前 K 线的成交量
                  // 注意：真实的成交量数据只在 K 线更新时传递
                  orderBook.volume = 0;


                  setLatestData(orderBook);
                }
              }
            }
          },
          onTrade: (trade: BinanceWsTradeMsg) => {
            // 维护最近 50 笔成交记录
            const record: TradeRecord = {
              id: trade.t,
              price: parseFloat(trade.p),
              qty: parseFloat(trade.q),
              time: trade.T,
              isBuyerMaker: trade.m,
            };
            setRecentTrades((prev) => {
              const next = [record, ...prev];
              return next.length > 50 ? next.slice(0, 50) : next;
            });
          },
        });

        // 订阅 K 线、深度和逐笔交易数据
        ws.connectKline().connectDepth('100ms').connectTrade().start();
        wsRef.current = ws;

        // 定时更新 OrderBook（即使没有深度更新，也定期刷新价格）
        tickIntervalRef.current = setInterval(() => {
          const price = priceRef.current;
          if (price !== null && orderBookRef.current) {
            const orderBook = buildOrderBookFromState(
              orderBookRef.current,
              price,
              'BTC-USDT',
              50, // 买单和卖单各50档，总共100行
            );

            // 定时更新时传递 0 作为成交量
            // 原因：WASM 引擎的 Candle::update 会累加成交量
            // 传递 0 不会改变 K 线的成交量（累加 0 = 不变）
            // 但可以保持成交量数据流的连续性，让 WASM 引擎知道当前 K 线的成交量
            // 注意：真实的成交量数据只在 K 线更新时传递
            orderBook.volume = 0;



            setLatestData(orderBook);
          }
        }, opts.tickInterval);
      } catch (err) {
        console.error('[Binance] ❌ 启动实时数据失败:', err);
        setError(err instanceof Error ? err.message : '启动失败');
        setIsRunning(false);
      }
    },
    [
      isRunning,
      opts.symbol,
      opts.market,
      opts.realtimeInterval,
      opts.tickInterval,
    ],
  );

  // ========== 停止实时数据 ==========
  const stop = useCallback(() => {
    console.log('[Binance] ⏹️ 停止实时数据流');

    // 停止 WebSocket
    if (wsRef.current) {
      wsRef.current.stop();
      wsRef.current = null;
    }

    // 停止定时器
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }

    // 清理订单簿状态
    orderBookRef.current = null;

    setIsRunning(false);
    setConnectionStatus('disconnected');
  }, []);

  // ========== 清理 ==========
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.stop();
      }
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, []);

  // ========== 返回 ==========
  return {
    latestData,
    isRunning,
    start,
    stop,
    historyCandles,
    historyLoading,
    requestHistory,
    connectionStatus,
    currentPrice,
    error,
    ticker24h,
    recentTrades,
    takerBuyRatio,
  };
}
