/**
 * Binance 数据服务
 * 
 * 提供 BTC 合约的历史 K 线和实时数据
 * 
 * ## 使用示例
 * 
 * ```typescript
 * import { BinanceAPI, BinanceWebSocket, createKlineWs } from '@/services/binance';
 * 
 * // 获取历史 K 线
 * const klines = await BinanceAPI.getKlines('BTCUSDT', '1h', 500);
 * 
 * // 实时 K 线订阅
 * const ws = createKlineWs('BTCUSDT', '1m', 'futures', (k) => {
 *   console.log('实时K线:', k.c);
 * });
 * 
 * // 停止订阅
 * ws.stop();
 * ```
 */

// 导出类型
export type {
  BinanceKline,
  BinanceKlineRaw,
  BinanceDepth,
  BinanceTicker24h,
  BinancePremiumIndex,
  BinanceWsKlineMsg,
  BinanceWsTradeMsg,
  BinanceWsDepthMsg,
  BinanceInterval,
  MarketType,
  ConnectionStatus,
} from './types';

// 导出 REST API
export {
  getKlines,
  getKlinesBatch,
  getDepth,
  getTicker24h,
  getPremiumIndex,
  toHistoryCandle,
} from './api';

// 导出常量
export {
  DEFAULT_MARKET,
  DEFAULT_SYMBOL,
  DEFAULT_INTERVAL,
  WS_ENDPOINTS,
  REST_ENDPOINTS,
  REST_BASE_URLS,
  PROXY_PATHS,
  IS_DEV,
  getBaseUrl,
} from './constants';

// 导出 WebSocket
export {
  BinanceWebSocket,
  createKlineWs,
  createTradeWs,
  createMultiStreamWs,
  type BinanceWsCallbacks,
  type BinanceWsOptions,
} from './websocket';

// ============================================================================
// 便捷 API 命名空间
// ============================================================================

import * as api from './api';

/**
 * Binance API 命名空间
 * 
 * 提供简洁的 API 调用方式
 */
export const BinanceAPI = {
  /** 获取历史 K 线 */
  getKlines: api.getKlines,
  /** 批量获取历史 K 线 (自动分页) */
  getKlinesBatch: api.getKlinesBatch,
  /** 获取订单簿深度 */
  getDepth: api.getDepth,
  /** 获取 24h 价格统计 */
  getTicker24h: api.getTicker24h,
  /** 获取合约标记价格 / 资金费率 */
  getPremiumIndex: api.getPremiumIndex,
  /** 转换为内部 HistoryCandle 格式 */
  toHistoryCandle: api.toHistoryCandle,
} as const;

