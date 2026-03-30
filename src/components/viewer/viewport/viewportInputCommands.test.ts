import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  createViewportClickCommand,
  createViewportContextMenuCommand,
  createViewportHoverCommand,
} from "./viewportInputCommands";
import type { PointerPickResult, RaycastHit } from "./raycasting";

function createHit(expressId = 101): RaycastHit {
  return {
    modelId: 1,
    expressId,
    point: new THREE.Vector3(1, 2, 3),
    faceNormal: null,
    object: new THREE.Mesh(),
    instanceId: null,
  };
}

describe("viewportInputCommands", () => {
  it("creates a clipping-place command and uses fallback hits for blocked overlays", () => {
    const fallbackHit = createHit(606);
    const command = createViewportClickCommand({
      interactionMode: "create-clipping-plane",
      result: { kind: "blocked" } satisfies PointerPickResult,
      fallbackHit,
      additive: false,
    });

    expect(command).toEqual({
      kind: "clipping-place",
      hit: fallbackHit,
    });
  });

  it("clears selection on a miss when not additive", () => {
    const command = createViewportClickCommand({
      interactionMode: "select",
      result: { kind: "miss" },
      fallbackHit: null,
      additive: false,
    });

    expect(command).toEqual({ kind: "clear-selection" });
  });

  it("keeps selection on additive miss", () => {
    const command = createViewportClickCommand({
      interactionMode: "select",
      result: { kind: "miss" },
      fallbackHit: null,
      additive: true,
    });

    expect(command).toEqual({ kind: "none" });
  });

  it("creates a select command from a normal hit", () => {
    const command = createViewportClickCommand({
      interactionMode: "select",
      result: { kind: "hit", hit: createHit(303) },
      fallbackHit: null,
      additive: true,
    });

    expect(command).toEqual({
      kind: "select-entity",
      modelId: 1,
      expressId: 303,
      additive: true,
    });
  });

  it("creates a measure command only when a hit exists", () => {
    expect(
      createViewportClickCommand({
        interactionMode: "measure-distance",
        result: { kind: "hit", hit: createHit(404) },
        fallbackHit: null,
        additive: false,
      }),
    ).toEqual({
      kind: "measure-point",
      hit: expect.objectContaining({ expressId: 404 }),
    });

    expect(
      createViewportClickCommand({
        interactionMode: "measure-distance",
        result: { kind: "miss" },
        fallbackHit: null,
        additive: false,
      }),
    ).toEqual({ kind: "none" });
  });

  it("creates a clipping preview command and resolves fallback hits for blocked overlays", () => {
    const fallbackHit = createHit(909);
    const command = createViewportHoverCommand({
      interactionMode: "create-clipping-plane",
      result: { kind: "blocked" },
      fallbackHit,
    });

    expect(command).toEqual({
      kind: "clipping-preview",
      hit: fallbackHit,
    });
  });

  it("returns blocked and hover commands for non-clipping modes", () => {
    expect(
      createViewportHoverCommand({
        interactionMode: "select",
        result: { kind: "blocked" },
        fallbackHit: null,
      }),
    ).toEqual({ kind: "blocked" });

    expect(
      createViewportHoverCommand({
        interactionMode: "measure-distance",
        result: { kind: "hit", hit: createHit(505) },
        fallbackHit: null,
      }),
    ).toEqual({
      kind: "hover",
      hit: expect.objectContaining({ expressId: 505 }),
    });
  });

  it("creates a blocked or open context menu command", () => {
    expect(
      createViewportContextMenuCommand({
        result: { kind: "blocked" },
        hasSelection: false,
      }),
    ).toEqual({ kind: "blocked" });

    expect(
      createViewportContextMenuCommand({
        result: { kind: "hit", hit: createHit(808) },
        hasSelection: false,
      }),
    ).toEqual({
      kind: "open",
      modelId: 1,
      expressId: 808,
      selectBeforeOpen: true,
    });
  });

  it("does not replace selection when context menu opens with an existing selection", () => {
    expect(
      createViewportContextMenuCommand({
        result: { kind: "hit", hit: createHit(909) },
        hasSelection: true,
      }),
    ).toEqual({
      kind: "open",
      modelId: 1,
      expressId: 909,
      selectBeforeOpen: false,
    });
  });
});
