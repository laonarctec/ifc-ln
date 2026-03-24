import { useSyncExternalStore } from "react";
import type {
  RenderChunkPayload,
  RenderManifest,
  TransferableMeshData,
} from "@/types/worker-messages";

export interface ViewportGeometryModelSnapshot {
  manifest: RenderManifest;
  residentChunkIds: number[];
  visibleChunkIds: number[];
  chunksById: Record<number, RenderChunkPayload>;
}

interface ViewportGeometrySnapshot {
  modelsById: Record<number, ViewportGeometryModelSnapshot>;
  modelIds: number[];
  combinedManifest: RenderManifest | null;
  version: number;
}

export function combineManifests(manifests: RenderManifest[]) {
  if (manifests.length === 0) {
    return null;
  }

  const initialBounds = [...manifests[0].modelBounds] as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];

  return manifests.reduce<RenderManifest>(
    (combined, manifest) => ({
      modelId: -1,
      meshCount: combined.meshCount + manifest.meshCount,
      vertexCount: combined.vertexCount + manifest.vertexCount,
      indexCount: combined.indexCount + manifest.indexCount,
      chunkCount: combined.chunkCount + manifest.chunkCount,
      modelBounds: [
        Math.min(combined.modelBounds[0], manifest.modelBounds[0]),
        Math.min(combined.modelBounds[1], manifest.modelBounds[1]),
        Math.min(combined.modelBounds[2], manifest.modelBounds[2]),
        Math.max(combined.modelBounds[3], manifest.modelBounds[3]),
        Math.max(combined.modelBounds[4], manifest.modelBounds[4]),
        Math.max(combined.modelBounds[5], manifest.modelBounds[5]),
      ],
      initialChunkIds: [],
      chunks: [...combined.chunks, ...manifest.chunks],
    }),
    {
      modelId: -1,
      meshCount: 0,
      vertexCount: 0,
      indexCount: 0,
      chunkCount: 0,
      modelBounds: initialBounds,
      initialChunkIds: [],
      chunks: [],
    },
  );
}

function flattenResidentMeshes(modelsById: Record<number, ViewportGeometryModelSnapshot>) {
  const meshes: TransferableMeshData[] = [];

  Object.values(modelsById).forEach((model) => {
    model.residentChunkIds.forEach((chunkId) => {
      const chunk = model.chunksById[chunkId];
      if (!chunk) {
        return;
      }

      meshes.push(...chunk.meshes);
    });
  });

  return meshes;
}

class ViewportGeometryStore {
  private snapshot: ViewportGeometrySnapshot = {
    modelsById: {},
    modelIds: [],
    combinedManifest: null,
    version: 0,
  };

  private cachedMeshes: TransferableMeshData[] = [];

  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  getCachedMeshes = () => this.cachedMeshes;

  setManifest = (manifest: RenderManifest | null) => {
    if (manifest === null) {
      this.clear();
      return;
    }

    const nextModelsById = {
      ...this.snapshot.modelsById,
      [manifest.modelId]: {
        manifest,
        residentChunkIds: [],
        visibleChunkIds: [],
        chunksById: {},
      },
    };

    this.snapshot = {
      modelsById: nextModelsById,
      modelIds: Object.keys(nextModelsById)
        .map((modelId) => Number(modelId))
        .sort((left, right) => left - right),
      combinedManifest: combineManifests(
        Object.values(nextModelsById).map((model) => model.manifest),
      ),
      version: this.snapshot.version + 1,
    };
    this.cachedMeshes = flattenResidentMeshes(nextModelsById);
    this.emit();
  };

  removeModel = (modelId: number) => {
    if (!this.snapshot.modelsById[modelId]) {
      return;
    }

    const nextModelsById = { ...this.snapshot.modelsById };
    delete nextModelsById[modelId];

    this.snapshot = {
      modelsById: nextModelsById,
      modelIds: Object.keys(nextModelsById)
        .map((id) => Number(id))
        .sort((left, right) => left - right),
      combinedManifest: combineManifests(
        Object.values(nextModelsById).map((model) => model.manifest),
      ),
      version: this.snapshot.version + 1,
    };
    this.cachedMeshes = flattenResidentMeshes(nextModelsById);
    this.emit();
  };

