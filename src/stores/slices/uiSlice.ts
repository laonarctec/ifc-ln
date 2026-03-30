import type { StateCreator } from 'zustand';

export type ViewportCommandType =
  | 'none'
  | 'home'
  | 'fit-selected'
  | 'fit-all'
  | 'view-front'
  | 'view-back'
  | 'view-right'
  | 'view-left'
  | 'view-top'
  | 'view-bottom'
  | 'view-iso';

export type ViewportProjectionMode = 'perspective' | 'orthographic';

export type Theme = 'light' | 'dark';
export type LeftPanelTab = 'hierarchy' | 'editor';
export type RightPanelTab = 'properties' | 'quantities' | 'bsdd' | 'editor';
export type RightPanelMode = 'properties' | 'bcf' | 'ids' | 'lens';
export type BottomPanelMode = 'none' | 'list' | 'script';

export interface ViewportCommand {
  type: ViewportCommandType;
  seq: number;
}

export interface UISlice {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  leftPanelTab: LeftPanelTab;
  rightPanelTab: RightPanelTab;
  rightPanelMode: RightPanelMode;
  bottomPanelMode: BottomPanelMode;
  viewportProjectionMode: ViewportProjectionMode;
  viewportCommand: ViewportCommand;
  theme: Theme;
  hoverTooltipsEnabled: boolean;
  edgesVisible: boolean;
  autoStoreyTracking: boolean;
  setLeftPanelCollapsed: (collapsed: boolean) => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  setLeftPanelTab: (tab: LeftPanelTab) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setRightPanelMode: (mode: RightPanelMode) => void;
  toggleRightPanelMode: (mode: RightPanelMode) => void;
  setBottomPanelMode: (mode: BottomPanelMode) => void;
  toggleBottomPanelMode: (mode: BottomPanelMode) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setViewportProjectionMode: (mode: ViewportProjectionMode) => void;
  toggleViewportProjectionMode: () => void;
  runViewportCommand: (type: ViewportCommandType) => void;
  toggleTheme: () => void;
  toggleHoverTooltips: () => void;
  toggleEdgesVisible: () => void;
  toggleAutoStoreyTracking: () => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  leftPanelTab: 'hierarchy',
  rightPanelTab: 'properties',
  rightPanelMode: 'properties',
  bottomPanelMode: 'none',
  viewportProjectionMode: 'perspective',
  viewportCommand: { type: 'none', seq: 0 },
  theme: 'light',
  hoverTooltipsEnabled: true,
  edgesVisible: true,
  autoStoreyTracking: false,
  setLeftPanelCollapsed: (leftPanelCollapsed) => set({ leftPanelCollapsed }),
  setRightPanelCollapsed: (rightPanelCollapsed) => set({ rightPanelCollapsed }),
  setLeftPanelTab: (leftPanelTab) => set({ leftPanelTab }),
  setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
  setRightPanelMode: (rightPanelMode) => set({ rightPanelMode, rightPanelCollapsed: false }),
  toggleRightPanelMode: (mode) =>
    set((state) => ({
      rightPanelMode: state.rightPanelMode === mode ? 'properties' : mode,
      rightPanelCollapsed: false,
    })),
  setBottomPanelMode: (bottomPanelMode) => set({ bottomPanelMode }),
  toggleBottomPanelMode: (mode) =>
    set((state) => ({
      bottomPanelMode: state.bottomPanelMode === mode ? 'none' : mode,
    })),
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
    set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    })),
  toggleHoverTooltips: () =>
    set((state) => ({ hoverTooltipsEnabled: !state.hoverTooltipsEnabled })),
  toggleEdgesVisible: () =>
    set((state) => ({ edgesVisible: !state.edgesVisible })),
  toggleAutoStoreyTracking: () =>
    set((state) => ({ autoStoreyTracking: !state.autoStoreyTracking })),
});
