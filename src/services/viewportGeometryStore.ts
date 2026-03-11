import { useSyncExternalStore } from 'react';
import type { TransferableMeshData } from '@/types/worker-messages';

interface ViewportGeometrySnapshot {
  meshes: TransferableMeshData[];
}

class ViewportGeometryStore {
  private snapshot: ViewportGeometrySnapshot = {
    meshes: [],
  };

  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  setMeshes = (meshes: TransferableMeshData[]) => {
    this.snapshot = { meshes };
    this.emit();
  };

  clear = () => {
    this.snapshot = { meshes: [] };
    this.emit();
  };

  private emit() {
    this.listeners.forEach((listener) => listener());
  }
}

export const viewportGeometryStore = new ViewportGeometryStore();

export function useViewportGeometry() {
  return useSyncExternalStore(
    viewportGeometryStore.subscribe,
    viewportGeometryStore.getSnapshot,
    viewportGeometryStore.getSnapshot
  );
}
