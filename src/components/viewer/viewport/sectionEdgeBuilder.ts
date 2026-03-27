import * as THREE from "three";
import {
  CLIPPING_EPSILON,
  getQuantizedPointKey,
  getQuantizedSegmentKey,
} from "./sectionCutUtils";
import type { SectionTopology } from "./sectionTopologyCache";

export interface SectionBuildStats {
  trianglesTested: number;
  coplanarFaces: number;
  rawSegments: number;
  dedupedSegments: number;
  stitchedLoops: number;
  branchNodes: number;
  droppedDegenerate: number;
}

export interface SectionClosedLoop {
  points: THREE.Vector3[];
}

export interface SectionBuildResult {
  positions: number[];
  closedLoops: SectionClosedLoop[];
  stats: SectionBuildStats;
}

interface RawSectionSegment {
  start: THREE.Vector3;
  end: THREE.Vector3;
}

interface DedupedSectionSegment {
  start: THREE.Vector3;
  end: THREE.Vector3;
  startKey: string;
  endKey: string;
}

interface PolylineNode {
  key: string;
  point: THREE.Vector3;
}

const EMPTY_RESULT: SectionBuildResult = {
  positions: [],
  closedLoops: [],
  stats: {
    trianglesTested: 0,
    coplanarFaces: 0,
    rawSegments: 0,
    dedupedSegments: 0,
    stitchedLoops: 0,
    branchNodes: 0,
    droppedDegenerate: 0,
  },
};

function readTopologyPoint(
  positions: Float32Array,
  index: number,
  target: THREE.Vector3,
) {
  const offset = index * 3;
  return target.set(
    positions[offset] ?? 0,
    positions[offset + 1] ?? 0,
    positions[offset + 2] ?? 0,
  );
}

function pushUniquePoint(points: THREE.Vector3[], point: THREE.Vector3) {
  for (const existing of points) {
    if (existing.distanceToSquared(point) <= CLIPPING_EPSILON * CLIPPING_EPSILON) {
      return;
    }
  }
  points.push(point.clone());
}

function appendIntersectionPoint(
  start: THREE.Vector3,
  startDistance: number,
  end: THREE.Vector3,
  endDistance: number,
  points: THREE.Vector3[],
) {
  const startOnPlane = Math.abs(startDistance) <= CLIPPING_EPSILON;
  const endOnPlane = Math.abs(endDistance) <= CLIPPING_EPSILON;

  if (startOnPlane) {
    pushUniquePoint(points, start);
  }

  if (endOnPlane) {
    pushUniquePoint(points, end);
  }

  if (startOnPlane || endOnPlane || startDistance * endDistance > 0) {
    return;
  }

  const t = startDistance / (startDistance - endDistance);
  pushUniquePoint(points, start.clone().lerp(end, t));
}

function collectSegmentPoints(
  pointA: THREE.Vector3,
  distanceA: number,
  pointB: THREE.Vector3,
  distanceB: number,
  pointC: THREE.Vector3,
  distanceC: number,
) {
  const points: THREE.Vector3[] = [];
  appendIntersectionPoint(pointA, distanceA, pointB, distanceB, points);
  appendIntersectionPoint(pointB, distanceB, pointC, distanceC, points);
  appendIntersectionPoint(pointC, distanceC, pointA, distanceA, points);
  return points;
}

function buildPolyline(
  startSegmentIndex: number,
  startPointKey: string,
  pointAdjacency: Map<string, number[]>,
  pointLookup: Map<string, THREE.Vector3>,
  segments: DedupedSectionSegment[],
  visited: Set<number>,
) {
  const polyline: PolylineNode[] = [];
  let currentSegmentIndex: number | null = startSegmentIndex;
  let currentPointKey = startPointKey;

  const startPoint = pointLookup.get(startPointKey);
  if (!startPoint) {
    return polyline;
  }
  polyline.push({
    key: startPointKey,
    point: startPoint.clone(),
  });

  while (currentSegmentIndex !== null) {
    visited.add(currentSegmentIndex);
    const currentSegment: DedupedSectionSegment = segments[currentSegmentIndex] as DedupedSectionSegment;
    const nextPointKey: string =
      currentSegment.startKey === currentPointKey
        ? currentSegment.endKey
        : currentSegment.startKey;
    const nextPoint = pointLookup.get(nextPointKey);
    if (!nextPoint) {
      break;
    }

    polyline.push({
      key: nextPointKey,
      point: nextPoint.clone(),
    });

    const connectedSegments: number[] = pointAdjacency.get(nextPointKey) ?? [];
    if (connectedSegments.length !== 2) {
      break;
    }

    const nextSegmentIndex: number | undefined = connectedSegments.find(
      (segmentIndex: number) =>
        segmentIndex !== currentSegmentIndex && !visited.has(segmentIndex),
    );
    if (nextSegmentIndex === undefined) {
      break;
    }

    currentPointKey = nextPointKey;
    currentSegmentIndex = nextSegmentIndex;

    if (currentPointKey === startPointKey) {
      break;
    }
  }

  return polyline;
}

