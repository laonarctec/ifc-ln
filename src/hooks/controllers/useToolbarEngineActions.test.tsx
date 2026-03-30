import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useToolbarEngineActions } from "./useToolbarEngineActions";

describe("useToolbarEngineActions", () => {
  it("initializes the engine with the requested thread mode", async () => {
    const initEngine = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useToolbarEngineActions({
        initEngine,
      }),
    );

    await act(async () => {
      await result.current.handleInitEngine();
    });
    act(() => {
      result.current.handleInitEngineST();
      result.current.handleInitEngineMT();
    });

    expect(initEngine).toHaveBeenNthCalledWith(1);
    expect(initEngine).toHaveBeenNthCalledWith(2, "single");
    expect(initEngine).toHaveBeenNthCalledWith(3, "multi");
  });
});
