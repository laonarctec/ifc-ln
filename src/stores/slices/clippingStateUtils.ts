import type {
  ClippingInteractionKind,
  ClippingInteractionState,
  ClippingPlaneDraft,
  ClippingPlaneObject,
  ClippingState,
} from "./clippingSlice";

type CompleteClippingDraft = ClippingPlaneDraft & {
  stage: "second-point";
  origin: [number, number, number];
  normal: [number, number, number];
  uAxis: [number, number, number];
  vAxis: [number, number, number];
};

export function createEmptyClippingInteraction(): ClippingInteractionState {
  return {
    planeId: null,
    kind: null,
    dragging: false,
  };
}

export function createEmptyClippingState(): ClippingState {
  return {
    mode: "idle",
    planes: [],
    activePlaneId: null,
    draft: null,
    interaction: createEmptyClippingInteraction(),
    nextPlaneSerial: 1,
  };
}

export function syncClippingPlaneSelection(
  planes: ClippingPlaneObject[],
  activePlaneId: string | null,
): ClippingPlaneObject[] {
  return planes.map((plane) => ({
    ...plane,
    selected: plane.id === activePlaneId,
  }));
}

export function getActiveClippingPlane(
  clipping: Pick<ClippingState, "planes" | "activePlaneId">,
) {
  if (clipping.activePlaneId === null) {
    return null;
  }

  return (
    clipping.planes.find((plane) => plane.id === clipping.activePlaneId) ?? null
  );
}

export function isCommittedClippingDraft(
  draft: ClippingPlaneDraft | null,
): draft is CompleteClippingDraft {
  return Boolean(
    draft &&
      draft.stage === "second-point" &&
      draft.origin &&
      draft.normal &&
      draft.uAxis &&
      draft.vAxis,
  );
}

export function resetClippingDraftState(clipping: ClippingState): ClippingState {
  return {
    ...clipping,
    mode: "idle",
    draft: null,
    interaction: createEmptyClippingInteraction(),
  };
}

export function beginClippingInteractionState(
  planeId: string,
  kind: ClippingInteractionKind,
): ClippingInteractionState {
  return {
    planeId,
    kind,
    dragging: true,
  };
}

export function buildClippingPlaneFromDraft(
  draft: CompleteClippingDraft,
  nextPlaneSerial: number,
): ClippingPlaneObject {
  const planeId = `clipping-plane-${nextPlaneSerial}`;
  return {
    id: planeId,
    name: `Section ${String(nextPlaneSerial).padStart(2, "0")}`,
    enabled: true,
    locked: false,
    selected: true,
    origin: draft.origin,
    normal: draft.normal,
    uAxis: draft.uAxis,
    vAxis: draft.vAxis,
    width: draft.width,
    height: draft.height,
    flipped: false,
    labelVisible: true,
  };
}

export function updateClippingPlaneById(
  planes: ClippingPlaneObject[],
  planeId: string,
  updater: (plane: ClippingPlaneObject) => ClippingPlaneObject,
) {
  return planes.map((plane) => (plane.id === planeId ? updater(plane) : plane));
}

export function getNextActivePlaneIdAfterDelete(
  planes: ClippingPlaneObject[],
  deletedPlaneId: string,
  activePlaneId: string | null,
) {
  if (planes.length === 0) return null;
  if (activePlaneId !== deletedPlaneId) return activePlaneId;
  return planes[planes.length - 1]?.id ?? null;
}
