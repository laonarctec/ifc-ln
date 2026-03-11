import type { StateCreator } from 'zustand';

export type ViewportCommandType =
  | 'none'
  | 'home'
  | 'fit-selected'
  | 'view-front'
  | 'view-right'
  | 'view-top'
  | 'view-iso';

export interface ViewportCommand {
  type: ViewportCommandType;
  seq: number;
}

export interface UISlice {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  viewportCommand: ViewportCommand;
  setLeftPanelCollapsed: (collapsed: boolean) => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  runViewportCommand: (type: ViewportCommandType) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  viewportCommand: { type: 'none', seq: 0 },
  setLeftPanelCollapsed: (leftPanelCollapsed) => set({ leftPanelCollapsed }),
  setRightPanelCollapsed: (rightPanelCollapsed) => set({ rightPanelCollapsed }),
  toggleLeftPanel: () => set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),
  toggleRightPanel: () => set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),
  runViewportCommand: (type) =>
    set((state) => ({
      viewportCommand: {
        type,
        seq: state.viewportCommand.seq + 1,
      },
    })),
});
