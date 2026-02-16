/**
 * Binance 数据源常量
 *
 * 统一管理所有 Binance API 相关的端点、默认值和配置，
 * 避免 magic string 散落在各服务文件中。
 */

import type { MarketType, BinanceInterval } from './types';

// ============================================================================
// 全局默认值
// ============================================================================

/** 默认市场类型：USDT 永续合约 */
export const DEFAULT_MARKET: MarketType = 'futures';

/** 默认交易对 */
export const DEFAULT_SYMBOL = 'BTCUSDT';

/** 默认 K 线周期 */
export const DEFAULT_INTERVAL: BinanceInterval = '1m';

// ============================================================================
// REST API 端点
// ============================================================================

/** REST API 基础 URL（生产环境直连 Binance） */
export const REST_BASE_URLS = {
  spot: 'https://api.binance.com',
  futures: 'https://fapi.binance.com',
} as const;

/** Vite 代理路径（本地开发用） */
export const PROXY_PATHS = {
  spot: '/binance-spot',
  futures: '/binance-futures',
} as const;

/** REST API 路径 (按市场类型区分) */
export const REST_ENDPOINTS = {
  spot: {
    klines: '/api/v3/klines',
    depth: '/api/v3/depth',
    ticker24h: '/api/v3/ticker/24hr',
  },
  futures: {
    klines: '/fapi/v1/klines',
    depth: '/fapi/v1/depth',
    ticker24h: '/fapi/v1/ticker/24hr',
  },
} as const;

// ============================================================================
// WebSocket 端点
// ============================================================================

/** WebSocket 端点（直连 Binance） */
export const WS_ENDPOINTS = {
  spot: 'wss://stream.binance.com:9443/ws',
  futures: 'wss://fstream.binance.com/ws',
} as const;

// ============================================================================
// 工具函数
// ============================================================================

/** 检测是否是本地开发环境 */
export const IS_DEV =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

/**
 * 获取 REST API 基础 URL
 * 本地开发使用 Vite 代理，生产环境直连 Binance
 */
export function getBaseUrl(market: MarketType = DEFAULT_MARKET): string {
  return IS_DEV ? PROXY_PATHS[market] : REST_BASE_URLS[market];
}
