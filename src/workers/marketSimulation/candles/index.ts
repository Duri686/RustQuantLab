/**
 * K 线生成模块统一导出
 */

export {
  generateShadows,
  applyTechnicalResponse,
  updateLiquidityState,
  getVolatilityScale,
  getMaxRange,
  getNormalRange,
  canGenerateLongWick,
} from './shadows';
export { generateVolume, updateVolatilityAndVolumeMode } from './volume';
export { generateNormalCandle, generateCandleFromState } from './generator';

