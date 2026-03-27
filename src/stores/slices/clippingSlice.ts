import type { StateCreator } from "zustand";
import {
  beginClippingInteractionState,
  buildClippingPlaneFromDraft,
  createEmptyClippingInteraction,
  createEmptyClippingState,
  getNextActivePlaneIdAfterDelete,
  isCommittedClippingDraft,
  resetClippingDraftState,
  syncClippingPlaneSelection,
  updateClippingPlaneById,
} from "./clippingStateUtils";

export type ClippingPlaneMode = "idle" | "creating";
export type ClippingInteractionKind = "move" | "rotate" | "resize";

export interface ClippingInteractionState {
  planeId: string | null;
  kind: ClippingInteractionKind | null;
  dragging: boolean;
}

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
  interaction: ClippingInteractionState;
  nextPlaneSerial: number;
}

export interface ClippingSlice {
  clipping: ClippingState;
  startCreateClippingPlane: () => void;
  updateClippingDraft: (draft: ClippingPlaneDraft | null) => void;
  commitClippingDraft: () => void;
  cancelClippingDraft: () => void;
  beginClippingInteraction: (
    planeId: string,
    kind: ClippingInteractionKind,
  ) => void;
  endClippingInteraction: () => void;
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

export const createClippingSlice: StateCreator<ClippingSlice, [], [], ClippingSlice> = (set) => ({
  clipping: createEmptyClippingState(),

  startCreateClippingPlane: () =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        mode: "creating",
        draft: null,
        interaction: createEmptyClippingInteraction(),
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
      if (!isCommittedClippingDraft(draft)) {
        return { clipping: resetClippingDraftState(state.clipping) };
      }

      const plane = buildClippingPlaneFromDraft(
        draft,
        state.clipping.nextPlaneSerial,
      );

      const planes = syncClippingPlaneSelection(
        [...state.clipping.planes, plane],
        plane.id,
      );

      return {
        clipping: {
          mode: "idle",
          planes,
          activePlaneId: plane.id,
          draft: null,
          interaction: createEmptyClippingInteraction(),
          nextPlaneSerial: state.clipping.nextPlaneSerial + 1,
        },
      };
    }),

  cancelClippingDraft: () =>
    set((state) => ({
      clipping: resetClippingDraftState(state.clipping),
    })),

  beginClippingInteraction: (planeId, kind) =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        interaction: beginClippingInteractionState(planeId, kind),
      },
    })),

  endClippingInteraction: () =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        interaction: createEmptyClippingInteraction(),
      },
    })),

  selectClippingPlane: (planeId) =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        activePlaneId: planeId,
        planes: syncClippingPlaneSelection(state.clipping.planes, planeId),
      },
    })),

  updateClippingPlaneTransform: (planeId, transform) =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        planes: updateClippingPlaneById(
          state.clipping.planes,
          planeId,
          (plane) => ({ ...plane, ...transform }),
        ),
      },
    })),

  resizeClippingPlane: (planeId, size) =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        planes: updateClippingPlaneById(state.clipping.planes, planeId, (plane) => ({
          ...plane,
          ...size,
        })),
      },
    })),

  renameClippingPlane: (planeId, name) =>
    set((state) => {
      const trimmedName = name.trim();
      return {
        clipping: {
          ...state.clipping,
          planes: updateClippingPlaneById(
            state.clipping.planes,
            planeId,
            (plane) => ({
              ...plane,
              name: trimmedName || plane.name,
            }),
          ),
        },
      };
    }),

  toggleClippingPlaneEnabled: (planeId) =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        planes: updateClippingPlaneById(state.clipping.planes, planeId, (plane) => ({
          ...plane,
          enabled: !plane.enabled,
        })),
      },
    })),

  toggleClippingPlaneLocked: (planeId) =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        planes: updateClippingPlaneById(state.clipping.planes, planeId, (plane) => ({
          ...plane,
          locked: !plane.locked,
        })),
      },
    })),

  flipClippingPlane: (planeId) =>
    set((state) => ({
      clipping: {
        ...state.clipping,
        planes: updateClippingPlaneById(state.clipping.planes, planeId, (plane) => ({
          ...plane,
          flipped: !plane.flipped,
        })),
      },
    })),

  deleteClippingPlane: (planeId) =>
    set((state) => {
      const nextPlanes = state.clipping.planes.filter((plane) => plane.id !== planeId);
      const nextActivePlaneId = getNextActivePlaneIdAfterDelete(
        nextPlanes,
        planeId,
        state.clipping.activePlaneId,
      );
      return {
        clipping: {
          ...state.clipping,
          activePlaneId: nextActivePlaneId,
          interaction:
            state.clipping.interaction.planeId === planeId
              ? createEmptyClippingInteraction()
              : state.clipping.interaction,
          planes: syncClippingPlaneSelection(nextPlanes, nextActivePlaneId),
        },
      };
    }),

  clearClippingPlanes: () => set({ clipping: createEmptyClippingState() }),
});