function isCollinear(
  previous: THREE.Vector3,
  current: THREE.Vector3,
  next: THREE.Vector3,
) {
  const toCurrent = current.clone().sub(previous);
  const toNext = next.clone().sub(current);
  if (toCurrent.lengthSq() <= CLIPPING_EPSILON || toNext.lengthSq() <= CLIPPING_EPSILON) {
    return true;
  }

  const crossLengthSq = new THREE.Vector3()
    .crossVectors(toCurrent, toNext)
    .lengthSq();
  return crossLengthSq <= CLIPPING_EPSILON * CLIPPING_EPSILON && toCurrent.dot(toNext) > 0;
}

function simplifyPolyline(polyline: PolylineNode[]) {
  const isClosed =
    polyline.length > 3 && polyline[0]?.key === polyline[polyline.length - 1]?.key;
  let nodes = isClosed ? polyline.slice(0, -1) : [...polyline];
  if (nodes.length < (isClosed ? 3 : 2)) {
    return polyline;
  }

  let changed = true;
  while (changed) {
    changed = false;
    const nextNodes: PolylineNode[] = [];

    for (let index = 0; index < nodes.length; index += 1) {
      const isEndpoint = !isClosed && (index === 0 || index === nodes.length - 1);
      if (isEndpoint) {
        nextNodes.push(nodes[index] as PolylineNode);
        continue;
      }

      const previous = nodes[(index - 1 + nodes.length) % nodes.length];
      const current = nodes[index];
      const next = nodes[(index + 1) % nodes.length];
      if (!previous || !current || !next) {
        continue;
      }

      if (isCollinear(previous.point, current.point, next.point)) {
        changed = true;
        continue;
      }

      nextNodes.push(current);
    }

    if (nextNodes.length === nodes.length || nextNodes.length < (isClosed ? 3 : 2)) {
      break;
    }

    nodes = nextNodes;
  }

  return isClosed ? [...nodes, nodes[0] as PolylineNode] : nodes;
}

function flattenPolyline(polyline: PolylineNode[]) {
  const positions: number[] = [];

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const start = polyline[index];
    const end = polyline[index + 1];
    if (!start || !end) {
      continue;
    }
    positions.push(
      start.point.x,
      start.point.y,
      start.point.z,
      end.point.x,
      end.point.y,
      end.point.z,
    );
  }

  return positions;
}

