/**
 * Binance REST API 服务
 * 
 * 提供历史 K 线数据获取功能
 * - 现货: api.binance.com
 * - 合约: fapi.binance.com
 */

import type { 
  BinanceKlineRaw, 
  BinanceKline, 
  BinanceDepth,
  BinanceInterval,
  MarketType,
} from './types';

// ============================================================================
// API 端点配置
// ============================================================================

/**
 * 检测是否是本地开发环境
 */
const isDev = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

/**
 * 获取 API 基础 URL
 * 本地开发使用 Vite 代理，生产环境直连 Binance
 */
function getBaseUrl(market: 'spot' | 'futures'): string {
  if (isDev) {
    // 本地开发: 使用 Vite 代理路径
    return market === 'spot' ? '/binance-spot' : '/binance-futures';
  }
  
  // 生产环境: 直连 Binance API
  return market === 'spot' 
    ? 'https://api.binance.com'
    : 'https://fapi.binance.com';
}

const ENDPOINTS = {
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
// 工具函数
// ============================================================================

/**
 * 解析 Binance K 线原始数据
 */
function parseKline(raw: BinanceKlineRaw): BinanceKline {
  return {
    time: raw[0],
    open: parseFloat(raw[1]),
    high: parseFloat(raw[2]),
    low: parseFloat(raw[3]),
    close: parseFloat(raw[4]),
    volume: parseFloat(raw[5]),
    closeTime: raw[6],
    quoteVolume: parseFloat(raw[7]),
    trades: raw[8],
    takerBuyVolume: parseFloat(raw[9]),
    takerBuyQuoteVolume: parseFloat(raw[10]),
  };
}

/**
 * 构建 API URL
 */
function buildUrl(
  market: MarketType,
  endpoint: keyof typeof ENDPOINTS.spot,
  params: Record<string, string | number>
): string {
  const config = ENDPOINTS[market];
  const baseUrl = getBaseUrl(market);
  
  // 构建参数字符串
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    queryParams.append(key, String(value));
  });
  
  return `${baseUrl}${config[endpoint]}?${queryParams.toString()}`;
}

// ============================================================================
// API 函数
// ============================================================================

/**
 * 获取历史 K 线数据
 * 
 * @param symbol - 交易对 (如 BTCUSDT)
 * @param interval - K 线周期 (如 1m, 1h, 1d)
 * @param limit - 数量限制 (最大 1500)
 * @param market - 市场类型 (spot/futures)
 * @param startTime - 开始时间 (毫秒)
 * @param endTime - 结束时间 (毫秒)
 */
export async function getKlines(
  symbol: string = 'BTCUSDT',
  interval: BinanceInterval = '1h',
  limit: number = 500,
  market: MarketType = 'spot',
  startTime?: number,
  endTime?: number,
): Promise<BinanceKline[]> {
  const params: Record<string, string | number> = {
    symbol,
    interval,
    limit: Math.min(limit, 1500),
  };
  
  if (startTime) params.startTime = startTime;
  if (endTime) params.endTime = endTime;
  
  const url = buildUrl(market, 'klines', params);
  
  console.log('[Binance API] 请求 URL:', url);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
  }
  
  const rawData = await response.json();
  
  // 检查响应格式
  if (!Array.isArray(rawData)) {
    console.error('[Binance API] 非预期的响应格式:', rawData);
    throw new Error('Unexpected API response format');
  }
  
  return (rawData as BinanceKlineRaw[]).map(parseKline);
}

/**
 * 获取大量历史 K 线（自动分页）
 * 
 * Binance 单次最多返回 1500 根 K 线，此函数自动分页获取更多数据
 * 
 * @param symbol - 交易对
 * @param interval - K 线周期
 * @param totalCount - 需要的总数量（最大支持 10000+）
 * @param market - 市场类型
 */
