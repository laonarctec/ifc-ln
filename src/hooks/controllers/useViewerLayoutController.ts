import { useEffect, useRef, type MutableRefObject } from "react";
import { type PanelImperativeHandle } from "react-resizable-panels";
import { useShallow } from "zustand/react/shallow";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useThemeSync } from "@/hooks/useThemeSync";
import { useWebIfc } from "@/hooks/useWebIfc";
import { useWebIfcPropertySync } from "@/hooks/useWebIfcPropertySync";
import { useViewerStore } from "@/stores";
import { selectPanelState } from "@/stores/viewerSelectors";

export interface ViewerLayoutController {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  leftPanelRef: MutableRefObject<PanelImperativeHandle | null>;
  rightPanelRef: MutableRefObject<PanelImperativeHandle | null>;
  handleLeftPanelResize: () => void;
  handleRightPanelResize: () => void;
}

export function useViewerLayoutController(): ViewerLayoutController {
  const panelState = useViewerStore(useShallow(selectPanelState));
  const { initEngine } = useWebIfc();
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null);
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null);

  useWebIfcPropertySync();
  useKeyboardShortcuts();
  useThemeSync(panelState.theme);

  useEffect(() => {
    void initEngine();
  }, [initEngine]);

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
