import { useEffect, useRef, type MutableRefObject } from "react";
import { type PanelImperativeHandle } from "react-resizable-panels";
import { useShallow } from "zustand/react/shallow";
import { useViewerShellBootstrap } from "@/hooks/useViewerShellBootstrap";
import { useViewerStore } from "@/stores";
import { selectPanelState } from "@/stores/viewerSelectors";
import type { RightPanelMode, BottomPanelMode } from "@/stores/slices/uiSlice";

export interface ViewerLayoutController {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  rightPanelMode: RightPanelMode;
  bottomPanelMode: BottomPanelMode;
  leftPanelRef: MutableRefObject<PanelImperativeHandle | null>;
  rightPanelRef: MutableRefObject<PanelImperativeHandle | null>;
  handleLeftPanelResize: () => void;
  handleRightPanelResize: () => void;
}

export function useViewerLayoutController(): ViewerLayoutController {
  const panelState = useViewerStore(useShallow(selectPanelState));
  const rightPanelMode = useViewerStore((state) => state.rightPanelMode);
  const bottomPanelMode = useViewerStore((state) => state.bottomPanelMode);
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null);
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null);

  useViewerShellBootstrap(panelState.theme);

  useEffect(() => {
    const panel = leftPanelRef.current;
    if (!panel) return;
    if (panelState.leftPanelCollapsed && !panel.isCollapsed()) {
      panel.collapse();
      return;
    }
    if (!panelState.leftPanelCollapsed && panel.isCollapsed()) {
      panel.expand();
    }
  }, [panelState.leftPanelCollapsed]);

  useEffect(() => {
    const panel = rightPanelRef.current;
    if (!panel) return;
    if (panelState.rightPanelCollapsed && !panel.isCollapsed()) {
      panel.collapse();
      return;
    }
    if (!panelState.rightPanelCollapsed && panel.isCollapsed()) {
      panel.expand();
    }
  }, [panelState.rightPanelCollapsed]);

  return {
    leftPanelCollapsed: panelState.leftPanelCollapsed,
    rightPanelCollapsed: panelState.rightPanelCollapsed,
    rightPanelMode,
    bottomPanelMode,
    leftPanelRef,
    rightPanelRef,
    handleLeftPanelResize: () => {
      const panel = leftPanelRef.current;
      if (panel) {
        panelState.setLeftPanelCollapsed(panel.isCollapsed());
      }
    },
    handleRightPanelResize: () => {
      const panel = rightPanelRef.current;
      if (panel) {
        panelState.setRightPanelCollapsed(panel.isCollapsed());
      }
    },
  };
}
