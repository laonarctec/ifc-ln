import { useEffect, useMemo, useRef } from "react";
import { useViewerStore } from "@/stores";
import type { IfcSpatialNode } from "@/types/worker-messages";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface StoreyInfo {
  expressID: number;
  elevation: number;
}

/** Extract storey nodes with elevation from the spatial tree. */
function collectStoreys(nodes: IfcSpatialNode[]): StoreyInfo[] {
  const storeys: StoreyInfo[] = [];
  const walk = (node: IfcSpatialNode) => {
    if (
      node.type === "IFCBUILDINGSTOREY" &&
      node.elevation != null &&
      Number.isFinite(node.elevation)
    ) {
      storeys.push({ expressID: node.expressID, elevation: node.elevation });
    }
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return storeys.sort((a, b) => a.elevation - b.elevation);
}

/** Find the storey whose elevation is closest to the given height. */
function findClosestStorey(
  storeys: StoreyInfo[],
  height: number,
): StoreyInfo | null {
  if (storeys.length === 0) return null;
  let best = storeys[0];
  let bestDist = Math.abs(height - best.elevation);
  for (let i = 1; i < storeys.length; i++) {
    const dist = Math.abs(height - storeys[i].elevation);
    if (dist < bestDist) {
      best = storeys[i];
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Automatically tracks the camera's orbit target height and updates
 * the active storey filter to match the nearest building storey.
 *
 * Only active when `autoStoreyTracking` is enabled in the store.
 * Disabled when camera distance is > 2x model height (zoomed out overview).
 */
export function useAutoStoreyTracking(
  controlsRef: React.RefObject<OrbitControls | null>,
  modelBoundsY?: [number, number],
) {
  const spatialTree = useViewerStore((s) => s.spatialTree);
  const autoTracking = useViewerStore((s) => s.autoStoreyTracking);

  // Memoize storeys so the effect doesn't re-run unnecessarily
  const storeys = useMemo(() => collectStoreys(spatialTree), [spatialTree]);
  const lastStoreyIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!autoTracking) {
      if (lastStoreyIdRef.current !== null) {
        lastStoreyIdRef.current = null;
        useViewerStore.getState().setActiveStoreyFilter(null);
      }
      return;
    }

    if (storeys.length === 0) return;

    const INTERVAL_MS = 500;
    const timer = setInterval(() => {
      const controls = controlsRef.current;
      if (!controls) return;

      // Skip when zoomed out to overview
      if (modelBoundsY) {
        const modelHeight = Math.abs(modelBoundsY[1] - modelBoundsY[0]);
        const distance = controls.getDistance();
        if (distance > modelHeight * 2) {
          if (lastStoreyIdRef.current !== null) {
            lastStoreyIdRef.current = null;
            useViewerStore.getState().setActiveStoreyFilter(null);
          }
          return;
        }
      }

      const targetY = controls.target.y;
      const closest = findClosestStorey(storeys, targetY);
      if (closest && closest.expressID !== lastStoreyIdRef.current) {
        lastStoreyIdRef.current = closest.expressID;
        useViewerStore.getState().setActiveStoreyFilter(closest.expressID);
      }
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, [autoTracking, controlsRef, modelBoundsY, storeys]);
}
