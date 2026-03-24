import { createRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxisHelper, type AxisHelperRef } from "./AxisHelper";

describe("AxisHelper", () => {
  let restoreSpies: Array<() => void> = [];

  beforeEach(() => {
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    restoreSpies = [
      () => requestAnimationFrameSpy.mockRestore(),
      () => cancelAnimationFrameSpy.mockRestore(),
    ];
  });

  afterEach(() => {
    restoreSpies.forEach((restore) => restore());
    restoreSpies = [];
    cleanup();
  });

  it("applies centered label transforms on initial render", () => {
    const { container } = render(<AxisHelper />);

    const labels = container.querySelectorAll<HTMLDivElement>(".axis-label");
    const xLabel = labels[0];
    const zLabel = labels[1];
    const yLabel = labels[2];

    expect(xLabel?.textContent).toBe("X");
    expect(zLabel?.textContent).toBe("Z");
    expect(yLabel?.textContent).toBe("Y");

    expect(xLabel?.style.left).toBe("53px");
    expect(xLabel?.style.top).toBe("25px");
    expect(xLabel?.style.transform).toContain("translate(-50%, -50%)");
    expect(xLabel?.style.transform).not.toContain("translateZ");

    expect(zLabel?.style.left).toBe("25px");
    expect(zLabel?.style.top).toBe("2px");
    expect(zLabel?.style.transform).toContain("translate(-50%, -50%)");
    expect(zLabel?.style.transform).not.toContain("translateZ");

    expect(yLabel?.style.left).toBe("25px");
    expect(yLabel?.style.top).toBe("25px");
    expect(yLabel?.style.transform).toContain("translate(-50%, -50%)");
    expect(yLabel?.style.transform).toContain("translateZ(28px)");
  });

  it("updates inverse rotation for all labels", () => {
    const ref = createRef<AxisHelperRef>();
    const { container } = render(<AxisHelper ref={ref} />);

    act(() => {
      ref.current?.updateRotation(10, 20);
    });

    const labels = container.querySelectorAll<HTMLDivElement>(".axis-label");
    const xLabel = labels[0];
    const zLabel = labels[1];
    const yLabel = labels[2];

    expect(xLabel?.style.transform).toContain("rotateY(-20deg) rotateX(-10deg)");
    expect(zLabel?.style.transform).toContain("rotateY(-20deg) rotateX(-10deg)");
    expect(yLabel?.style.transform).toContain("rotateY(-20deg) rotateX(-10deg)");
    expect(yLabel?.style.transform).toContain("translateZ(28px)");
  });
});
