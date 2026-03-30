import type { StateCreator } from "zustand";

export type InteractionMode = "select" | "measure-distance" | "create-clipping-plane" | "quantity-split";
export type MeasurementMode = "idle" | "placing-first" | "placing-second" | "complete";

export interface MeasurementPoint {
  expressId: number | null;
  point: [number, number, number];
}

export interface MeasurementState {
  mode: MeasurementMode;
  start: MeasurementPoint | null;
  end: MeasurementPoint | null;
  distance: number | null;
}

export interface ToolsSlice {
  interactionMode: InteractionMode;
  measurement: MeasurementState;
  setInteractionMode: (mode: InteractionMode) => void;
  toggleMeasurementMode: () => void;
  clearMeasurement: () => void;
  placeMeasurementPoint: (point: MeasurementPoint) => void;
  resetTools: () => void;
}

const EMPTY_MEASUREMENT: MeasurementState = {
  mode: "idle",
  start: null,
  end: null,
  distance: null,
};

function createMeasurementForMode(mode: InteractionMode, current: MeasurementState): MeasurementState {
  if (mode !== "measure-distance") {
    return current.start === null && current.end === null ? EMPTY_MEASUREMENT : {
      ...current,
      mode: current.end ? "complete" : current.start ? "placing-second" : "idle",
    };
  }

  if (current.end) return { ...current, mode: "complete" };
  if (current.start) return { ...current, mode: "placing-second" };
  return { ...EMPTY_MEASUREMENT, mode: "placing-first" };
}

export const createToolsSlice: StateCreator<ToolsSlice, [], [], ToolsSlice> = (set) => ({
  interactionMode: "select",
  measurement: EMPTY_MEASUREMENT,
  setInteractionMode: (interactionMode) =>
    set((state) => ({
      interactionMode,
      measurement: createMeasurementForMode(interactionMode, state.measurement),
    })),
  toggleMeasurementMode: () =>
    set((state) => {
      const nextMode: InteractionMode =
        state.interactionMode === "measure-distance" ? "select" : "measure-distance";
      return {
        interactionMode: nextMode,
        measurement: createMeasurementForMode(nextMode, state.measurement),
      };
    }),
  clearMeasurement: () =>
    set((state) => ({
      measurement:
        state.interactionMode === "measure-distance"
          ? { ...EMPTY_MEASUREMENT, mode: "placing-first" }
          : EMPTY_MEASUREMENT,
    })),
  placeMeasurementPoint: (point) =>
    set((state) => {
      if (state.interactionMode !== "measure-distance" || state.measurement.start === null) {
        return {
          measurement: {
            mode: "placing-second",
            start: point,
            end: null,
            distance: null,
          },
        };
      }

      if (state.measurement.end !== null || state.measurement.mode === "complete") {
        return {
          measurement: {
            mode: "placing-second",
            start: point,
            end: null,
            distance: null,
          },
        };
      }

      const [startX, startY, startZ] = state.measurement.start.point;
      const [endX, endY, endZ] = point.point;
      const distance = Math.hypot(endX - startX, endY - startY, endZ - startZ);

      return {
        measurement: {
          mode: "complete",
          start: state.measurement.start,
          end: point,
          distance,
        },
      };
    }),
  resetTools: () => ({
    interactionMode: "select",
    measurement: EMPTY_MEASUREMENT,
  }),
});
