import type { BufferGeometry } from "three";

/** BufferGeometry extended with three-mesh-bvh methods. */
export type BufferGeometryWithBVH = BufferGeometry & {
  computeBoundsTree?: (opts?: { maxLeafSize?: number }) => void;
  disposeBoundsTree?: () => void;
  boundsTree?: unknown;
};
