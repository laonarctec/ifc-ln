import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useViewerStore } from "@/stores";
import type { RenderChunkPayload } from "@/types/worker-messages";
import {
  appendEdgesToGroup,
  appendMeshesToGroup,
  removeIndexedRenderEntry,
  updateMeshVisualState,
} from "@/components/viewer/viewport/meshManagement";
import { FRAME_BUDGET_MS } from "@/config/performance";
import { ifcWorkerClient } from "@/services/IfcWorkerClient";
import { viewportGeometryStore } from "@/services/viewportGeometryStore";
import { loadEdgeChunksFromIfcb } from "@/services/ifcbFormat";
import { scheduleBVH } from "@/services/bvhScheduler";
import type { BufferGeometryWithBVH } from "@/utils/three-bvh";
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
  const pendingChunksRef = useRef<Map<string, RenderChunkPayload>>(new Map());
  const rafIdRef = useRef(0);
  // Counter that increments when all pending chunks finish attaching.
  // Used to re-trigger the edge loading effect after budget-constrained attachment.
  const [attachEpoch, setAttachEpoch] = useState(0);
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
            (cached.geometry as BufferGeometryWithBVH).disposeBoundsTree?.();
            cached.geometry.dispose();
            refs.geometryCacheRef.current.delete(entry.geometryExpressId);
          }
        }
      });
      refs.meshEntriesRef.current = refs.meshEntriesRef.current.filter(
        (entry) => !chunkGroup.entries.includes(entry),
      );
      // Only dispose cloned materials; pooled materials are managed by materialPool
      chunkGroup.materials.forEach((material) => {
        if (material.userData?.poolClone) material.dispose();
      });
      // Dispose BatchedMesh internal textures and merged geometry
      chunkGroup.batchedMeshes.forEach((bm) => bm.dispose());
      // Edge materials are pooled — do not dispose
      chunkGroup.edgeEntries.forEach((entry) => {
        entry.object.geometry.dispose();
      });
      chunkGroup.pendingEdgeData = null;
      refs.chunkGroupsRef.current.delete(chunkKey);
    });

    // Queue new chunks instead of attaching immediately
    residentChunks.forEach((chunk) => {
      const chunkKey = buildChunkKey(chunk.modelId, chunk.chunkId);
      if (refs.chunkGroupsRef.current.has(chunkKey)) return;
      if (pendingChunksRef.current.has(chunkKey)) return;
      pendingChunksRef.current.set(chunkKey, chunk);
    });

    // Also remove stale entries from pending queue
    pendingChunksRef.current.forEach((_chunk, chunkKey) => {
      if (!nextChunkKeys.has(chunkKey)) {
        pendingChunksRef.current.delete(chunkKey);
      }
    });

    // Start budget-constrained processing loop
    const processChunkBatch = () => {
      const batchSceneRoot = refs.sceneRootRef.current;
      if (!batchSceneRoot) return;
      const start = performance.now();

      for (const [chunkKey, chunk] of pendingChunksRef.current) {
        if (performance.now() - start > FRAME_BUDGET_MS) break;

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
        batchSceneRoot.add(chunkGroup);

        const edgeGroup = new THREE.Group();
        edgeGroup.visible = useViewerStore.getState().edgesVisible;
        batchSceneRoot.add(edgeGroup);

        refs.chunkGroupsRef.current.set(chunkKey, {
          group: chunkGroup,
          entries: builtChunk.entries,
          materials: builtChunk.materials,
          batchedMeshes: builtChunk.batchedMeshes,
          edgeGroup,
          edgeEntries: [],
          edgeMaterials: [],
          pendingEdgeData: null,
        });

        // Schedule deferred BVH generation for unique geometries in the cache.
        // BatchedMesh copies geometry data internally so BVH on cached geometry
        // only benefits transparent Mesh objects that still use it directly.
        const seenGeo = new Set<number>();
        for (const entry of builtChunk.entries) {
          if (seenGeo.has(entry.geometryExpressId)) continue;
          seenGeo.add(entry.geometryExpressId);
          const cached = refs.geometryCacheRef.current.get(entry.geometryExpressId);
          if (cached) scheduleBVH(cached.geometry);
        }

        pendingChunksRef.current.delete(chunkKey);
        refs.needsRenderRef.current = true;
      }

      if (pendingChunksRef.current.size > 0) {
        rafIdRef.current = requestAnimationFrame(processChunkBatch);
      } else {
        rafIdRef.current = 0;
        // Signal that all pending chunks are now attached,
        // so the edge loading effect can find them in chunkGroupsRef.
        setAttachEpoch((v) => v + 1);
      }
    };

    if (pendingChunksRef.current.size > 0 && rafIdRef.current === 0) {
      rafIdRef.current = requestAnimationFrame(processChunkBatch);
    }

    refs.needsRenderRef.current = true;

    return () => {
      if (rafIdRef.current !== 0) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
    };
  }, [
    chunkVersion,
    residentChunks,
    sceneGeneration,
    refs,
    selectedEntityKeysRef,
    hiddenEntityKeysRef,
    colorOverridesRef,
  ]);

  // --- Deferred edge loading: request edges from worker after mesh attach ---
  useEffect(() => {
    let cancelled = false;
    let idleHandle = 0;

    // Collect chunks that need edges
    const chunksNeedingEdges: Array<{ modelId: number; chunkId: number; chunkKey: string }> = [];
    refs.chunkGroupsRef.current.forEach((cg, chunkKey) => {
      if (cg.edgeEntries.length === 0 && !cg.pendingEdgeData) {
        const [modelIdStr, chunkIdStr] = chunkKey.split(":");
        chunksNeedingEdges.push({
          modelId: Number(modelIdStr),
          chunkId: Number(chunkIdStr),
          chunkKey,
        });
      }
    });

    if (chunksNeedingEdges.length === 0) return;

    // Group by modelId for batched requests
    const byModel = new Map<number, number[]>();
    for (const { modelId, chunkId } of chunksNeedingEdges) {
      const list = byModel.get(modelId);
      if (list) list.push(chunkId);
      else byModel.set(modelId, [chunkId]);
    }

    // Request edge data — from IFCB binary if available, otherwise from worker
    void (async () => {
      for (const [modelId, chunkIds] of byModel) {
        if (cancelled) return;
        try {
          const ifcbFile = viewportGeometryStore.getIfcbFile(modelId);
          const edgeChunks = ifcbFile
            ? loadEdgeChunksFromIfcb(ifcbFile, chunkIds)
            : (await ifcWorkerClient.loadEdgeChunks(modelId, chunkIds)).chunks;
          if (cancelled) return;

          for (const edgeChunk of edgeChunks) {
            const key = `${edgeChunk.modelId}:${edgeChunk.chunkId}`;
            const cg = refs.chunkGroupsRef.current.get(key);
            if (!cg) continue;
            cg.pendingEdgeData = {
              edges: edgeChunk.edges,
              meshes: edgeChunk.meshRefs,
            };
          }

          // Process pending edges one at a time via idle callback
          const processOne = () => {
            if (cancelled) return;
            for (const [, cg] of refs.chunkGroupsRef.current) {
              if (!cg.pendingEdgeData) continue;
              const { edges, meshes } = cg.pendingEdgeData;
              const currentTheme = useViewerStore.getState().theme;
              const builtEdges = appendEdgesToGroup(
                edges,
                meshes,
                cg.edgeGroup,
                hiddenEntityKeysRef.current,
                currentTheme,
              );
              cg.edgeEntries = builtEdges.edgeEntries;
              cg.edgeMaterials = builtEdges.edgeMaterials;
              cg.pendingEdgeData = null;
              refs.needsRenderRef.current = true;
              idleHandle = requestIdleCallback(processOne);
              return;
            }
          };
          idleHandle = requestIdleCallback(processOne);
        } catch {
          // Edge loading failure is non-critical — edges just won't show
        }
      }
    })();

    return () => {
      cancelled = true;
      if (idleHandle) cancelIdleCallback(idleHandle);
    };
  }, [chunkVersion, residentChunks, sceneGeneration, refs, hiddenEntityKeysRef, attachEpoch]);
}
