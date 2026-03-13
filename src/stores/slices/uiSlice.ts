import type { StateCreator } from 'zustand';

export type ViewportCommandType =
  | 'none'
  | 'home'
  | 'fit-selected'
  | 'view-front'
  | 'view-right'
  | 'view-top'
  | 'view-iso';

export type ViewportProjectionMode = 'perspective' | 'orthographic';

export type Theme = 'light' | 'dark';

export interface ViewportCommand {
  type: ViewportCommandType;
  seq: number;
}

export interface UISlice {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  viewportProjectionMode: ViewportProjectionMode;
  viewportCommand: ViewportCommand;
  theme: Theme;
  setLeftPanelCollapsed: (collapsed: boolean) => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setViewportProjectionMode: (mode: ViewportProjectionMode) => void;
  toggleViewportProjectionMode: () => void;
  runViewportCommand: (type: ViewportCommandType) => void;
  toggleTheme: () => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  viewportProjectionMode: 'perspective',
  viewportCommand: { type: 'none', seq: 0 },
  theme: 'light',
  setLeftPanelCollapsed: (leftPanelCollapsed) => set({ leftPanelCollapsed }),
  setRightPanelCollapsed: (rightPanelCollapsed) => set({ rightPanelCollapsed }),
  toggleLeftPanel: () => set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),
  toggleRightPanel: () => set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),
  setViewportProjectionMode: (viewportProjectionMode) => set({ viewportProjectionMode }),
  toggleViewportProjectionMode: () =>
    set((state) => ({
      viewportProjectionMode:
        state.viewportProjectionMode === 'perspective' ? 'orthographic' : 'perspective',
    })),
  runViewportCommand: (type) =>
    set((state) => ({
      viewportCommand: {
        type,
        seq: state.viewportCommand.seq + 1,
      },
    })),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      return { theme: next };
    }),
});
