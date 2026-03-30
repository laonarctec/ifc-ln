import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useViewerShellBootstrap } from "./useViewerShellBootstrap";

const initEngineMock = vi.fn().mockResolvedValue(undefined);
const useWebIfcPropertySyncMock = vi.fn();
const useKeyboardShortcutsMock = vi.fn();
const useThemeSyncMock = vi.fn();

vi.mock("@/hooks/useWebIfc", () => ({
  useWebIfc: () => ({ initEngine: initEngineMock }),
}));

vi.mock("@/hooks/useWebIfcPropertySync", () => ({
  useWebIfcPropertySync: () => useWebIfcPropertySyncMock(),
}));

vi.mock("@/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: () => useKeyboardShortcutsMock(),
}));

vi.mock("@/hooks/useThemeSync", () => ({
  useThemeSync: (theme: "light" | "dark") => useThemeSyncMock(theme),
}));

function TestHarness({ theme }: { theme: "light" | "dark" }) {
  useViewerShellBootstrap(theme);
  return null;
}

describe("useViewerShellBootstrap", () => {
  it("runs shell bootstrap hooks and initializes the engine", async () => {
    render(<TestHarness theme="dark" />);

    expect(useWebIfcPropertySyncMock).toHaveBeenCalledTimes(1);
    expect(useKeyboardShortcutsMock).toHaveBeenCalledTimes(1);
    expect(useThemeSyncMock).toHaveBeenCalledWith("dark");

    await waitFor(() => {
      expect(initEngineMock).toHaveBeenCalledTimes(1);
    });
  });
});
