/**
 * Binance WebSocket 服务
 * 
 * 提供实时数据流订阅功能
 * - 现货: wss://stream.binance.com:9443
 * - 合约: wss://fstream.binance.com
 */

import type {
  BinanceWsKlineMsg,
  BinanceWsTradeMsg,
  BinanceWsDepthMsg,
  BinanceInterval,
  MarketType,
  ConnectionStatus,
} from './types';
import { WS_ENDPOINTS, DEFAULT_MARKET } from './constants';

// ============================================================================
// 类型定义
// ============================================================================

export interface BinanceWsCallbacks {
  onKline?: (data: BinanceWsKlineMsg['k']) => void;
  onTrade?: (data: BinanceWsTradeMsg) => void;
  onDepth?: (data: BinanceWsDepthMsg) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export interface BinanceWsOptions {
  symbol: string;
  market: MarketType;
  interval?: BinanceInterval;
  reconnect?: boolean;
  reconnectDelay?: number;
}

// ============================================================================
// WebSocket 管理类
// ============================================================================

export class BinanceWebSocket {
  private ws: WebSocket | null = null;
  private options: Required<BinanceWsOptions>;
  private callbacks: BinanceWsCallbacks = {};
  private status: ConnectionStatus = 'disconnected';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private streams: string[] = [];
  /** 手动停止标记，区分主动关闭和意外断开 */
  private manualStop = false;

  constructor(options: BinanceWsOptions) {
    this.options = {
      symbol: options.symbol,
      market: options.market,
      interval: options.interval ?? '1m',
      reconnect: options.reconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? 3000,
    };
  }

  /**
   * 设置回调函数
   */
  setCallbacks(callbacks: BinanceWsCallbacks): this {
    this.callbacks = { ...this.callbacks, ...callbacks };
    return this;
  }

  /**
   * 获取连接状态
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * 连接 K 线流
   */
  connectKline(): this {
    const symbol = this.options.symbol.toLowerCase();
    this.streams.push(`${symbol}@kline_${this.options.interval}`);
    return this;
  }

  /**
   * 连接逐笔交易流
   */
  connectTrade(): this {
    const symbol = this.options.symbol.toLowerCase();
    this.streams.push(`${symbol}@trade`);
    return this;
  }

  /**
   * 连接深度流 (增量更新)
   */
  connectDepth(speed: '100ms' | '1000ms' = '100ms'): this {
    const symbol = this.options.symbol.toLowerCase();
    const stream = speed === '100ms' 
      ? `${symbol}@depth@100ms` 
      : `${symbol}@depth`;
    this.streams.push(stream);
    return this;
  }

  /**
   * 启动 WebSocket 连接
   */
  start(): void {
    if (this.streams.length === 0) {
      console.warn('[BinanceWS] 未设置任何数据流');
      return;
    }

    this.manualStop = false;
    this.status = 'connecting';
    
    // 构建 WebSocket URL (支持多流)
    const baseUrl = WS_ENDPOINTS[this.options.market];
    const streamPath = this.streams.join('/');
    const url = `${baseUrl}/${streamPath}`;

    console.log(`[BinanceWS] 连接中: ${url}`);
    
    this.ws = new WebSocket(url);
    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onclose = this.handleClose.bind(this);
    this.ws.onerror = this.handleError.bind(this);
  }

  /**
   * 停止 WebSocket 连接（主动关闭，不再自动重连）
   */
  stop(): void {
    this.manualStop = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.status = 'disconnected';
    this.streams = [];
  }

  // ========== 内部方法 ==========

  private handleOpen(): void {
    console.log('[BinanceWS] ✅ 连接成功');
    this.status = 'connected';
    this.callbacks.onConnect?.();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // K 线数据
      if (data.e === 'kline') {
        this.callbacks.onKline?.(data.k);
      }
      // 逐笔交易
      else if (data.e === 'trade') {
        this.callbacks.onTrade?.(data);
      }
      // 深度更新
      else if (data.e === 'depthUpdate') {
        this.callbacks.onDepth?.(data);
      }
    } catch (err) {
      console.error('[BinanceWS] 消息解析错误:', err);
    }
  }

  private handleClose(): void {
    console.log('[BinanceWS] 连接关闭');
    this.status = 'disconnected';
    this.callbacks.onDisconnect?.();
    
    // 自动重连（仅在非主动停止且配置允许时）
    if (this.options.reconnect && !this.manualStop) {
      console.log(`[BinanceWS] ${this.options.reconnectDelay}ms 后重连...`);
      this.reconnectTimer = setTimeout(() => {
        this.start();
      }, this.options.reconnectDelay);
    }
  }

  private handleError(error: Event): void {
    console.error('[BinanceWS] 错误:', error);
    this.status = 'error';
    this.callbacks.onError?.(error);
  }
}

// ============================================================================
// 便捷工厂函数
// ============================================================================

/**
 * 创建 K 线 WebSocket 连接
 */
export function createKlineWs(
  symbol: string = 'BTCUSDT',
  interval: BinanceInterval = '1m',
  market: MarketType = DEFAULT_MARKET,
  onKline: (k: BinanceWsKlineMsg['k']) => void,
): BinanceWebSocket {
  const ws = new BinanceWebSocket({ symbol, market, interval });
  ws.setCallbacks({ onKline }).connectKline().start();
  return ws;
}

/**
 * 创建逐笔交易 WebSocket 连接
 */
export function createTradeWs(
  symbol: string = 'BTCUSDT',
  market: MarketType = DEFAULT_MARKET,
  onTrade: (trade: BinanceWsTradeMsg) => void,
): BinanceWebSocket {
  const ws = new BinanceWebSocket({ symbol, market });
  ws.setCallbacks({ onTrade }).connectTrade().start();
  return ws;
}

/**
 * 创建多流 WebSocket 连接 (K 线 + 深度)
 */
export function createMultiStreamWs(
  symbol: string = 'BTCUSDT',
  interval: BinanceInterval = '1m',
  market: MarketType = DEFAULT_MARKET,
  callbacks: BinanceWsCallbacks,
): BinanceWebSocket {
  const ws = new BinanceWebSocket({ symbol, market, interval });
  ws.setCallbacks(callbacks)
    .connectKline()
    .connectDepth('100ms')
    .start();
  return ws;
}

