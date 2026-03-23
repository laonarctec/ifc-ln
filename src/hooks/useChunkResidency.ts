import { useEffect, useMemo, useRef } from 'react';
import { ifcWorkerClient } from '@/services/IfcWorkerClient';
import { viewportGeometryStore } from '@/services/viewportGeometryStore';
import type { RenderManifest } from '@/types/worker-messages';

export function useChunkResidency(
  currentModelId: number | null,
  manifest: RenderManifest | null,
  residentChunkIds: number[],
  visibleChunkIds: number[],
  selectedEntityIds: number[],
  activeStoreyFilter: number | null,
  activeTypeFilter: string | null,
  activeClassFilter: string | null,
) {
  const releaseTimersRef = useRef<Map<number, number>>(new Map());
  const loadingChunkIdsRef = useRef<Set<number>>(new Set());

  const entityToChunkIds = useMemo(() => {
    const map = new Map<number, number[]>();
    manifest?.chunks.forEach((chunk) => {
      chunk.entityIds.forEach((entityId) => {
        if (!map.has(entityId)) map.set(entityId, []);
        map.get(entityId)!.push(chunk.chunkId);
      });
    });
    return map;
  }, [manifest]);

  const desiredChunkIds = useMemo(() => {
    const desired = new Set<number>(manifest?.initialChunkIds ?? []);

    visibleChunkIds.forEach((chunkId) => desired.add(chunkId));

    selectedEntityIds.forEach((entityId) => {
      entityToChunkIds.get(entityId)?.forEach((chunkId) => desired.add(chunkId));
    });

    if (activeStoreyFilter !== null) {
      manifest?.chunks.forEach((chunk) => {
        if (chunk.storeyId === activeStoreyFilter) desired.add(chunk.chunkId);
      });
    }

    if (activeTypeFilter !== null) {
      manifest?.chunks.forEach((chunk) => {
        if (chunk.ifcTypes.includes(activeTypeFilter)) desired.add(chunk.chunkId);
      });
    }

    if (activeClassFilter !== null) {
      manifest?.chunks.forEach((chunk) => {
        if (chunk.ifcTypes.includes(activeClassFilter)) desired.add(chunk.chunkId);
      });
    }

    return [...desired].sort((left, right) => left - right);
  }, [activeClassFilter, activeStoreyFilter, activeTypeFilter, entityToChunkIds, manifest, selectedEntityIds, visibleChunkIds]);

  useEffect(() => {
    if (currentModelId === null || manifest === null) {
      releaseTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      releaseTimersRef.current.clear();
      loadingChunkIdsRef.current.clear();
      return;
    }

    const residentSet = new Set(residentChunkIds);
    const desiredSet = new Set(desiredChunkIds);

    desiredChunkIds.forEach((chunkId) => {
      const timerId = releaseTimersRef.current.get(chunkId);
      if (timerId) {
        window.clearTimeout(timerId);
        releaseTimersRef.current.delete(chunkId);
      }
    });

    const missingChunkIds = desiredChunkIds.filter(
      (chunkId) => !residentSet.has(chunkId) && !loadingChunkIdsRef.current.has(chunkId),
    );

    if (missingChunkIds.length > 0) {
      missingChunkIds.forEach((chunkId) => loadingChunkIdsRef.current.add(chunkId));
      void ifcWorkerClient.loadRenderChunks(currentModelId, missingChunkIds)
        .then((result) => {
          viewportGeometryStore.upsertChunks(result.chunks);
        })
        .catch((loadError) => {
          console.error(loadError);
        })
        .finally(() => {
          missingChunkIds.forEach((chunkId) => loadingChunkIdsRef.current.delete(chunkId));
        });
    }

    residentChunkIds
      .filter((chunkId) => !desiredSet.has(chunkId))
      .forEach((chunkId) => {
        if (releaseTimersRef.current.has(chunkId)) return;

        const timerId = window.setTimeout(() => {
          viewportGeometryStore.releaseChunks([chunkId]);
          if (currentModelId !== null) {
            void ifcWorkerClient.releaseRenderChunks(currentModelId, [chunkId]).catch((releaseError) => {
              console.error(releaseError);
            });
          }
          releaseTimersRef.current.delete(chunkId);
        }, 2000);

        releaseTimersRef.current.set(chunkId, timerId);
      });
  }, [currentModelId, desiredChunkIds, manifest, residentChunkIds]);
}
