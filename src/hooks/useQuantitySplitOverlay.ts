import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import type { QuantitySplitState } from "@/stores/slices/quantitySplitSlice";
import { markSelectionBlocked } from "@/components/viewer/viewport/selectionBlockers";
import type { SceneRefs } from "./useThreeScene";

const BOUNDS_LINE_COLOR = 0x666666;
const SPLIT_LINE_COLOR = 0x00bcd4;
const DRAWING_LINE_COLOR = 0xff9800;

function disposeGroupChildren(group: THREE.Group) {
  group.children.slice().forEach((child) => {
    group.remove(child);
    child.traverse((obj) => {
      const d = obj as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };
      d.geometry?.dispose();
      if (Array.isArray(d.material)) {
        d.material.forEach((m) => m.dispose());
      } else {
        d.material?.dispose();
      }
    });
  });
}

export function useQuantitySplitOverlay(
  refs: SceneRefs,
  sceneGeneration: number,
  quantitySplit: QuantitySplitState,
  splitPreviewEnd: [number, number] | null,
) {
  const groupRef = useRef<THREE.Group | null>(null);

  // Mount / unmount the overlay group
  useEffect(() => {
    const scene = refs.sceneRef.current;
    if (!scene) return;

    const group = markSelectionBlocked(new THREE.Group());
    group.name = "quantity-split-overlay";
    scene.add(group);
    groupRef.current = group;

    return () => {
      disposeGroupChildren(group);
      scene.remove(group);
      if (groupRef.current === group) groupRef.current = null;
    };
  }, [refs, sceneGeneration]);

  // Rebuild overlay whenever state changes
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    disposeGroupChildren(group);

    if (!quantitySplit.active || !quantitySplit.bounds) return;

    const { bounds, splitPlaneZ, lines, regions, drawingLine } = quantitySplit;
    const z = splitPlaneZ;

    // 1. Bounding rectangle (dashed lines)
    const boundsGeo = new THREE.BufferGeometry();
    const bl: [number, number, number] = [bounds.min[0], bounds.min[1], z];
    const br: [number, number, number] = [bounds.max[0], bounds.min[1], z];
    const tr: [number, number, number] = [bounds.max[0], bounds.max[1], z];
    const tl: [number, number, number] = [bounds.min[0], bounds.max[1], z];
    boundsGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [...bl, ...br, ...br, ...tr, ...tr, ...tl, ...tl, ...bl],
        3,
      ),
    );
    const boundsMat = new THREE.LineDashedMaterial({
      color: BOUNDS_LINE_COLOR,
      dashSize: 0.3,
      gapSize: 0.15,
      depthTest: false,
    });
    const boundsLine = new THREE.LineSegments(boundsGeo, boundsMat);
    boundsLine.computeLineDistances();
    boundsLine.renderOrder = 999;
    group.add(boundsLine);

    // 2. Region fill polygons (semi-transparent)
    for (const region of regions) {
      if (region.polygon.length < 3) continue;
      const shape = new THREE.Shape(
        region.polygon.map(([x, y]) => new THREE.Vector2(x, y)),
      );
      const fillGeo = new THREE.ShapeGeometry(shape);
      const fillMat = new THREE.MeshBasicMaterial({
        color: region.color,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
      });
      const fillMesh = new THREE.Mesh(fillGeo, fillMat);
      fillMesh.position.z = z;
      fillMesh.renderOrder = 998;
      group.add(fillMesh);
    }

    // 3. Committed split lines
    if (lines.length > 0) {
      const linePositions: number[] = [];
      for (const line of lines) {
        linePositions.push(line.start[0], line.start[1], z);
        linePositions.push(line.end[0], line.end[1], z);
      }
      const linesGeo = new THREE.BufferGeometry();
      linesGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(linePositions, 3),
      );
      const linesMat = new THREE.LineBasicMaterial({
        color: SPLIT_LINE_COLOR,
        depthTest: false,
        linewidth: 2,
      });
      const linesObj = new THREE.LineSegments(linesGeo, linesMat);
      linesObj.renderOrder = 1000;
      group.add(linesObj);
    }

    // 4. Drawing preview line
    if (drawingLine && splitPreviewEnd) {
      const previewGeo = new THREE.BufferGeometry();
      previewGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [
            drawingLine.start[0], drawingLine.start[1], z,
            splitPreviewEnd[0], splitPreviewEnd[1], z,
          ],
          3,
        ),
      );
      const previewMat = new THREE.LineDashedMaterial({
        color: DRAWING_LINE_COLOR,
        dashSize: 0.2,
        gapSize: 0.1,
        depthTest: false,
      });
      const previewLine = new THREE.LineSegments(previewGeo, previewMat);
      previewLine.computeLineDistances();
      previewLine.renderOrder = 1001;
      group.add(previewLine);
    }

    // 5. Start point marker
    if (drawingLine) {
      const markerGeo = new THREE.SphereGeometry(0.15, 8, 8);
      const markerMat = new THREE.MeshBasicMaterial({
        color: DRAWING_LINE_COLOR,
        depthTest: false,
      });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(drawingLine.start[0], drawingLine.start[1], z);
      marker.renderOrder = 1002;
      group.add(marker);
    }

    refs.needsRenderRef.current = true;
  }, [quantitySplit, splitPreviewEnd, refs]);
}
