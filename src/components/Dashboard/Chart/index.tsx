import {
  useMemo,
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsReactProps } from 'echarts-for-react';
import type { Candle, IndicatorData } from '../../../types/index';
import {
  extractChartData,
  calculatePriceRange,
  calculateDataZoomStart,
  getChartOption,
} from './chartConfig';
import { useChartResize } from './useChartResize';
import { useChartInteraction } from './useChartInteraction';
import { ChartOverlay } from './ChartOverlay';

/** 移动端断点 (px) - 与 TailwindCSS md 断点保持一致 */
const MOBILE_BREAKPOINT = 768;

/**
 * 检测是否为移动端 Hook
 * 使用 window.innerWidth 检测，并监听 resize 事件
 */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return true; // SSR 默认移动端
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // 使用 passive 优化滚动性能
    window.addEventListener('resize', checkMobile, { passive: true });
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

/**
 * KLineChart 组件 Props
 */
interface KLineChartProps {
  /** 已完成的 K 线历史数据 */
  candleHistory: Candle[];
  /** 当前实时 K 线（正在形成中） */
  currentLiveCandle: Candle | null;
  /** Rust Wasm 计算的指标数据历史 (已与 K 线对齐) */
  indicatorData: IndicatorData;
  /** 激活的主图指标 (如 ['MA', 'BOLL']) */
  activeMainIndicators?: string[];
  /** 激活的副图指标集合 (如 ['MACD', 'RSI', 'VOL']) */
  activeSubIndicators?: string[];
}

/**
 * KLineChart 暴露的方法 (通过 ref 访问)
 */
export interface KLineChartHandle {
  /** 截取图表为图片并下载 */
  takeScreenshot: () => void;
}

/**
 * 专业 K 线图表组件（画布漫游模式）
 * 使用 Apache ECharts 渲染 TradingView 风格的蜡烛图
 * 支持拖拽漫游、滚轮缩放，实时数据更新不打断用户视图
 */
const KLineChart = forwardRef<KLineChartHandle, KLineChartProps>(
  function KLineChart(
    {
      candleHistory,
      currentLiveCandle,
      indicatorData,
      activeMainIndicators = ['MA'],
      activeSubIndicators = ['VOL'],
    },
    ref,
  ) {
    const chartRef = useRef<ReactECharts>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 移动端检测 (用于xx风格布局)
    const isMobile = useIsMobile();

    // 合并历史 + 实时 K 线
    const allCandles = useMemo(() => {
      if (currentLiveCandle) {
        return [...candleHistory, currentLiveCandle];
      }
      return candleHistory;
    }, [candleHistory, currentLiveCandle]);

    // 提取图表基础数据 (OHLCV)
    const chartData = useMemo(() => extractChartData(allCandles), [allCandles]);

    // 确保指标数据与 K 线数据长度对齐
    // Rust 返回的 indicators 长度应该与 allCandles 一致（包含 currentCandle）
    // 如果长度不一致，说明存在边界情况，需要补齐
    const mergedIndicatorData: IndicatorData = useMemo(() => {
      const klineLen = allCandles.length;
      const indicatorLen = indicatorData.ma7.length;

      // 长度已对齐，直接使用
      if (indicatorLen >= klineLen) {
        return indicatorData;
      }

      // 需要补齐：用 null 前置填充，确保指标在正确的 K 线位置绘制
      const padLen = klineLen - indicatorLen;
      const padding = new Array<null>(padLen).fill(null);

      return {
        sma5: [...padding, ...indicatorData.sma5],
        ma7: [...padding, ...indicatorData.ma7],
        ma25: [...padding, ...indicatorData.ma25],
        ma99: [...padding, ...indicatorData.ma99],
        ema7: [...padding, ...indicatorData.ema7],
        ema25: [...padding, ...indicatorData.ema25],
        rsi14: [...padding, ...indicatorData.rsi14],
        bollUpper: [...padding, ...indicatorData.bollUpper],
        bollMid: [...padding, ...indicatorData.bollMid],
        bollLower: [...padding, ...indicatorData.bollLower],
        macdDif: [...padding, ...indicatorData.macdDif],
        macdDea: [...padding, ...indicatorData.macdDea],
        macdHist: [...padding, ...indicatorData.macdHist],
        volMa5: [...padding, ...indicatorData.volMa5],
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [indicatorData, allCandles.length, currentLiveCandle?.close]);

    // 计算价格范围 (Y 轴自适应)
    const priceRange = useMemo(
      () => calculatePriceRange(allCandles),
      [allCandles],
    );

    // 计算 dataZoom 起始位置
    const dataZoomStart = useMemo(
      () => calculateDataZoomStart(allCandles.length),
      [allCandles.length],
    );

    // 生成 ECharts 配置 (使用合并后的指标数据)
    // 依赖 currentLiveCandle 确保每次 tick 更新时均线也实时更新
    const option = useMemo(
      () =>
        getChartOption(
          chartData,
          mergedIndicatorData,
          priceRange,
          dataZoomStart,
          activeMainIndicators,
          activeSubIndicators,
          { isMobile }, // xx风格: 移动端主图优先布局
        ),
      [
        chartData,
        mergedIndicatorData,
        priceRange,
        dataZoomStart,
        activeMainIndicators,
        activeSubIndicators,
        isMobile, // 屏幕尺寸变化时重新计算布局
        currentLiveCandle, // 强制在 currentCandle 变化时重新计算
      ],
    );

    // 监听容器尺寸变化
    useChartResize(chartRef, containerRef);

    // 图表交互逻辑
    const { showReSync, handleReSync, onEvents } = useChartInteraction(
      chartRef,
      option,
      allCandles.length,
    );

    // ========== 暴露截图方法 ==========
    useImperativeHandle(
      ref,
      () => ({
        takeScreenshot: () => {
          const chartInstance = chartRef.current?.getEchartsInstance();
          if (!chartInstance) {
            console.warn('[KLineChart] 图表实例未就绪，无法截图');
            return;
          }

          try {
            // 获取图表 DataURL (PNG 格式)
            const dataUrl = chartInstance.getDataURL({
              type: 'png',
              pixelRatio: 2, // 高清截图
              backgroundColor: '#161a1e', // 保持深色背景
            });

            // 创建下载链接
            const link = document.createElement('a');
            link.download = `chart-${Date.now()}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log('[KLineChart] 截图已保存');
          } catch (err) {
            console.error('[KLineChart] 截图失败:', err);
          }
        },
      }),
      [],
    );

    // 空数据占位
    if (allCandles.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-neutral-500 font-mono text-sm">
              等待 K 线数据...
            </p>
          </div>
        </div>
      );
    }

    const echartsProps: EChartsReactProps = {
      option,
      style: { height: '100%', width: '100%', cursor: 'grab' },
      notMerge: false,
      lazyUpdate: true,
      onEvents,
    };

    return (
      <div
        ref={containerRef}
        className="w-full h-full overflow-hidden relative"
      >
        <ReactECharts ref={chartRef} {...echartsProps} />
        <ChartOverlay visible={showReSync} onReSync={handleReSync} />
      </div>
    );
  },
);

export default KLineChart;
