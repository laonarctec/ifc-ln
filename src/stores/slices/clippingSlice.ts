import type { StateCreator } from "zustand";

export type ClippingPlaneMode = "idle" | "creating";

export interface ClippingPlaneObject {
  id: string;
  name: string;
  enabled: boolean;
  locked: boolean;
  selected: boolean;
  origin: [number, number, number];
  normal: [number, number, number];
  uAxis: [number, number, number];
  vAxis: [number, number, number];
  width: number;
  height: number;
  flipped: boolean;
  labelVisible: boolean;
}

export interface ClippingPlaneDraft {
  stage: "first-point" | "second-point";
  anchor: [number, number, number] | null;
  origin: [number, number, number] | null;
  normal: [number, number, number] | null;
  uAxis: [number, number, number] | null;
  vAxis: [number, number, number] | null;
  width: number;
  height: number;
}

export interface ClippingState {
  mode: ClippingPlaneMode;
  planes: ClippingPlaneObject[];
  activePlaneId: string | null;
  draft: ClippingPlaneDraft | null;
  nextPlaneSerial: number;
}

export interface ClippingSlice {
  clipping: ClippingState;
  startCreateClippingPlane: () => void;
  updateClippingDraft: (draft: ClippingPlaneDraft | null) => void;
  commitClippingDraft: () => void;
  cancelClippingDraft: () => void;
  selectClippingPlane: (planeId: string | null) => void;
  updateClippingPlaneTransform: (
    planeId: string,
    transform: Pick<ClippingPlaneObject, "origin" | "normal" | "uAxis" | "vAxis">,
  ) => void;
  resizeClippingPlane: (
    planeId: string,
    size: Pick<ClippingPlaneObject, "width" | "height">,
  ) => void;
  renameClippingPlane: (planeId: string, name: string) => void;
  toggleClippingPlaneEnabled: (planeId: string) => void;
  toggleClippingPlaneLocked: (planeId: string) => void;
  flipClippingPlane: (planeId: string) => void;
  deleteClippingPlane: (planeId: string) => void;
  clearClippingPlanes: () => void;
}

const EMPTY_CLIPPING: ClippingState = {
  mode: "idle",
  planes: [],
  activePlaneId: null,
  draft: null,
  nextPlaneSerial: 1,
};

function syncSelection(
  planes: ClippingPlaneObject[],
  activePlaneId: string | null,
): ClippingPlaneObject[] {
  return planes.map((plane) => ({
    ...plane,
    selected: plane.id === activePlaneId,
  }));
}

function nextSelectionAfterDelete(
  planes: ClippingPlaneObject[],
  deletedPlaneId: string,
  activePlaneId: string | null,
) {
  if (planes.length === 0) return null;
  if (activePlaneId !== deletedPlaneId) return activePlaneId;
  return planes[planes.length - 1]?.id ?? null;
}

export const createClippingSlice: StateCreator<ClippingSlice, [], [], ClippingSlice> = (set) => ({
  clipping: EMPTY_CLIPPING,

  startCreateClippingPlane: () =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        mode: "creating",
        draft: null,
      },
    })),

  updateClippingDraft: (draft) =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        draft,
      },
    })),

  commitClippingDraft: () =>
    set((state) => {
      const draft = state.clipping.draft;
      if (
        !draft ||
        draft.stage !== "second-point" ||
        !draft.origin ||
        !draft.normal ||
        !draft.uAxis ||
        !draft.vAxis
      ) {
        return {
          clipping: {
            ...state.clipping,
            mode: "idle",
            draft: null,
          },
        };
      }

      const planeId = `clipping-plane-${state.clipping.nextPlaneSerial}`;
      const plane: ClippingPlaneObject = {
        id: planeId,
        name: `Section ${String(state.clipping.nextPlaneSerial).padStart(2, "0")}`,
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

      const planes = syncSelection(
        [...state.clipping.planes, plane],
        plane.id,
      );

      return {
        clipping: {
          mode: "idle",
          planes,
          activePlaneId: plane.id,
          draft: null,
          nextPlaneSerial: state.clipping.nextPlaneSerial + 1,
        },
      };
    }),

  cancelClippingDraft: () =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        mode: "idle",
        draft: null,
      },
    })),

  selectClippingPlane: (planeId) =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        activePlaneId: planeId,
        planes: syncSelection(state.clipping.planes, planeId),
      },
    })),

  updateClippingPlaneTransform: (planeId, transform) =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        planes: state.clipping.planes.map((plane) =>
          plane.id === planeId
            ? { ...plane, ...transform }
            : plane,
        ),
      },
    })),

  resizeClippingPlane: (planeId, size) =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        planes: state.clipping.planes.map((plane) =>
          plane.id === planeId
            ? { ...plane, ...size }
            : plane,
        ),
      },
    })),

  renameClippingPlane: (planeId, name) =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        planes: state.clipping.planes.map((plane) =>
          plane.id === planeId
            ? { ...plane, name: name.trim() || plane.name }
            : plane,
        ),
      },
    })),

  toggleClippingPlaneEnabled: (planeId) =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        planes: state.clipping.planes.map((plane) =>
          plane.id === planeId
            ? { ...plane, enabled: !plane.enabled }
            : plane,
        ),
      },
    })),

  toggleClippingPlaneLocked: (planeId) =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        planes: state.clipping.planes.map((plane) =>
          plane.id === planeId
            ? { ...plane, locked: !plane.locked }
            : plane,
        ),
      },
    })),

  flipClippingPlane: (planeId) =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        planes: state.clipping.planes.map((plane) =>
          plane.id === planeId
            ? { ...plane, flipped: !plane.flipped }
            : plane,
        ),
      },
    })),

  deleteClippingPlane: (planeId) =>
    set((state) => {
      const nextPlanes = state.clipping.planes.filter((plane) => plane.id !== planeId);
      const nextActivePlaneId = nextSelectionAfterDelete(
        nextPlanes,
        planeId,
        state.clipping.activePlaneId,
      );
      return {
        clipping: {
          ...state.clipping,
          activePlaneId: nextActivePlaneId,
          planes: syncSelection(nextPlanes, nextActivePlaneId),
        },
      };
    }),

  clearClippingPlanes: () => set({ clipping: EMPTY_CLIPPING }),
});
