export type StatusBarEngineState = "idle" | "initializing" | "ready" | "error";
export type StatusBarLeadingItemKind =
  | "selection"
  | "measurement"
  | "hidden"
  | "error"
  | "loading";
export type StatusBarLeadingItemTone =
  | "default"
  | "info"
  | "warning"
  | "error";

export interface StatusBarLeadingItem {
  id: string;
  kind: StatusBarLeadingItemKind;
  tone: StatusBarLeadingItemTone;
  title: string;
  value: string;
  active?: boolean;
  compact?: boolean;
  truncate?: boolean;
}

export interface StatusBarDebugCard {
  id: string;
  label: string;
  value: string;
  subValue: string;
}

interface BuildLeadingItemsOptions {
  selectedEntityId: number | null;
  selectedEntityCount: number;
  showMeasurement: boolean;
  measurementValue: string;
  hiddenEntityCount: number;
  error: string | null;
  loading: boolean;
  progress: string;
}

interface BuildDebugCardsOptions {
  engineState: StatusBarEngineState;
  engineMessage: string;
  loading: boolean;
  progress: string;
  geometryReady: boolean;
  geometryMeshCount: number;
  geometryVertexCount: number;
  geometryIndexCount: number;
  selectedEntityId: number | null;
  selectedEntityCount: number;
  currentFileName: string | null;
  currentModelId: number | null;
  currentModelSchema: string | null;
  currentModelMaxExpressId: number | null;
  loadedModelCount: number;
  residentChunkCount: number;
  totalChunkCount: number;
  visibleChunkCount: number;
}

export function resolveStatusBarFrameDisplay(
  currentFileName: string | null,
  geometryReady: boolean,
  frameRate: number | null,
) {
  const text =
    currentFileName === null
      ? "-"
      : !geometryReady
        ? "Prep"
        : frameRate === null
          ? "..."
          : `${frameRate}`;

  return {
    text,
    showUnit: frameRate !== null,
    lowFrameRate: frameRate !== null && frameRate < 30,
  };
}

export function resolveStatusBarEngineIndicator(
  engineState: StatusBarEngineState,
) {
  switch (engineState) {
    case "ready":
      return { label: "Ready", dotClassName: "bg-emerald-500" };
    case "initializing":
      return { label: "Init", dotClassName: "bg-blue-400 animate-pulse" };
    case "error":
      return { label: "Error", dotClassName: "bg-red-500" };
    case "idle":
      return { label: "Idle", dotClassName: "bg-slate-400" };
  }
}

export function buildStatusBarLeadingItems({
  selectedEntityId,
  selectedEntityCount,
  showMeasurement,
  measurementValue,
  hiddenEntityCount,
  error,
  loading,
  progress,
}: BuildLeadingItemsOptions): StatusBarLeadingItem[] {
  const items: StatusBarLeadingItem[] = [
    {
      id: "selection",
      kind: "selection",
      tone: "default",
      title:
        selectedEntityId !== null
          ? `Primary: #${selectedEntityId}`
          : "No selection",
      value: selectedEntityCount > 0 ? `${selectedEntityCount}` : "-",
      active: selectedEntityCount > 0,
    },
  ];

  if (showMeasurement) {
    items.push({
      id: "measurement",
      kind: "measurement",
      tone: "info",
      title: "Measurement",
      value: measurementValue,
    });
  }

  if (hiddenEntityCount > 0) {
    items.push({
      id: "hidden",
      kind: "hidden",
      tone: "warning",
      title: `${hiddenEntityCount} entities hidden`,
      value: `${hiddenEntityCount}`,
    });
  }

  if (error) {
    items.push({
      id: "error",
      kind: "error",
      tone: "error",
      title: error,
      value: error,
      truncate: true,
    });
  }

  if (loading) {
    items.push({
      id: "loading",
      kind: "loading",
      tone: "info",
      title: progress,
      value: progress,
      truncate: true,
      compact: true,
    });
  }

  return items;
}

export function buildStatusBarDebugCards({
  engineState,
  engineMessage,
  loading,
  progress,
  geometryReady,
  geometryMeshCount,
  geometryVertexCount,
  geometryIndexCount,
  selectedEntityId,
  selectedEntityCount,
  currentFileName,
  currentModelId,
  currentModelSchema,
  currentModelMaxExpressId,
  loadedModelCount,
  residentChunkCount,
  totalChunkCount,
  visibleChunkCount,
}: BuildDebugCardsOptions): StatusBarDebugCard[] {
  return [
    {
      id: "engine",
      label: "Engine",
      value: engineState,
      subValue: engineMessage,
    },
    {
      id: "loading",
      label: "Loading",
      value: loading ? "Active" : "Idle",
      subValue: progress || "-",
    },
    {
      id: "geometry",
      label: "Geometry",
      value: geometryReady ? `${geometryMeshCount} meshes` : "Not ready",
      subValue: geometryReady
        ? `${geometryVertexCount.toLocaleString()} verts · ${geometryIndexCount.toLocaleString()} idx`
        : "-",
    },
    {
      id: "selection",
      label: "Selection",
      value:
        selectedEntityCount > 0 ? `${selectedEntityCount} selected` : "None",
      subValue: selectedEntityId !== null ? `Primary #${selectedEntityId}` : "-",
    },
    {
      id: "model",
      label: "Model",
      value: currentFileName ?? "-",
      subValue: `ID ${currentModelId ?? "-"} · Schema ${currentModelSchema ?? "-"} · Max ${currentModelMaxExpressId ?? "-"} · ${loadedModelCount} models`,
    },
    {
      id: "chunks",
      label: "Chunks",
      value: `${residentChunkCount} / ${totalChunkCount}`,
      subValue: `${visibleChunkCount} visible targets`,
    },
  ];
}
