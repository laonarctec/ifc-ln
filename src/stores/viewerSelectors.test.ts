import { describe, expect, it } from "vitest";
import {
  countHiddenEntitiesForModel,
  getHiddenEntityIdsForModel,
} from "./viewerSelectors";

describe("viewerSelectors", () => {
  it("counts hidden entities for a specific model or all models", () => {
    const hiddenEntityKeys = new Set(["1:10", "1:20", "2:30"]);

    expect(countHiddenEntitiesForModel(hiddenEntityKeys, 1)).toBe(2);
    expect(countHiddenEntitiesForModel(hiddenEntityKeys, 2)).toBe(1);
    expect(countHiddenEntitiesForModel(hiddenEntityKeys, null)).toBe(3);
  });

  it("returns hidden entity ids scoped to the active model", () => {
    const hiddenEntityKeys = new Set(["1:10", "1:20", "2:30"]);

    expect([...getHiddenEntityIdsForModel(hiddenEntityKeys, 1)]).toEqual([
      10,
      20,
    ]);
    expect([...getHiddenEntityIdsForModel(hiddenEntityKeys, null)]).toEqual([]);
  });
});
