import { useCallback } from "react";

interface ToolbarClippingActionsContext {
  hasLoadedModel: boolean;
  rightPanelCollapsed: boolean;
  toggleRightPanel: () => void;
  setRightPanelTab: (tab: "properties" | "quantities" | "editor") => void;
  startCreateClippingPlane: () => void;
  selectedClippingPlaneId: string | null;
  flipClippingPlane: (id: string) => void;
  deleteClippingPlane: (id: string) => void;
  clearClippingPlanes: () => void;
}

export interface ToolbarClippingActions {
  handleStartCreateClippingPlane: () => void;
  handleFlipSelectedClippingPlane: () => void;
  handleDeleteSelectedClippingPlane: () => void;
  handleClearClippingPlanes: () => void;
}

export function useToolbarClippingActions(
  ctx: ToolbarClippingActionsContext,
): ToolbarClippingActions {
  const {
    hasLoadedModel,
    rightPanelCollapsed,
    toggleRightPanel,
    setRightPanelTab,
    startCreateClippingPlane,
    selectedClippingPlaneId,
    flipClippingPlane,
    deleteClippingPlane,
    clearClippingPlanes,
  } = ctx;

  const handleStartCreateClippingPlane = useCallback(() => {
    if (!hasLoadedModel) {
      return;
    }
    if (rightPanelCollapsed) {
      toggleRightPanel();
    }
    setRightPanelTab("editor");
    startCreateClippingPlane();
  }, [
    hasLoadedModel,
    rightPanelCollapsed,
    setRightPanelTab,
    startCreateClippingPlane,
    toggleRightPanel,
  ]);

  const handleFlipSelectedClippingPlane = useCallback(() => {
    if (!selectedClippingPlaneId) {
      return;
    }
    flipClippingPlane(selectedClippingPlaneId);
  }, [flipClippingPlane, selectedClippingPlaneId]);

  const handleDeleteSelectedClippingPlane = useCallback(() => {
    if (!selectedClippingPlaneId) {
      return;
    }
    deleteClippingPlane(selectedClippingPlaneId);
  }, [deleteClippingPlane, selectedClippingPlaneId]);

  const handleClearClippingPlanes = useCallback(() => {
    clearClippingPlanes();
  }, [clearClippingPlanes]);

  return {
    handleStartCreateClippingPlane,
    handleFlipSelectedClippingPlane,
    handleDeleteSelectedClippingPlane,
    handleClearClippingPlanes,
  };
}