export async function getKlinesBatch(
  symbol: string = 'BTCUSDT',
  interval: BinanceInterval = '1h',
  totalCount: number = 2000,
  market: MarketType = 'spot',
): Promise<BinanceKline[]> {
  const allKlines: BinanceKline[] = [];
  const batchSize = 1500; // Binance 单次最大限制
  let endTime: number | undefined;
  let batchCount = 0;
  const maxBatches = Math.ceil(totalCount / batchSize) + 5; // 允许额外批次以防数据不足
  
  console.log(`[Binance API] 开始批量获取 ${totalCount} 根 ${interval} K 线...`);
  
  while (allKlines.length < totalCount && batchCount < maxBatches) {
    const remaining = totalCount - allKlines.length;
    const limit = Math.min(remaining, batchSize);
    
    try {
      const klines = await getKlines(symbol, interval, limit, market, undefined, endTime);
      
      if (klines.length === 0) {
        console.log(`[Binance API] 已获取所有可用数据，共 ${allKlines.length} 根`);
        break;
      }
      
      // 按时间倒序获取，所以新数据插入到前面
      allKlines.unshift(...klines);
      batchCount++;
      
      console.log(`[Binance API] 批次 ${batchCount}: 获取 ${klines.length} 根，总计 ${allKlines.length} 根`);
      
      // 设置下一批的结束时间为当前批最早的时间 - 1ms
      endTime = klines[0].time - 1;
      
      // 避免 API 限流（每批之间延迟）
      if (allKlines.length < totalCount) {
        await new Promise(resolve => setTimeout(resolve, 200)); // 增加到 200ms 避免限流
      }
    } catch (err) {
      console.error(`[Binance API] 批次 ${batchCount + 1} 获取失败:`, err);
      // 如果已经获取了一些数据，返回已获取的数据
      if (allKlines.length > 0) {
        console.warn(`[Binance API] 返回已获取的 ${allKlines.length} 根 K 线`);
        break;
      }
      throw err;
    }
  }
  
  // 按时间排序并截取需要的数量
  const sorted = allKlines.sort((a, b) => a.time - b.time);
  const result = sorted.slice(-totalCount);
  
  console.log(`[Binance API] ✅ 批量获取完成: ${result.length} 根 K 线 (时间范围: ${new Date(result[0]?.time).toLocaleString()} ~ ${new Date(result[result.length - 1]?.time).toLocaleString()})`);
  
  return result;
}

/**
 * 获取订单簿深度
 * 
 * @param symbol - 交易对
 * @param limit - 深度档位 (有效值: 5, 10, 20, 50, 100, 500, 1000, 5000)
 * @param market - 市场类型
 */
export async function getDepth(
  symbol: string = 'BTCUSDT',
  limit: number = 100, // 默认获取 100 档深度数据（Binance 支持: 5, 10, 20, 50, 100, 500, 1000, 5000）
  market: MarketType = 'spot',
): Promise<BinanceDepth> {
  // 验证 limit 参数（Binance 有效值）
  const validLimits = [5, 10, 20, 50, 100, 500, 1000, 5000];
  const validLimit = validLimits.includes(limit) 
    ? limit 
    : validLimits.find(l => l >= limit) ?? 20;
  
  const url = buildUrl(market, 'depth', { symbol, limit: validLimit });
  
  console.log('[Binance API] 请求深度数据:', url);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[Binance API] 深度数据请求失败:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    });
    throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // 验证响应格式
  if (!data.bids || !data.asks || typeof data.lastUpdateId !== 'number') {
    console.error('[Binance API] 深度数据格式错误:', data);
    throw new Error('Invalid depth response format');
  }
  
  return data;
}

/**
 * 获取 24 小时价格统计
 */
export async function getTicker24h(
  symbol: string = 'BTCUSDT',
  market: MarketType = 'futures',
) {
  const url = buildUrl(market, 'ticker24h', { symbol });
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`);
  }
  
  return response.json();
}

/**
 * 获取合约标记价格 / 资金费率 (仅合约市场)
 *
 * @param symbol - 交易对 (如 BTCUSDT)
 */
export async function getPremiumIndex(
  symbol: string = 'BTCUSDT',
): Promise<import('./types').BinancePremiumIndex> {
  const baseUrl = getBaseUrl('futures');
  const url = `${baseUrl}/fapi/v1/premiumIndex?symbol=${symbol}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Binance premiumIndex API error: ${response.status}`);
  }

  return response.json();
}

/**
 * 将 Binance K 线转换为项目内部 HistoryCandle 格式
 */
export function toHistoryCandle(kline: BinanceKline) {
  return {
    time: kline.time,
    open: kline.open,
    high: kline.high,
    low: kline.low,
    close: kline.close,
    volume: kline.volume,
    tickCount: kline.trades,
  };
}

