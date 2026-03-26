import { useEffect, useMemo, useRef } from "react";
import { ifcWorkerClient } from "@/services/IfcWorkerClient";
import {
  viewportGeometryStore,
  type ViewportGeometryModelSnapshot,
} from "@/services/viewportGeometryStore";
import { loadChunksFromIfcb } from "@/services/ifcbFormat";
import type { LoadedViewerModel } from "@/stores/slices/dataSlice";

function buildChunkKey(modelId: number, chunkId: number) {
  return `${modelId}:${chunkId}`;
}

export function useChunkResidency(
  loadedModels: LoadedViewerModel[],
  geometryModelsById: Record<number, ViewportGeometryModelSnapshot>,
  activeModelId: number | null,
  selectedEntityIds: number[],
  activeStoreyFilter: number | null,
  activeTypeFilter: string | null,
  activeClassFilter: string | null,
) {
  const releaseTimersRef = useRef<Map<string, number>>(new Map());
  const loadingChunkKeysRef = useRef<Set<string>>(new Set());

  const desiredChunkIdsByModel = useMemo(() => {
    const result = new Map<number, number[]>();

    loadedModels
      .filter((model) => model.visible)
      .forEach((model) => {
        const geometryModel = geometryModelsById[model.modelId];
        const manifest = geometryModel?.manifest;
        if (!manifest) {
          return;
        }

        const entityToChunkIds = new Map<number, number[]>();
        manifest.chunks.forEach((chunk) => {
          chunk.entityIds.forEach((entityId) => {
            if (!entityToChunkIds.has(entityId)) {
              entityToChunkIds.set(entityId, []);
            }
            entityToChunkIds.get(entityId)!.push(chunk.chunkId);
          });
        });

        const desired = new Set<number>(manifest.initialChunkIds);
        geometryModel.visibleChunkIds.forEach((chunkId) => desired.add(chunkId));

        if (model.modelId === activeModelId) {
          selectedEntityIds.forEach((entityId) => {
            entityToChunkIds.get(entityId)?.forEach((chunkId) => desired.add(chunkId));
          });

          if (activeStoreyFilter !== null) {
            manifest.chunks.forEach((chunk) => {
              if (chunk.storeyId === activeStoreyFilter) {
                desired.add(chunk.chunkId);
              }
            });
          }

          if (activeTypeFilter !== null) {
            manifest.chunks.forEach((chunk) => {
              if (chunk.ifcTypes.includes(activeTypeFilter)) {
                desired.add(chunk.chunkId);
              }
            });
          }

          if (activeClassFilter !== null) {
            manifest.chunks.forEach((chunk) => {
              if (chunk.ifcTypes.includes(activeClassFilter)) {
                desired.add(chunk.chunkId);
              }
            });
          }
        }

        result.set(
          model.modelId,
          [...desired].sort((left, right) => left - right),
        );
      });

    return result;
  }, [
    activeClassFilter,
    activeModelId,
    activeStoreyFilter,
    activeTypeFilter,
    geometryModelsById,
    loadedModels,
    selectedEntityIds,
  ]);

  useEffect(() => {
    const activeModelIds = new Set(
      loadedModels.filter((model) => model.visible).map((model) => model.modelId),
    );

    releaseTimersRef.current.forEach((timerId, key) => {
      const [modelIdRaw] = key.split(":");
      if (!activeModelIds.has(Number(modelIdRaw))) {
        window.clearTimeout(timerId);
        releaseTimersRef.current.delete(key);
        loadingChunkKeysRef.current.delete(key);
      }
    });

    desiredChunkIdsByModel.forEach((desiredChunkIds, modelId) => {
      const geometryModel = geometryModelsById[modelId];
      const manifest = geometryModel?.manifest;
      if (!manifest) {
        return;
      }

      const residentChunkIds = geometryModel.residentChunkIds;
      const residentSet = new Set(residentChunkIds);
      const desiredSet = new Set(desiredChunkIds);

      desiredChunkIds.forEach((chunkId) => {
        const timerKey = buildChunkKey(modelId, chunkId);
        const timerId = releaseTimersRef.current.get(timerKey);
        if (timerId) {
          window.clearTimeout(timerId);
          releaseTimersRef.current.delete(timerKey);
        }
      });

      const missingChunkIds = desiredChunkIds.filter((chunkId) => {
        const chunkKey = buildChunkKey(modelId, chunkId);
        return (
          !residentSet.has(chunkId) &&
          !loadingChunkKeysRef.current.has(chunkKey)
        );
      });

      if (missingChunkIds.length > 0) {
        missingChunkIds.forEach((chunkId) =>
          loadingChunkKeysRef.current.add(buildChunkKey(modelId, chunkId)),
        );

        // Use IFCB binary if available, otherwise load from worker
        const ifcbFile = viewportGeometryStore.getIfcbFile(modelId);
        if (ifcbFile) {
          try {
            const chunks = loadChunksFromIfcb(ifcbFile, missingChunkIds);
            viewportGeometryStore.upsertChunks(modelId, chunks);
          } catch (loadError) {
            console.error(loadError);
          } finally {
            missingChunkIds.forEach((chunkId) =>
              loadingChunkKeysRef.current.delete(buildChunkKey(modelId, chunkId)),
            );
          }
        } else {
          void ifcWorkerClient
            .loadRenderChunks(modelId, missingChunkIds)
            .then((result) => {
              viewportGeometryStore.upsertChunks(modelId, result.chunks);
            })
            .catch((loadError) => {
              console.error(loadError);
            })
            .finally(() => {
              missingChunkIds.forEach((chunkId) =>
                loadingChunkKeysRef.current.delete(buildChunkKey(modelId, chunkId)),
              );
            });
        }
      }

      residentChunkIds
        .filter((chunkId) => !desiredSet.has(chunkId))
        .forEach((chunkId) => {
          const timerKey = buildChunkKey(modelId, chunkId);
          if (releaseTimersRef.current.has(timerKey)) {
            return;
          }

          const timerId = window.setTimeout(() => {
            viewportGeometryStore.releaseChunks(modelId, [chunkId]);
            void ifcWorkerClient
              .releaseRenderChunks(modelId, [chunkId])
              .catch((releaseError) => {
                console.error(releaseError);
              });
            releaseTimersRef.current.delete(timerKey);
          }, 2000);

          releaseTimersRef.current.set(timerKey, timerId);
        });
    });
  }, [desiredChunkIdsByModel, geometryModelsById, loadedModels]);
}
