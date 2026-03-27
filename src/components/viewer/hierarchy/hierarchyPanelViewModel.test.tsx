import { describe, expect, it } from "vitest";
import {
  getHierarchyEmptyState,
  getHierarchyFooterSummary,
  getHierarchySearchPlaceholder,
} from "./hierarchyPanelViewModel";

describe("hierarchyPanelViewModel", () => {
  it("resolves grouping-specific search placeholders", () => {
    expect(getHierarchySearchPlaceholder("spatial")).toBe("Search hierarchy...");
    expect(getHierarchySearchPlaceholder("class")).toBe(
      "Search classes or entities...",
    );
    expect(getHierarchySearchPlaceholder("type")).toBe(
      "Search type groups or entities...",
    );
  });

  it("resolves footer summary and empty state copy per grouping mode", () => {
    expect(getHierarchyFooterSummary("spatial", true)).toBe(
      "Spatial tree synced",
    );
    expect(getHierarchyFooterSummary("spatial", false)).toBe(
      "Spatial tree idle",
    );
    expect(getHierarchyFooterSummary("class", true)).toBe("By IFC class");
    expect(getHierarchyEmptyState("class").description).toBe(
      "표시할 클래스가 없습니다.",
    );
    expect(getHierarchyEmptyState("type").description).toBe(
      "표시할 타입 그룹이 없습니다.",
    );
  });
});
