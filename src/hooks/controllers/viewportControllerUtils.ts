import type { ViewportGeometryModelSnapshot } from "@/services/viewportGeometryStore";
import type { LoadedViewerModel } from "@/stores/slices/dataSlice";
import type { RenderChunkPayload, RenderManifest } from "@/types/worker-messages";
import { createModelEntityKey, type ModelEntityKey } from "@/utils/modelEntity";
import type { BoxSelectionResult } from "@/components/viewer/viewport/raycasting";
import type { ContextMenuState } from "@/components/viewer/ContextMenu";

export interface ViewportEmptyState {
  title: string;
  description: string;
  hint: string;
  tone: "idle" | "loading" | "error";
}

interface ViewportEmptyStateInput {
  error: string | null;
  loading: boolean;
  progress: string;
  engineState: "idle" | "initializing" | "ready" | "error";
  engineMessage: string;
  currentFileName: string | null;
  loadedModelCount: number;
}

interface ViewportSelectionStateLike {
  selectedModelId: number | null;
  selectedEntityIds: number[];
}

export type BoxSelectionChange =
  | { kind: "ignore" }
  | { kind: "clear" }
  | { kind: "select"; modelId: number; expressIds: number[] };

function uniqueEntityIds(entityIds: number[]) {
  return [...new Set(entityIds)];
}

export function buildSelectedEntityKeys(
  selectedModelId: number | null,
  selectedEntityIds: number[],
) {
  if (selectedModelId === null) {
    return new Set<ModelEntityKey>();
  }

  return new Set(
    selectedEntityIds.map((entityId) =>
      createModelEntityKey(selectedModelId, entityId),
    ),
  );
}

export function buildCombinedHiddenKeys(
  ...hiddenKeySets: ReadonlySet<ModelEntityKey>[]
) {
  const combined = new Set<ModelEntityKey>();
  hiddenKeySets.forEach((hiddenKeys) => {
    hiddenKeys.forEach((key) => combined.add(key));
  });
  return combined;
}

export function filterVisibleSelectedIds(
  selectedEntityIds: number[],
  effectiveHiddenIdSet: ReadonlySet<number>,
) {
  return selectedEntityIds.filter((entityId) => !effectiveHiddenIdSet.has(entityId));
}

export function collectResidentChunks(
  loadedModels: LoadedViewerModel[],
  modelsById: Record<number, ViewportGeometryModelSnapshot>,
) {
  return loadedModels
    .filter((model) => model.visible)
    .flatMap(
      (model) =>
        modelsById[model.modelId]?.residentChunkIds
          .map((chunkId) => modelsById[model.modelId]?.chunksById[chunkId])
          .filter((chunk): chunk is RenderChunkPayload => Boolean(chunk)) ?? [],
    );
}

export function collectVisibleManifests(
  loadedModels: LoadedViewerModel[],
  modelsById: Record<number, ViewportGeometryModelSnapshot>,
) {
  return loadedModels
    .filter((model) => model.visible)
    .map((model) => modelsById[model.modelId]?.manifest)
    .filter((manifest): manifest is RenderManifest => Boolean(manifest));
}

export function resolveViewportEmptyState({
  error,
  loading,
  progress,
  engineState,
  engineMessage,
  currentFileName,
  loadedModelCount,
}: ViewportEmptyStateInput): ViewportEmptyState {
  if (error) {
    return {
      tone: "error",
      title: "모델을 불러오지 못했습니다",
      description: error,
      hint: "다른 IFC 파일로 다시 시도하거나 엔진 상태와 worker 로그를 확인해 주세요.",
    };
  }
  if (loading) {
    return {
      tone: "loading",
      title: "모델을 준비하고 있습니다",
      description: progress,
      hint: "render cache와 spatial tree를 순서대로 준비하는 중입니다.",
    };
  }
  if (engineState !== "ready") {
    return {
      tone: "idle",
      title: "엔진 준비가 필요합니다",
      description: engineMessage,
      hint: "헤더에서 엔진을 초기화한 뒤 IFC 파일을 열면 바로 3D 뷰가 표시됩니다.",
    };
  }
  if (!currentFileName && loadedModelCount === 0) {
    return {
      tone: "idle",
      title: "IFC 파일을 열어 주세요",
      description: "모델이 아직 로드되지 않았습니다.",
      hint: "헤더의 열기 버튼으로 IFC 파일을 선택하면 뷰포트와 패널이 함께 채워집니다.",
    };
  }
  return {
    tone: "idle",
    title: "렌더 청크를 준비하고 있습니다",
    description:
      "모델 메타데이터는 열렸지만 아직 현재 시야에 필요한 청크가 로드되지 않았습니다.",
    hint: "대형 IFC의 경우 첫 시야에 필요한 청크만 우선 올립니다.",
  };
}

export function createViewportContextMenu(
  selectionState: ViewportSelectionStateLike,
  modelId: number | null,
  expressId: number | null,
  position: { x: number; y: number },
): ContextMenuState {
  const hasSelection =
    selectionState.selectedModelId !== null &&
    selectionState.selectedEntityIds.length > 0;

  return {
    modelId: hasSelection ? selectionState.selectedModelId : modelId,
    entityIds: hasSelection
      ? selectionState.selectedEntityIds
      : expressId !== null
        ? [expressId]
        : [],
    x: position.x,
    y: position.y,
  };
}

export function resolveContextMenuShowAllTarget(
  contextMenu: ContextMenuState | null,
  currentModelId: number | null,
) {
  return contextMenu?.modelId ?? currentModelId;
}

export function collectManifestEntityIds(manifest: RenderManifest | null | undefined) {
  return uniqueEntityIds(manifest?.chunks.flatMap((chunk) => chunk.entityIds) ?? []);
}

export function resolveBoxSelectionChange(
  results: BoxSelectionResult[],
  additive: boolean,
  selectedModelId: number | null,
  selectedEntityIds: number[],
): BoxSelectionChange {
  if (results.length === 0) {
    return additive ? { kind: "ignore" } : { kind: "clear" };
  }

  const modelId = results[0].modelId;
  const expressIds = uniqueEntityIds(
    results
      .filter((result) => result.modelId === modelId)
      .map((result) => result.expressId),
  );

  if (!additive) {
    return { kind: "select", modelId, expressIds };
  }

  const currentIds = selectedModelId === modelId ? selectedEntityIds : [];
  return {
    kind: "select",
    modelId,
    expressIds: uniqueEntityIds([...currentIds, ...expressIds]),
  };
}
