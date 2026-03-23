import { describe, it, expect } from "vitest";
import { formatScaleLabel } from "./overlayMath";

describe("formatScaleLabel", () => {
  it("formats kilometers", () => {
    expect(formatScaleLabel(1500)).toBe("1.5km");
    expect(formatScaleLabel(1000)).toBe("1.0km");
  });

  it("formats meters", () => {
    expect(formatScaleLabel(12.3)).toBe("12.3m");
    expect(formatScaleLabel(1)).toBe("1.0m");
  });

  it("formats centimeters", () => {
    expect(formatScaleLabel(0.5)).toBe("50cm");
    expect(formatScaleLabel(0.1)).toBe("10cm");
  });

  it("formats millimeters", () => {
    expect(formatScaleLabel(0.05)).toBe("50mm");
    expect(formatScaleLabel(0.001)).toBe("1mm");
  });
});