  setVisibleChunkIds = (modelId: number, visibleChunkIds: number[]) => {
    const model = this.snapshot.modelsById[modelId];
    if (!model) {
      return;
    }

    const nextVisibleChunkIds = [...new Set(visibleChunkIds)];
    if (
      model.visibleChunkIds.length === nextVisibleChunkIds.length &&
      model.visibleChunkIds.every((chunkId, index) => chunkId === nextVisibleChunkIds[index])
    ) {
      return;
    }

    const nextModelsById = {
      ...this.snapshot.modelsById,
      [modelId]: {
        ...model,
        visibleChunkIds: nextVisibleChunkIds,
      },
    };

    this.snapshot = {
      ...this.snapshot,
      modelsById: nextModelsById,
      version: this.snapshot.version + 1,
    };
    this.emit();
  };

  upsertChunks = (modelId: number, chunks: RenderChunkPayload[]) => {
    if (chunks.length === 0) {
      return;
    }

    const model = this.snapshot.modelsById[modelId];
    if (!model) {
      return;
    }

    const nextChunksById = { ...model.chunksById };
    chunks.forEach((chunk) => {
      nextChunksById[chunk.chunkId] = chunk;
    });

    const residentChunkIds = Object.keys(nextChunksById)
      .map((chunkId) => Number(chunkId))
      .sort((left, right) => left - right);

    const nextModelsById = {
      ...this.snapshot.modelsById,
      [modelId]: {
        ...model,
        chunksById: nextChunksById,
        residentChunkIds,
      },
    };

    this.snapshot = {
      ...this.snapshot,
      modelsById: nextModelsById,
      version: this.snapshot.version + 1,
    };
    this.cachedMeshes = flattenResidentMeshes(nextModelsById);
    this.emit();
  };

  releaseChunks = (modelId: number, chunkIds: number[]) => {
    if (chunkIds.length === 0) {
      return;
    }

    const model = this.snapshot.modelsById[modelId];
    if (!model) {
      return;
    }

    const releaseSet = new Set(chunkIds);
    const nextChunksById = { ...model.chunksById };
    let changed = false;

    chunkIds.forEach((chunkId) => {
      if (nextChunksById[chunkId]) {
        delete nextChunksById[chunkId];
        changed = true;
      }
    });

    if (!changed) {
      return;
    }

    const residentChunkIds = Object.keys(nextChunksById)
      .map((chunkId) => Number(chunkId))
      .sort((left, right) => left - right);

    const nextModelsById = {
      ...this.snapshot.modelsById,
      [modelId]: {
        ...model,
        chunksById: nextChunksById,
        residentChunkIds,
        visibleChunkIds: model.visibleChunkIds.filter(
          (chunkId) => !releaseSet.has(chunkId),
        ),
      },
    };

    this.snapshot = {
      ...this.snapshot,
      modelsById: nextModelsById,
      version: this.snapshot.version + 1,
    };
    this.cachedMeshes = flattenResidentMeshes(nextModelsById);
    this.emit();
  };

  clear = () => {
    this.snapshot = {
      modelsById: {},
      modelIds: [],
      combinedManifest: null,
      version: this.snapshot.version + 1,
    };
    this.cachedMeshes = [];
    this.emit();
  };

  private emit() {
    this.listeners.forEach((listener) => listener());
  }
}

export const viewportGeometryStore = new ViewportGeometryStore();

export function useViewportGeometry() {
  const snapshot = useSyncExternalStore(
    viewportGeometryStore.subscribe,
    viewportGeometryStore.getSnapshot,
    viewportGeometryStore.getSnapshot,
  );

  return {
    ...snapshot,
    meshes: viewportGeometryStore.getCachedMeshes(),
  };
}
