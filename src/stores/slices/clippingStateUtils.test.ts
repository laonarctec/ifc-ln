import { describe, expect, it } from "vitest";
import {
  buildClippingPlaneFromDraft,
  createEmptyClippingState,
  getActiveClippingPlane,
  resetClippingDraftState,
  syncClippingPlaneSelection,
} from "./clippingStateUtils";

describe("clippingStateUtils", () => {
  it("creates fresh empty clipping state instances", () => {
    const first = createEmptyClippingState();
    const second = createEmptyClippingState();

    expect(first).not.toBe(second);
    expect(first.interaction).not.toBe(second.interaction);
    expect(first.planes).not.toBe(second.planes);
  });

  it("builds an active clipping plane from a committed draft", () => {
    const plane = buildClippingPlaneFromDraft(
      {
        stage: "second-point",
        anchor: [0, 0, 0],
        origin: [1, 2, 3],
        normal: [0, 0, 1],
        uAxis: [1, 0, 0],
        vAxis: [0, 1, 0],
        width: 4,
        height: 5,
      },
      3,
    );

    expect(plane).toMatchObject({
      id: "clipping-plane-3",
      name: "Section 03",
      selected: true,
      labelVisible: true,
      width: 4,
      height: 5,
    });
  });

  it("resets transient draft state while preserving persistent planes", () => {
    const nextState = resetClippingDraftState({
      mode: "creating",
      planes: syncClippingPlaneSelection(
        [
          {
            id: "clipping-plane-1",
            name: "Section 01",
            enabled: true,
            locked: false,
            selected: true,
            origin: [0, 0, 0],
            normal: [0, 0, 1],
            uAxis: [1, 0, 0],
            vAxis: [0, 1, 0],
            width: 2,
            height: 2,
            flipped: false,
            labelVisible: true,
          },
        ],
        "clipping-plane-1",
      ),
      activePlaneId: "clipping-plane-1",
      draft: {
        stage: "first-point",
        anchor: [0, 0, 0],
        origin: [0, 0, 0],
        normal: [0, 0, 1],
        uAxis: [1, 0, 0],
        vAxis: [0, 1, 0],
        width: 0,
        height: 0,
      },
      interaction: {
        planeId: "clipping-plane-1",
        kind: "move",
        dragging: true,
      },
      nextPlaneSerial: 2,
    });

    expect(nextState.mode).toBe("idle");
    expect(nextState.draft).toBeNull();
    expect(nextState.interaction.dragging).toBe(false);
    expect(getActiveClippingPlane(nextState)?.id).toBe("clipping-plane-1");
    expect(nextState.nextPlaneSerial).toBe(2);
  });
});
