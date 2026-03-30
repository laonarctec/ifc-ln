import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useToolbarClippingActions } from "./useToolbarClippingActions";

describe("useToolbarClippingActions", () => {
  it("opens the editor panel before starting clipping when the panel is collapsed", () => {
    const toggleRightPanel = vi.fn();
    const setRightPanelTab = vi.fn();
    const startCreateClippingPlane = vi.fn();
    const { result } = renderHook(() =>
      useToolbarClippingActions({
        hasLoadedModel: true,
        rightPanelCollapsed: true,
        toggleRightPanel,
        setRightPanelTab,
        startCreateClippingPlane,
        selectedClippingPlaneId: null,
        flipClippingPlane: vi.fn(),
        deleteClippingPlane: vi.fn(),
        clearClippingPlanes: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleStartCreateClippingPlane();
    });

    expect(toggleRightPanel).toHaveBeenCalledTimes(1);
    expect(setRightPanelTab).toHaveBeenCalledWith("editor");
    expect(startCreateClippingPlane).toHaveBeenCalledTimes(1);
  });

  it("does not start clipping creation when no model is loaded", () => {
    const toggleRightPanel = vi.fn();
    const setRightPanelTab = vi.fn();
    const startCreateClippingPlane = vi.fn();
    const { result } = renderHook(() =>
      useToolbarClippingActions({
        hasLoadedModel: false,
        rightPanelCollapsed: true,
        toggleRightPanel,
        setRightPanelTab,
        startCreateClippingPlane,
        selectedClippingPlaneId: null,
        flipClippingPlane: vi.fn(),
        deleteClippingPlane: vi.fn(),
        clearClippingPlanes: vi.fn(),
      }),
    );

    act(() => {
      result.current.handleStartCreateClippingPlane();
    });

    expect(toggleRightPanel).not.toHaveBeenCalled();
    expect(setRightPanelTab).not.toHaveBeenCalled();
    expect(startCreateClippingPlane).not.toHaveBeenCalled();
  });

  it("operates on the selected clipping plane only when one is active", () => {
    const flipClippingPlane = vi.fn();
    const deleteClippingPlane = vi.fn();
    const clearClippingPlanes = vi.fn();
    const { result } = renderHook(() =>
      useToolbarClippingActions({
        hasLoadedModel: true,
        rightPanelCollapsed: false,
        toggleRightPanel: vi.fn(),
        setRightPanelTab: vi.fn(),
        startCreateClippingPlane: vi.fn(),
        selectedClippingPlaneId: "plane-1",
        flipClippingPlane,
        deleteClippingPlane,
        clearClippingPlanes,
      }),
    );

    act(() => {
      result.current.handleFlipSelectedClippingPlane();
      result.current.handleDeleteSelectedClippingPlane();
      result.current.handleClearClippingPlanes();
    });

    expect(flipClippingPlane).toHaveBeenCalledWith("plane-1");
    expect(deleteClippingPlane).toHaveBeenCalledWith("plane-1");
    expect(clearClippingPlanes).toHaveBeenCalledTimes(1);
  });
});
