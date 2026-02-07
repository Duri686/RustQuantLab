import { useState, useCallback, useRef, useEffect } from 'react';
import { useUiStore, type UiState } from './ui/useUiStore';

/* ============================================
   Types
   ============================================ */

export type DataSource = 'mock' | 'binance';

export interface UseDataSourceResult {
    dataSource: DataSource;
    setDataSource: (source: DataSource) => void;
    isSwitching: boolean;
    switchVisible: boolean;
    handleDataSourceChange: (source: DataSource) => void;
}

/* ============================================
   Constants
   ============================================ */

const DATA_SOURCE_KEY = 'rustquantlab_data_source';
const MIN_SWITCH_MS = 300;

/**
 * 获取初始数据源
 * 优先级: URL 参数 > localStorage > 默认 mock
 */
function getInitialDataSource(): DataSource {
    // 检查 URL 参数
    const params = new URLSearchParams(window.location.search);
    const urlSource = params.get('source');
    if (urlSource === 'binance' || urlSource === 'mock') {
        return urlSource;
    }

    // 检查 localStorage
    const savedSource = localStorage.getItem(DATA_SOURCE_KEY);
    if (savedSource === 'binance' || savedSource === 'mock') {
        return savedSource;
    }

    // 默认使用模拟数据
    return 'mock';
}

/* ============================================
   Hook
   ============================================ */

export function useDataSource(): UseDataSourceResult {
    const [dataSource, setDataSource] = useState<DataSource>(getInitialDataSource);
    const isSwitching = useUiStore((s: UiState) => s.isSwitching);
    const setSwitching = useUiStore((s: UiState) => s.setSwitching);

    const [switchVisible, setSwitchVisible] = useState<boolean>(false);
    const switchStartRef = useRef<number | null>(null);

    // 持久化数据源偏好
    useEffect(() => {
        localStorage.setItem(DATA_SOURCE_KEY, dataSource);
    }, [dataSource]);

    // 切换时振动反馈
    useEffect(() => {
        try {
            if (isSwitching) {
                (navigator as any)?.vibrate?.(30);
            } else {
                (navigator as any)?.vibrate?.(20);
            }
        } catch { }
    }, [isSwitching]);

    // 最小切换时间控制
    useEffect(() => {
        if (isSwitching) {
            switchStartRef.current = performance.now();
            setSwitchVisible(true);
            return;
        }
        const started = switchStartRef.current ?? performance.now();
        const elapsed = performance.now() - started;
        const remaining = Math.max(0, MIN_SWITCH_MS - elapsed);
        const t = setTimeout(() => {
            setSwitchVisible(false);
            switchStartRef.current = null;
        }, remaining);
        return () => clearTimeout(t);
    }, [isSwitching]);

    // 数据源切换处理
    const handleDataSourceChange = useCallback(
        (source: DataSource) => {
            if (source !== dataSource) {
                setSwitching(true);
                setDataSource(source);
            }
        },
        [dataSource, setSwitching],
    );

    return {
        dataSource,
        setDataSource,
        isSwitching,
        switchVisible,
        handleDataSourceChange,
    };
}
