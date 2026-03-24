import { useEffect } from "react";
import * as THREE from "three";
import { useViewerStore } from "@/stores";
import type { RenderChunkPayload } from "@/types/worker-messages";
import {
  appendEdgesToGroup,
  appendMeshesToGroup,
  removeIndexedRenderEntry,
  updateMeshVisualState,
} from "@/components/viewer/viewport/meshManagement";
import type { ModelEntityKey } from "@/utils/modelEntity";
import type { SceneRefs } from "./useThreeScene";

function buildChunkKey(modelId: number, chunkId: number) {
  return `${modelId}:${chunkId}`;
}

export function useChunkSceneGraph(
  refs: SceneRefs,
  residentChunks: RenderChunkPayload[],
  chunkVersion: number,
  sceneGeneration: number,
  selectedEntityKeys: Set<ModelEntityKey>,
  hiddenEntityKeys: Set<ModelEntityKey>,
  colorOverrides: Map<ModelEntityKey, string>,
  selectedEntityKeysRef: React.MutableRefObject<Set<ModelEntityKey>>,
  hiddenEntityKeysRef: React.MutableRefObject<Set<ModelEntityKey>>,
  colorOverridesRef: React.MutableRefObject<Map<ModelEntityKey, string>>,
) {
  useEffect(() => {
    const currentSelectedSet = new Set(selectedEntityKeys);
    const currentHiddenSet = new Set(hiddenEntityKeys);
    const previousSelectedSet = new Set(selectedEntityKeysRef.current);
    const previousHiddenSet = new Set(hiddenEntityKeysRef.current);

    updateMeshVisualState(
      refs.entryIndexRef.current,
      previousSelectedSet,
      previousHiddenSet,
      currentSelectedSet,
      currentHiddenSet,
      colorOverrides,
    );

    selectedEntityKeysRef.current = currentSelectedSet;
    hiddenEntityKeysRef.current = currentHiddenSet;
    colorOverridesRef.current = new Map(colorOverrides);

    refs.chunkGroupsRef.current.forEach((chunkGroup) => {
      chunkGroup.edgeEntries.forEach((edgeEntry) => {
        edgeEntry.object.visible = !currentHiddenSet.has(edgeEntry.entityKey);
      });
    });

    refs.needsRenderRef.current = true;
  }, [
    colorOverrides,
    hiddenEntityKeys,
    refs,
    selectedEntityKeys,
    selectedEntityKeysRef,
    hiddenEntityKeysRef,
    colorOverridesRef,
  ]);

  useEffect(() => {
    const sceneRoot = refs.sceneRootRef.current;
    if (!sceneRoot) return;

    const nextChunkKeys = new Set(
      residentChunks.map((chunk) => buildChunkKey(chunk.modelId, chunk.chunkId)),
    );

    refs.chunkGroupsRef.current.forEach((chunkGroup, chunkKey) => {
      if (nextChunkKeys.has(chunkKey)) return;

      sceneRoot.remove(chunkGroup.group);
      sceneRoot.remove(chunkGroup.edgeGroup);
      chunkGroup.entries.forEach((entry) => {
        removeIndexedRenderEntry(refs.entryIndexRef.current, entry);
        const cached = refs.geometryCacheRef.current.get(entry.geometryExpressId);
        if (cached) {
          cached.refCount -= 1;
          if (cached.refCount <= 0) {
            (
              cached.geometry as THREE.BufferGeometry & {
                disposeBoundsTree?: () => void;
              }
            ).disposeBoundsTree?.();
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
      refs.chunkGroupsRef.current.delete(chunkKey);
    });

    residentChunks.forEach((chunk) => {
      const chunkKey = buildChunkKey(chunk.modelId, chunk.chunkId);
      if (refs.chunkGroupsRef.current.has(chunkKey)) return;

      const chunkGroup = new THREE.Group();
      const builtChunk = appendMeshesToGroup(
        chunk.meshes,
        chunkGroup,
        refs.geometryCacheRef.current,
        refs.entryIndexRef.current,
        selectedEntityKeysRef.current,
        hiddenEntityKeysRef.current,
        colorOverridesRef.current,
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
        hiddenEntityKeysRef.current,
        currentTheme,
      );
      edgeGroup.visible = edgesVisible;
      sceneRoot.add(edgeGroup);

      refs.chunkGroupsRef.current.set(chunkKey, {
        group: chunkGroup,
        entries: builtChunk.entries,
        materials: builtChunk.materials,
        edgeGroup,
        edgeEntries: builtEdges.edgeEntries,
        edgeMaterials: builtEdges.edgeMaterials,
      });
    });

    refs.needsRenderRef.current = true;
  }, [
    chunkVersion,
    residentChunks,
    sceneGeneration,
    refs,
    selectedEntityKeysRef,
    hiddenEntityKeysRef,
    colorOverridesRef,
  ]);
}
