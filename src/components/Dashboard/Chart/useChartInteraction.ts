import {
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
  RefObject,
} from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { DEFAULT_VISIBLE_CANDLES } from './chartConfig';

/**
 * dataZoom 事件参数类型
 */
interface DataZoomParams {
  end?: number;
  batch?: Array<{ end?: number }>;
}

/**
 * updateAxisPointer 事件参数类型
 */
interface AxisPointerParams {
  dataIndex?: number;
  seriesIndex?: number;
  axesInfo?: Array<{ axisDim: string; value: number | string }>;
}

/**
 * 图表交互 Hook 返回值
 */
interface ChartInteractionResult {
  /** 是否显示 Re-Sync 按钮 */
  showReSync: boolean;
  /** 当前悬停的数据索引 (用于 TradingView 风格头部数据显示) */
  hoverDataIndex: number | null;
  /** dataZoom 事件处理器 */
  handleDataZoom: (params: DataZoomParams) => void;
  /** Re-Sync 按钮点击处理器 */
  handleReSync: () => void;
  /** ECharts 事件监听对象 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEvents: Record<string, (params: any) => void>;
}

/**
 * 图表交互逻辑 Hook
 * 处理 "Smart Latching" 自动跟随 & dataZoom 漫游逻辑
 *
 * @param chartRef - ReactECharts 实例引用
 * @param option - ECharts 配置对象
 * @param totalCandles - 当前 K 线总数
 */
export function useChartInteraction(
  chartRef: RefObject<ReactECharts | null>,
  option: EChartsOption,
  totalCandles: number,
  structureKey: string,
): ChartInteractionResult {
  /**
   * 自动跟随最新数据标志
   * - true: 视图自动滚动到最新 K 线
   * - false: 用户正在浏览历史，视图锁定
   */
  const isAutoFollow = useRef<boolean>(true);

  const lastStructureKey = useRef<string | null>(null);

  /**
   * 用于触发 UI 更新的 state（显示/隐藏 Re-Sync 按钮）
   */
  const [showReSync, setShowReSync] = useState<boolean>(false);

  /**
   * 当前悬停的数据索引 (用于 TradingView 风格头部数据显示)
   * null 表示鼠标不在图表上，显示最新数据
   */
  const [hoverDataIndex, setHoverDataIndex] = useState<number | null>(null);

  /**
   * 处理 dataZoom 事件（用户拖拽/缩放时触发）
   * 如果用户离开了最右侧（end < 100），则禁用自动跟随
   */
  const handleDataZoom = useCallback((params: DataZoomParams) => {
    // dataZoom 事件可能来自 inside 或 slider，需要兼容两种格式
    let endValue: number | undefined;
    if (params.batch && params.batch.length > 0) {
      endValue = params.batch[0].end;
    } else {
      endValue = params.end;
    }

    if (typeof endValue === 'number') {
      // 阈值判断：end < 99.5 认为用户离开了最右侧
      if (endValue < 99.5) {
        isAutoFollow.current = false;
        setShowReSync(true);
      } else {
        isAutoFollow.current = true;
        setShowReSync(false);
      }
    }
  }, []);

  /**
   * Re-Sync 按钮点击：重新跟随最新数据
   */
  const handleReSync = useCallback(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    if (!chartInstance) return;

    isAutoFollow.current = true;
    setShowReSync(false);

    // 强制滚动到最新数据
    chartInstance.dispatchAction({
      type: 'dataZoom',
      start: Math.max(
        0,
        100 - (DEFAULT_VISIBLE_CANDLES / Math.max(totalCandles, 1)) * 100,
      ),
      end: 100,
    });
  }, [chartRef, totalCandles]);

  /**
   * 数据更新时的"静默追加"逻辑
   * - 如果 isAutoFollow 为 true，更新数据并滚动到最新
   * - 如果 isAutoFollow 为 false，只更新数据，不改变视图位置
   */
  useEffect(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    if (!chartInstance) return;

    const isStructureChanged = lastStructureKey.current !== structureKey;
    lastStructureKey.current = structureKey;

    if (isStructureChanged) {
      chartInstance.setOption(option, { notMerge: true, lazyUpdate: true });
      return;
    }

    if (isAutoFollow.current) {
      // 自动跟随模式：完整更新包括 dataZoom
      chartInstance.setOption(option, { notMerge: false, lazyUpdate: true });
    } else {
      // 漫游模式：只更新数据，不更新 dataZoom（静默追加）
      const silentOption = { ...option };
      delete silentOption.dataZoom;
      chartInstance.setOption(silentOption, {
        notMerge: false,
        lazyUpdate: true,
      });
    }
  }, [chartRef, option, structureKey]);

  /**
   * 处理 updateAxisPointer 事件
   * 当鼠标在图表上移动时，获取当前悬停的数据索引
   */
  const handleUpdateAxisPointer = useCallback((params: AxisPointerParams) => {
    if (typeof params.dataIndex === 'number') {
      setHoverDataIndex(params.dataIndex);
    }
  }, []);

  /**
   * 处理鼠标离开图表事件
   * 重置 hoverDataIndex 为 null，显示最新数据
   */
  const handleGlobalOut = useCallback(() => {
    setHoverDataIndex(null);
  }, []);

  /**
   * ECharts 事件监听对象
   */
  const onEvents = useMemo(
    () => ({
      dataZoom: handleDataZoom,
      updateAxisPointer: handleUpdateAxisPointer,
      globalout: handleGlobalOut,
    }),
    [handleDataZoom, handleUpdateAxisPointer, handleGlobalOut],
  );

  return {
    showReSync,
    hoverDataIndex,
    handleDataZoom,
    handleReSync,
    onEvents,
  };
}
