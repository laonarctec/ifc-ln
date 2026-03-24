import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "@/components/ui/Tooltip";
import { ToolbarButton } from "./ToolbarButton";
import { ThemeSwitch } from "./ThemeSwitch";

let themeState: "light" | "dark" = "light";
const toggleThemeMock = vi.fn();

vi.mock("@/stores", () => ({
  useViewerStore: (selector: (state: { theme: "light" | "dark"; toggleTheme: () => void }) => unknown) =>
    selector({
      theme: themeState,
      toggleTheme: toggleThemeMock,
    }),
}));

describe("ToolbarButton", () => {
  beforeEach(() => {
    themeState = "light";
    toggleThemeMock.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows and hides a tooltip on hover", async () => {
    const user = userEvent.setup();

    render(
      <ToolbarButton
        icon={<span aria-hidden="true">I</span>}
        label="열기"
        tooltip={{ title: "IFC 파일 열기", shortcut: "O" }}
        onClick={() => {}}
      />,
    );

    await user.hover(screen.getByRole("button", { name: "열기" }));
    expect((await screen.findByRole("tooltip")).textContent).toContain("IFC 파일 열기");
    expect(screen.getByRole("tooltip").textContent).toContain("O");

    await user.unhover(screen.getByRole("button", { name: "열기" }));
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("shows and closes a tooltip on focus and Escape", async () => {
    const user = userEvent.setup();

    render(
      <ToolbarButton
        icon={<span aria-hidden="true">F</span>}
        label="맞춤"
        tooltip={{ title: "선택 객체에 맞춰 보기", shortcut: "F" }}
        onClick={() => {}}
      />,
    );

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "맞춤" }));
    expect((await screen.findByRole("tooltip")).textContent).toContain("선택 객체에 맞춰 보기");

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("closes the tooltip when the trigger is activated", async () => {
    const user = userEvent.setup();

    render(
      <ToolbarButton
        icon={<span aria-hidden="true">O</span>}
        label="파일 열기"
        tooltip={{ title: "IFC 파일 열기" }}
        onClick={() => {}}
      />,
    );

    const button = screen.getByRole("button", { name: "파일 열기" });
    await user.hover(button);
    expect(await screen.findByRole("tooltip")).toBeTruthy();

    await user.click(button);
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("does not reopen after dialog-style blur and focus return until pointer leaves", async () => {
    const user = userEvent.setup();

    render(
      <ToolbarButton
        icon={<span aria-hidden="true">O</span>}
        label="파일 열기"
        tooltip={{ title: "IFC 파일 열기" }}
        onClick={() => {}}
      />,
    );

    const button = screen.getByRole("button", { name: "파일 열기" });
    const anchor = button.parentElement as HTMLElement;

    await user.hover(button);
    expect(await screen.findByRole("tooltip")).toBeTruthy();

    await user.click(button);
    fireEvent.blur(button, { relatedTarget: null });
    fireEvent.focus(button);

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    await user.unhover(anchor);
    await user.hover(button);
    expect(await screen.findByRole("tooltip")).toBeTruthy();
  });

  it("does not reopen on focus return even if a leave event fired while the dialog was open", async () => {
    const user = userEvent.setup();

    render(
      <ToolbarButton
        icon={<span aria-hidden="true">O</span>}
        label="파일 열기"
        tooltip={{ title: "IFC 파일 열기" }}
        onClick={() => {}}
      />,
    );

    const button = screen.getByRole("button", { name: "파일 열기" });
    const anchor = button.parentElement as HTMLElement;

    await user.hover(button);
    expect(await screen.findByRole("tooltip")).toBeTruthy();

    await user.click(button);
    fireEvent.mouseLeave(anchor);
    fireEvent.blur(button, { relatedTarget: null });
    fireEvent.focus(button);

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    fireEvent.mouseEnter(anchor);
    expect(await screen.findByRole("tooltip")).toBeTruthy();
  });

  it("shows a disabled reason for disabled actions", async () => {
    const user = userEvent.setup();

    render(
      <ToolbarButton
        icon={<span aria-hidden="true">X</span>}
        label="선택 객체만 보기"
        tooltip={{
          title: "선택 객체만 보기",
          shortcut: "I",
          disabledReason: "선택된 객체가 없습니다",
        }}
        disabled
        onClick={() => {}}
      />,
    );

    const button = screen.getByRole("button", { name: "선택 객체만 보기" });
    expect(button.matches(":disabled")).toBe(true);

    await user.hover(button.parentElement as HTMLElement);
    expect((await screen.findByRole("tooltip")).textContent).toContain("선택된 객체가 없습니다");
  });

  it("shows current state text for toggle actions", async () => {
    const user = userEvent.setup();

    render(
      <ToolbarButton
        icon={<span aria-hidden="true">T</span>}
        label="호버 툴팁"
        tooltip={{
          title: "호버 툴팁 끄기",
          stateText: "현재: 켜짐",
        }}
        variant="toggle"
        active
        onClick={() => {}}
      />,
    );

    await user.hover(screen.getByRole("button", { name: "호버 툴팁" }));
    expect((await screen.findByRole("tooltip")).textContent).toContain("현재: 켜짐");
  });

  it("hides tooltip content when the parent details is open", async () => {
    const user = userEvent.setup();

    render(
      <details>
        <Tooltip content={{ title: "뷰 프리셋 열기" }} asChild hideWhenDetailsOpen>
          <summary>View</summary>
        </Tooltip>
        <div>content</div>
      </details>,
    );

    const summary = screen.getByText("View");
    await user.hover(summary);
    expect((await screen.findByRole("tooltip")).textContent).toContain("뷰 프리셋 열기");

    const details = summary.closest("details");
    details?.setAttribute("open", "");

    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("can show tooltip content inside an open details menu", async () => {
    const user = userEvent.setup();

    render(
      <details open>
        <div>
          <Tooltip content={{ title: "스크린샷 저장" }} asChild>
            <span className="tooltip-anchor w-full">
              <button type="button">Screenshot</button>
            </span>
          </Tooltip>
        </div>
      </details>,
    );

    const button = screen.getByRole("button", { name: "Screenshot" });
    await user.hover(button.parentElement as HTMLElement);
    expect((await screen.findByRole("tooltip")).textContent).toContain("스크린샷 저장");
  });
});

describe("ThemeSwitch", () => {
  beforeEach(() => {
    themeState = "light";
    toggleThemeMock.mockReset();
  });

  it("uses the same tooltip-enabled toolbar primitive", async () => {
    const user = userEvent.setup();

    render(<ThemeSwitch />);

    const button = screen.getByRole("button", { name: "다크 모드로 전환" });
    expect(button).toBeTruthy();

    await user.hover(button);
    expect((await screen.findByRole("tooltip")).textContent).toContain("다크 모드로 전환");
    expect(screen.getByRole("tooltip").textContent).toContain("현재: 라이트 모드");
  });
});
