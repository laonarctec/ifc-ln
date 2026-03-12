import { useSyncExternalStore } from 'react';
import type { RenderChunkPayload, RenderManifest, TransferableMeshData } from '@/types/worker-messages';

interface ViewportGeometrySnapshot {
  manifest: RenderManifest | null;
  residentChunkIds: number[];
  visibleChunkIds: number[];
  chunksById: Record<number, RenderChunkPayload>;
  version: number;
}

function flattenResidentMeshes(chunksById: Record<number, RenderChunkPayload>, residentChunkIds: number[]) {
  const meshes: TransferableMeshData[] = [];

  residentChunkIds.forEach((chunkId) => {
    const chunk = chunksById[chunkId];
    if (!chunk) {
      return;
    }

    meshes.push(...chunk.meshes);
  });

  return meshes;
}

class ViewportGeometryStore {
  private snapshot: ViewportGeometrySnapshot = {
    manifest: null,
    residentChunkIds: [],
    visibleChunkIds: [],
    chunksById: {},
    version: 0,
  };

  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  setManifest = (manifest: RenderManifest | null) => {
    this.snapshot = {
      manifest,
      residentChunkIds: [],
      visibleChunkIds: [],
      chunksById: {},
      version: this.snapshot.version + 1,
    };
    this.emit();
  };

  setVisibleChunkIds = (visibleChunkIds: number[]) => {
    this.snapshot = {
      ...this.snapshot,
      visibleChunkIds: [...new Set(visibleChunkIds)],
      version: this.snapshot.version + 1,
    };
    this.emit();
  };

  upsertChunks = (chunks: RenderChunkPayload[]) => {
    if (chunks.length === 0) {
      return;
    }

    const nextChunksById = { ...this.snapshot.chunksById };
    chunks.forEach((chunk) => {
      nextChunksById[chunk.chunkId] = chunk;
    });

    const residentChunkIds = Object.keys(nextChunksById)
      .map((chunkId) => Number(chunkId))
      .sort((left, right) => left - right);

    this.snapshot = {
      ...this.snapshot,
      chunksById: nextChunksById,
      residentChunkIds,
      version: this.snapshot.version + 1,
    };
    this.emit();
  };

  releaseChunks = (chunkIds: number[]) => {
    if (chunkIds.length === 0) {
      return;
    }

    const releaseSet = new Set(chunkIds);
    const nextChunksById = { ...this.snapshot.chunksById };
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

    this.snapshot = {
      ...this.snapshot,
      chunksById: nextChunksById,
      residentChunkIds,
      visibleChunkIds: this.snapshot.visibleChunkIds.filter((chunkId) => !releaseSet.has(chunkId)),
      version: this.snapshot.version + 1,
    };
    this.emit();
  };

  clear = () => {
    this.snapshot = {
      manifest: null,
      residentChunkIds: [],
      visibleChunkIds: [],
      chunksById: {},
      version: this.snapshot.version + 1,
    };
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
    viewportGeometryStore.getSnapshot
  );

  return {
    ...snapshot,
    meshes: flattenResidentMeshes(snapshot.chunksById, snapshot.residentChunkIds),
  };
}
