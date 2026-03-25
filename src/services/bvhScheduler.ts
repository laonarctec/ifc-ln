import type { BufferGeometry } from "three";
import type { BufferGeometryWithBVH } from "@/utils/three-bvh";
import { BVH_MAX_LEAF_SIZE } from "@/config/performance";

type BVHCallback = () => void;

interface QueueEntry {
  geometry: BufferGeometry;
  onComplete?: BVHCallback;
}

const queue: QueueEntry[] = [];
const scheduled = new WeakSet<BufferGeometry>();
let idleHandle = 0;

function computeBVH(geometry: BufferGeometry): void {
  (geometry as BufferGeometryWithBVH).computeBoundsTree?.({
    maxLeafSize: BVH_MAX_LEAF_SIZE,
  });
}

/** Process one geometry per idle callback to avoid blocking the main thread. */
function processOne() {
  const entry = queue.shift();
  if (!entry) {
    idleHandle = 0;
    return;
  }

  try {
    computeBVH(entry.geometry);
    entry.onComplete?.();
  } catch {
    // Geometry may have been disposed — safe to ignore
  }

  if (queue.length > 0) {
    idleHandle = requestIdleCallback(processOne);
  } else {
    idleHandle = 0;
  }
}

/**
 * Schedule deferred BVH generation for a geometry.
 * Runs synchronously but deferred to browser idle time via requestIdleCallback,
 * processing one geometry per idle slot to keep the main thread responsive.
 */
export function scheduleBVH(
  geometry: BufferGeometry,
  onComplete?: BVHCallback,
): void {
  if (scheduled.has(geometry)) return;
  if ((geometry as BufferGeometryWithBVH).boundsTree)
    return;

  scheduled.add(geometry);
  queue.push({ geometry, onComplete });

  if (idleHandle === 0) {
    idleHandle = requestIdleCallback(processOne);
  }
}

/** Cancel all pending BVH generation. */
export function cancelAllBVH(): void {
  queue.length = 0;
  if (idleHandle !== 0) {
    cancelIdleCallback(idleHandle);
    idleHandle = 0;
  }
}