export function buildSectionEdgePositions(
  topology: SectionTopology,
  worldMatrix: THREE.Matrix4,
  plane: THREE.Plane,
  offsetDistance: number,
  boundaryPlanes: THREE.Plane[] = [],
): SectionBuildResult {
  if (topology.triangles.length === 0 || topology.geometryBounds.isEmpty()) {
    return EMPTY_RESULT;
  }

  const inverseWorldMatrix = worldMatrix.clone().invert();
  const localPlane = plane.clone().applyMatrix4(inverseWorldMatrix);
  if (!localPlane.intersectsBox(topology.geometryBounds)) {
    return EMPTY_RESULT;
  }

  const stats: SectionBuildStats = {
    trianglesTested: 0,
    coplanarFaces: 0,
    rawSegments: 0,
    dedupedSegments: 0,
    stitchedLoops: 0,
    branchNodes: 0,
    droppedDegenerate: 0,
  };

  const pointA = new THREE.Vector3();
  const pointB = new THREE.Vector3();
  const pointC = new THREE.Vector3();
  const triangleBox = new THREE.Box3();
  const vertexCount = topology.vertexPositions.length / 3;
  const vertexDistances = new Float32Array(vertexCount);

  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    vertexDistances[vertexIndex] = localPlane.distanceToPoint(
      readTopologyPoint(topology.vertexPositions, vertexIndex, pointA),
    );
  }

  const rawSegments: RawSectionSegment[] = [];
  const coplanarFaces = new Set<number>();

  for (
    let triangleIndex = 0;
    triangleIndex < topology.triangles.length / 3;
    triangleIndex += 1
  ) {
    const boxOffset = triangleIndex * 6;
    triangleBox.min.set(
      topology.triangleBoxes[boxOffset] ?? 0,
      topology.triangleBoxes[boxOffset + 1] ?? 0,
      topology.triangleBoxes[boxOffset + 2] ?? 0,
    );
    triangleBox.max.set(
      topology.triangleBoxes[boxOffset + 3] ?? 0,
      topology.triangleBoxes[boxOffset + 4] ?? 0,
      topology.triangleBoxes[boxOffset + 5] ?? 0,
    );
    if (!localPlane.intersectsBox(triangleBox)) {
      continue;
    }

    const aIndex = topology.triangles[triangleIndex * 3] ?? 0;
    const bIndex = topology.triangles[triangleIndex * 3 + 1] ?? 0;
    const cIndex = topology.triangles[triangleIndex * 3 + 2] ?? 0;

    if (aIndex === bIndex || bIndex === cIndex || cIndex === aIndex) {
      stats.droppedDegenerate += 1;
      continue;
    }

    stats.trianglesTested += 1;

    const aDistance = vertexDistances[aIndex] ?? 0;
    const bDistance = vertexDistances[bIndex] ?? 0;
    const cDistance = vertexDistances[cIndex] ?? 0;
    const aCoplanar = Math.abs(aDistance) <= CLIPPING_EPSILON;
    const bCoplanar = Math.abs(bDistance) <= CLIPPING_EPSILON;
    const cCoplanar = Math.abs(cDistance) <= CLIPPING_EPSILON;

    if (aCoplanar && bCoplanar && cCoplanar) {
      coplanarFaces.add(triangleIndex);
      stats.coplanarFaces += 1;
      continue;
    }

    const allPositive =
      aDistance > CLIPPING_EPSILON &&
      bDistance > CLIPPING_EPSILON &&
      cDistance > CLIPPING_EPSILON;
    const allNegative =
      aDistance < -CLIPPING_EPSILON &&
      bDistance < -CLIPPING_EPSILON &&
      cDistance < -CLIPPING_EPSILON;
    if (allPositive || allNegative) {
      continue;
    }

    const sectionPoints = collectSegmentPoints(
      readTopologyPoint(topology.vertexPositions, aIndex, pointA),
      aDistance,
      readTopologyPoint(topology.vertexPositions, bIndex, pointB),
      bDistance,
      readTopologyPoint(topology.vertexPositions, cIndex, pointC),
      cDistance,
    );

    if (sectionPoints.length !== 2) {
      stats.droppedDegenerate += 1;
      continue;
    }

    rawSegments.push({
      start: sectionPoints[0].clone(),
      end: sectionPoints[1].clone(),
    });
    stats.rawSegments += 1;
  }

  for (const faceIndex of coplanarFaces) {
    for (let edgeOffset = 0; edgeOffset < 3; edgeOffset += 1) {
      const edgeKey = topology.triangleEdgeKeys[faceIndex * 3 + edgeOffset];
      if (!edgeKey) {
        continue;
      }

      const edge = topology.edges.get(edgeKey);
      if (!edge) {
        continue;
      }

      const coplanarNeighborCount = edge.faces.filter((candidateFace) =>
        coplanarFaces.has(candidateFace),
      ).length;
      if (coplanarNeighborCount !== 1) {
        continue;
      }

      rawSegments.push({
        start: readTopologyPoint(
          topology.vertexPositions,
          edge.a,
          new THREE.Vector3(),
        ).clone(),
        end: readTopologyPoint(
          topology.vertexPositions,
          edge.b,
          new THREE.Vector3(),
        ).clone(),
      });
      stats.rawSegments += 1;
    }
  }

  if (rawSegments.length === 0) {
    return {
      positions: [],
      closedLoops: [],
      stats,
    };
  }

  const offset = plane.normal.clone().multiplyScalar(-offsetDistance);
  const dedupedSegments: DedupedSectionSegment[] = [];
  const segmentKeys = new Set<string>();
  const pointLookup = new Map<string, THREE.Vector3>();

  for (const segment of rawSegments) {
    const worldStart = segment.start.clone().applyMatrix4(worldMatrix).add(offset);
    const worldEnd = segment.end.clone().applyMatrix4(worldMatrix).add(offset);
    const clippedSegment = clipSegmentToPlanes(worldStart, worldEnd, boundaryPlanes);
    if (!clippedSegment) {
      continue;
    }

    const clippedStart = clippedSegment.start;
    const clippedEnd = clippedSegment.end;
    const startKey = getQuantizedPointKey(clippedStart);
    const endKey = getQuantizedPointKey(clippedEnd);

    if (startKey === endKey) {
      stats.droppedDegenerate += 1;
      continue;
    }

    const segmentKey = getQuantizedSegmentKey(startKey, endKey);
    if (segmentKeys.has(segmentKey)) {
      continue;
    }

    segmentKeys.add(segmentKey);
    pointLookup.set(startKey, clippedStart);
    pointLookup.set(endKey, clippedEnd);
    dedupedSegments.push({
      start: clippedStart,
      end: clippedEnd,
      startKey,
      endKey,
    });
  }

  stats.dedupedSegments = dedupedSegments.length;
  if (dedupedSegments.length === 0) {
    return {
      positions: [],
      closedLoops: [],
      stats,
    };
  }

  const pointAdjacency = new Map<string, number[]>();
  dedupedSegments.forEach((segment, segmentIndex) => {
    const startSegments = pointAdjacency.get(segment.startKey) ?? [];
    startSegments.push(segmentIndex);
    pointAdjacency.set(segment.startKey, startSegments);

    const endSegments = pointAdjacency.get(segment.endKey) ?? [];
    endSegments.push(segmentIndex);
    pointAdjacency.set(segment.endKey, endSegments);
  });

  stats.branchNodes = [...pointAdjacency.values()].filter(
    (connectedSegments) => connectedSegments.length > 2,
  ).length;

  const visited = new Set<number>();
  const polylines: PolylineNode[][] = [];

  for (const [pointKey, connectedSegments] of pointAdjacency) {
    if (connectedSegments.length === 2) {
      continue;
    }

    for (const segmentIndex of connectedSegments) {
      if (visited.has(segmentIndex)) {
        continue;
      }
      const polyline = buildPolyline(
        segmentIndex,
        pointKey,
        pointAdjacency,
        pointLookup,
        dedupedSegments,
        visited,
      );
      if (polyline.length >= 2) {
        polylines.push(polyline);
      }
    }
  }

  for (let segmentIndex = 0; segmentIndex < dedupedSegments.length; segmentIndex += 1) {
    if (visited.has(segmentIndex)) {
      continue;
    }

    const polyline = buildPolyline(
      segmentIndex,
      dedupedSegments[segmentIndex]?.startKey ?? "",
      pointAdjacency,
      pointLookup,
      dedupedSegments,
      visited,
    );
    if (polyline.length >= 2) {
      polylines.push(polyline);
    }
  }

  const simplifiedPolylines = polylines.map((polyline) => simplifyPolyline(polyline));
  const positions = simplifiedPolylines.flatMap((polyline) => flattenPolyline(polyline));

  const closedLoops: SectionClosedLoop[] = [];
  for (const polyline of simplifiedPolylines) {
    if (
      polyline.length > 3 &&
      polyline[0]?.key === polyline[polyline.length - 1]?.key
    ) {
      closedLoops.push({
        points: polyline.slice(0, -1).map((n) => n.point.clone()),
      });
    }
  }

  stats.stitchedLoops = closedLoops.length;

  return {
    positions,
    closedLoops,
    stats,
  };
}

function clipSegmentToPlanes(
  start: THREE.Vector3,
  end: THREE.Vector3,
  planes: THREE.Plane[],
) {
  if (planes.length === 0) {
    return {
      start,
      end,
    };
  }

  const clippedStart = start.clone();
  const clippedEnd = end.clone();

  for (const plane of planes) {
    const startDistance = plane.distanceToPoint(clippedStart);
    const endDistance = plane.distanceToPoint(clippedEnd);
    const startOutside = startDistance > CLIPPING_EPSILON;
    const endOutside = endDistance > CLIPPING_EPSILON;

    if (startOutside && endOutside) {
      return null;
    }

    if (!startOutside && !endOutside) {
      continue;
    }

    const t = startDistance / (startDistance - endDistance);
    const intersection = clippedStart.clone().lerp(clippedEnd, t);

    if (startOutside) {
      clippedStart.copy(intersection);
    } else {
      clippedEnd.copy(intersection);
    }
  }

  if (clippedStart.distanceToSquared(clippedEnd) <= CLIPPING_EPSILON * CLIPPING_EPSILON) {
    return null;
  }

  return {
    start: clippedStart,
    end: clippedEnd,
  };
}
