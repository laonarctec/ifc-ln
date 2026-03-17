import type { StateCreator } from 'zustand';

export interface LoadingSlice {
  isLoading: boolean;
  progressLabel: string;
  loadingProgress: number;
  setLoading: (isLoading: boolean, progressLabel?: string) => void;
  setLoadingProgress: (progress: number, label?: string) => void;
  resetLoading: () => void;
}

export const createLoadingSlice: StateCreator<LoadingSlice, [], [], LoadingSlice> = (set) => ({
  isLoading: false,
  progressLabel: '대기 중',
  loadingProgress: 0,
  setLoading: (isLoading, progressLabel = isLoading ? '로딩 중' : '대기 중') =>
    set({ isLoading, progressLabel, loadingProgress: isLoading ? 0 : 0 }),
  setLoadingProgress: (progress, label) =>
    set((state) => ({
      loadingProgress: progress,
      ...(label ? { progressLabel: label } : {}),
    })),
  resetLoading: () => set({ isLoading: false, progressLabel: '대기 중', loadingProgress: 0 }),
});
