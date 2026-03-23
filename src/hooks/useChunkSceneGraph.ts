import { useEffect } from "react";
import * as THREE from "three";
import { useViewerStore } from "@/stores";
import type { RenderChunkPayload } from "@/types/worker-messages";
import {
  removeIndexedRenderEntry,
  appendMeshesToGroup,
  appendEdgesToGroup,
  updateMeshVisualState,
} from "@/components/viewer/viewport/meshManagement";
import type { SceneRefs } from "./useThreeScene";

export function useChunkSceneGraph(
  refs: SceneRefs,
  residentChunks: RenderChunkPayload[],
  chunkVersion: number,
  sceneGeneration: number,
  selectedEntityIds: number[],
  hiddenEntityIds: number[],
  selectedEntityIdsRef: React.MutableRefObject<number[]>,
  hiddenEntityIdsRef: React.MutableRefObject<number[]>,
) {
  // Visual state sync (selection/hidden changes)
  useEffect(() => {
    const currentSelectedSet = new Set(selectedEntityIds);
    const currentHiddenSet = new Set(hiddenEntityIds);

    // Track previous sets for delta updates
    const previousSelectedSet = new Set(selectedEntityIdsRef.current);
    const previousHiddenSet = new Set(hiddenEntityIdsRef.current);

    updateMeshVisualState(
      refs.entryIndexRef.current,
      previousSelectedSet,
      previousHiddenSet,
      currentSelectedSet,
      currentHiddenSet,
    );

    selectedEntityIdsRef.current = selectedEntityIds;
    hiddenEntityIdsRef.current = hiddenEntityIds;

    // Sync edge visibility
    const hiddenSet = new Set(hiddenEntityIds);
    refs.chunkGroupsRef.current.forEach((chunkGroup) => {
      chunkGroup.edgeEntries.forEach((edgeEntry) => {
        edgeEntry.object.visible = !hiddenSet.has(edgeEntry.expressId);
      });
    });

    refs.needsRenderRef.current = true;
  }, [hiddenEntityIds, selectedEntityIds, refs, selectedEntityIdsRef, hiddenEntityIdsRef]);

  // Chunk add/remove
  useEffect(() => {
    const sceneRoot = refs.sceneRootRef.current;
    if (!sceneRoot) return;

    const nextChunkIds = new Set(residentChunks.map((chunk) => chunk.chunkId));

    // Remove chunks no longer resident
    refs.chunkGroupsRef.current.forEach((chunkGroup, chunkId) => {
      if (nextChunkIds.has(chunkId)) return;

      sceneRoot.remove(chunkGroup.group);
      sceneRoot.remove(chunkGroup.edgeGroup);
      chunkGroup.entries.forEach((entry) => {
        removeIndexedRenderEntry(refs.entryIndexRef.current, entry);
        const cached = refs.geometryCacheRef.current.get(entry.geometryExpressId);
        if (cached) {
          cached.refCount -= 1;
          if (cached.refCount <= 0) {
            (cached.geometry as THREE.BufferGeometry & { disposeBoundsTree?: () => void }).disposeBoundsTree?.();
            cached.geometry.dispose();
            refs.geometryCacheRef.current.delete(entry.geometryExpressId);
          }
        }
      });
      refs.meshEntriesRef.current = refs.meshEntriesRef.current.filter(
        (entry) => !chunkGroup.entries.includes(entry),
      );
      chunkGroup.materials.forEach((material) => material.dispose());
      chunkGroup.edgeMaterials.forEach((material) => material.dispose());
      chunkGroup.edgeEntries.forEach((entry) => {
        entry.object.geometry.dispose();
      });
      refs.chunkGroupsRef.current.delete(chunkId);
    });

    // Add new chunks
    residentChunks.forEach((chunk) => {
      if (refs.chunkGroupsRef.current.has(chunk.chunkId)) return;

      const chunkGroup = new THREE.Group();
      const builtChunk = appendMeshesToGroup(
        chunk.meshes,
        chunkGroup,
        refs.geometryCacheRef.current,
        refs.entryIndexRef.current,
        selectedEntityIdsRef.current,
        hiddenEntityIdsRef.current,
      );
      refs.meshEntriesRef.current.push(...builtChunk.entries);
      sceneRoot.add(chunkGroup);

      const edgeGroup = new THREE.Group();
      const currentTheme = useViewerStore.getState().theme;
      const edgesVisible = useViewerStore.getState().edgesVisible;
      const builtEdges = appendEdgesToGroup(
        chunk.edges,
        chunk.meshes,
        edgeGroup,
        hiddenEntityIdsRef.current,
        currentTheme,
      );
      edgeGroup.visible = edgesVisible;
      sceneRoot.add(edgeGroup);

      refs.chunkGroupsRef.current.set(chunk.chunkId, {
        group: chunkGroup,
        entries: builtChunk.entries,
        materials: builtChunk.materials,
        edgeGroup,
        edgeEntries: builtEdges.edgeEntries,
        edgeMaterials: builtEdges.edgeMaterials,
      });
    });

    refs.needsRenderRef.current = true;
  }, [chunkVersion, residentChunks, sceneGeneration, refs, selectedEntityIdsRef, hiddenEntityIdsRef]);
}
