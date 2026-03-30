import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useToolbarFileActions } from "./useToolbarFileActions";

const loadFileMock = vi.fn(async (_file: File) => undefined);
const resetSessionMock = vi.fn(async () => undefined);
const notificationPort = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

describe("useToolbarFileActions", () => {
  beforeEach(() => {
    loadFileMock.mockReset();
    resetSessionMock.mockReset();
    notificationPort.success.mockReset();
    notificationPort.error.mockReset();
    notificationPort.info.mockReset();
    resetSessionMock.mockResolvedValue(undefined);
    loadFileMock.mockResolvedValue(undefined);
  });

  it("clicks the file input when opening a new IFC file", () => {
    const { result } = renderHook(() =>
      useToolbarFileActions({
        loadFile: loadFileMock,
        resetSession: resetSessionMock,
        notificationPort,
      }),
    );
    const click = vi.fn();

    act(() => {
      result.current.fileInputRef.current = {
        click,
      } as unknown as HTMLInputElement;
      result.current.handleOpenFile();
    });

    expect(click).toHaveBeenCalledTimes(1);
  });

  it("resets the session before loading a replacement IFC file", async () => {
    const { result } = renderHook(() =>
      useToolbarFileActions({
        loadFile: loadFileMock,
        resetSession: resetSessionMock,
        notificationPort,
      }),
    );
    const event = {
      target: {
        files: [new File(["a"], "a.ifc")],
        value: "filled",
      },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleFileChange(event);
    });

    expect(resetSessionMock).toHaveBeenCalledTimes(1);
    expect(loadFileMock).toHaveBeenCalledTimes(1);
    expect(resetSessionMock.mock.invocationCallOrder[0]).toBeLessThan(
      loadFileMock.mock.invocationCallOrder[0],
    );
    expect(notificationPort.success).toHaveBeenCalledWith("1개 IFC 로딩 완료");
    expect(event.target.value).toBe("");
  });

  it("adds models without resetting the active session", async () => {
    const { result } = renderHook(() =>
      useToolbarFileActions({
        loadFile: loadFileMock,
        resetSession: resetSessionMock,
        notificationPort,
      }),
    );
    const event = {
      target: {
        files: [new File(["a"], "a.ifc"), new File(["b"], "b.ifc")],
        value: "filled",
      },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleAddModelChange(event);
    });

    expect(resetSessionMock).not.toHaveBeenCalled();
    expect(loadFileMock).toHaveBeenCalledTimes(2);
    expect(notificationPort.success).toHaveBeenCalledWith("2개 모델 추가 완료");
    expect(event.target.value).toBe("");
  });

  it("reports file load failures and still clears the input value", async () => {
    loadFileMock.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() =>
      useToolbarFileActions({
        loadFile: loadFileMock,
        resetSession: resetSessionMock,
        notificationPort,
      }),
    );
    const event = {
      target: {
        files: [new File(["a"], "a.ifc")],
        value: "filled",
      },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await act(async () => {
      await result.current.handleFileChange(event);
    });

    expect(notificationPort.error).toHaveBeenCalledWith("파일 로딩 실패: boom");
    expect(event.target.value).toBe("");
    consoleErrorSpy.mockRestore();
  });
});
