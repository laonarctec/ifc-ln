import { describe, expect, it } from "vitest";
import {
  buildStatusBarDebugCards,
  buildStatusBarLeadingItems,
  resolveStatusBarEngineIndicator,
  resolveStatusBarFrameDisplay,
} from "./statusBarViewModel";

describe("statusBarViewModel", () => {
  it("builds frame and engine display states", () => {
    expect(resolveStatusBarFrameDisplay(null, false, null)).toEqual({
      text: "-",
      showUnit: false,
      lowFrameRate: false,
    });
    expect(resolveStatusBarFrameDisplay("sample.ifc", true, 24)).toEqual({
      text: "24",
      showUnit: true,
      lowFrameRate: true,
    });
    expect(resolveStatusBarEngineIndicator("initializing")).toEqual({
      label: "Init",
      dotClassName: "bg-blue-400 animate-pulse",
    });
  });

  it("builds leading items and debug cards from ui state", () => {
    const items = buildStatusBarLeadingItems({
      selectedEntityId: 42,
      selectedEntityCount: 3,
      showMeasurement: true,
      measurementValue: "1.250 m",
      hiddenEntityCount: 2,
      error: "Renderer failed",
      loading: true,
      progress: "Loading chunks",
    });

    expect(items.map((item) => item.id)).toEqual([
      "selection",
      "measurement",
      "hidden",
      "error",
      "loading",
    ]);
    expect(items[0]).toMatchObject({
      title: "Primary: #42",
      value: "3",
      active: true,
    });
    expect(items[3]).toMatchObject({
      kind: "error",
      value: "Renderer failed",
      truncate: true,
    });

    const debugCards = buildStatusBarDebugCards({
      engineState: "ready",
      engineMessage: "ok",
      loading: false,
      progress: "",
      geometryReady: true,
      geometryMeshCount: 12,
      geometryVertexCount: 3456,
      geometryIndexCount: 7890,
      selectedEntityId: 42,
      selectedEntityCount: 3,
      currentFileName: "sample.ifc",
      currentModelId: 7,
      currentModelSchema: "IFC4",
      currentModelMaxExpressId: 999,
      loadedModelCount: 2,
      residentChunkCount: 5,
      totalChunkCount: 8,
      visibleChunkCount: 4,
    });

    expect(debugCards).toHaveLength(6);
    expect(debugCards[2]).toMatchObject({
      label: "Geometry",
      value: "12 meshes",
      subValue: "3,456 verts · 7,890 idx",
    });
    expect(debugCards[5]).toMatchObject({
      label: "Chunks",
      value: "5 / 8",
      subValue: "4 visible targets",
    });
  });
});
