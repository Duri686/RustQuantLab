import { create, type StateCreator } from 'zustand';

/**
 * 全局 UI 状态（Zustand）
 * - isSwitching: 数据源切换中的全局 Loading 开关
 */
export interface UiState {
  isSwitching: boolean;
  setSwitching: (value: boolean) => void;
}

const creator: StateCreator<UiState> = (set) => ({
  isSwitching: false,
  setSwitching: (value: boolean) => set({ isSwitching: value }),
});

export const useUiStore = create<UiState>(creator);
