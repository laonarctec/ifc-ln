import type { StateCreator } from "zustand";
import type { ModelEntityKey } from "@/utils/modelEntity";
import type { GeometryMetrics } from "@/utils/geometryMetrics";

export interface SplitLine {
  id: string;
  start: [number, number];
  end: [number, number];
}

export interface SplitRegion {
  id: string;
  polygon: [number, number][];
  color: string;
  entityKeys: ModelEntityKey[];
  metrics: GeometryMetrics | null;
}

export interface SplitBounds {
  min: [number, number];
  max: [number, number];
}

export interface QuantitySplitState {
  active: boolean;
  splitPlaneZ: number;
  bounds: SplitBounds | null;
  lines: SplitLine[];
  regions: SplitRegion[];
  drawingLine: { start: [number, number] } | null;
}

export interface QuantitySplitSlice {
  quantitySplit: QuantitySplitState;
  startQuantitySplit: (splitPlaneZ: number, bounds: SplitBounds) => void;
  addSplitLine: (start: [number, number], end: [number, number]) => void;
  removeSplitLine: (id: string) => void;
  setDrawingLineStart: (start: [number, number] | null) => void;
  updateRegions: (regions: SplitRegion[]) => void;
  clearQuantitySplit: () => void;
}

function createSplitLineId() {
  return `split-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyState(): QuantitySplitState {
  return {
    active: false,
    splitPlaneZ: 0,
    bounds: null,
    lines: [],
    regions: [],
    drawingLine: null,
  };
}

export const createQuantitySplitSlice: StateCreator<
  QuantitySplitSlice,
  [],
  [],
  QuantitySplitSlice
> = (set) => ({
  quantitySplit: createEmptyState(),

  startQuantitySplit: (splitPlaneZ, bounds) =>
    set({
      quantitySplit: {
        ...createEmptyState(),
        active: true,
        splitPlaneZ,
        bounds,
      },
    }),

  addSplitLine: (start, end) =>
    set((state) => ({
      quantitySplit: {
        ...state.quantitySplit,
        lines: [
          ...state.quantitySplit.lines,
          { id: createSplitLineId(), start, end },
        ],
        drawingLine: null,
      },
    })),

  removeSplitLine: (id) =>
    set((state) => ({
      quantitySplit: {
        ...state.quantitySplit,
        lines: state.quantitySplit.lines.filter((l) => l.id !== id),
      },
    })),

  setDrawingLineStart: (start) =>
    set((state) => ({
      quantitySplit: {
        ...state.quantitySplit,
        drawingLine: start ? { start } : null,
      },
    })),

  updateRegions: (regions) =>
    set((state) => ({
      quantitySplit: {
        ...state.quantitySplit,
        regions,
      },
    })),

  clearQuantitySplit: () => set({ quantitySplit: createEmptyState() }),
});
