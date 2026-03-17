import { useMemo } from "react";
import { useViewportGeometry } from "@/services/viewportGeometryStore";
import {
  computeEntityMetrics,
  computeMultiEntityMetrics,
  type GeometryMetrics,
} from "@/utils/geometryMetrics";

export function useGeometryMetrics(
  selectedEntityId: number | null,
  selectedEntityIds: number[],
): {
  primary: GeometryMetrics | null;
  aggregate: GeometryMetrics | null;
  entityCount: number;
} {
  const { meshes } = useViewportGeometry();

  return useMemo(() => {
    if (selectedEntityId === null || meshes.length === 0) {
      return { primary: null, aggregate: null, entityCount: 0 };
    }

    const primary = computeEntityMetrics(meshes, selectedEntityId);

    if (selectedEntityIds.length <= 1) {
      return { primary, aggregate: null, entityCount: selectedEntityIds.length };
    }

    const multi = computeMultiEntityMetrics(meshes, selectedEntityIds);

    return {
      primary,
      aggregate: multi?.aggregate ?? null,
      entityCount: selectedEntityIds.length,
    };
  }, [meshes, selectedEntityId, selectedEntityIds]);
}
