import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import type { MeasurementState } from "@/stores/slices/toolsSlice";
import type { RaycastHit } from "@/components/viewer/viewport/raycasting";
import {
  calculateMeasurementMarkerRadius,
  resolveMeasurementPreviewPoint,
} from "@/components/viewer/viewport/viewportSceneUtils";
import { markSelectionBlocked } from "@/components/viewer/viewport/selectionBlockers";
import type { SceneRefs } from "./useThreeScene";

export function useMeasurementOverlay(
  refs: SceneRefs,
  sceneGeneration: number,
  modelBounds: [number, number, number, number, number, number],
  measurement: MeasurementState,
  measurementPreview: RaycastHit | null,
) {
  const measurementGroupRef = useRef<THREE.Group | null>(null);

  const disposeGroupChildren = useCallback((group: THREE.Group) => {
    group.children.slice().forEach((child) => {
      group.remove(child);
      child.traverse((object) => {
        const disposable = object as THREE.Object3D & {
          geometry?: THREE.BufferGeometry;
          material?: THREE.Material | THREE.Material[];
        };
        disposable.geometry?.dispose();
        if (Array.isArray(disposable.material)) {
          disposable.material.forEach((material) => material.dispose());
        } else {
          disposable.material?.dispose();
        }
      });
    });
  }, []);

  useEffect(() => {
    const scene = refs.sceneRef.current;
    if (!scene) return;

    const measurementGroup = markSelectionBlocked(new THREE.Group());
    measurementGroup.name = "measurement-overlay";
    scene.add(measurementGroup);
    measurementGroupRef.current = measurementGroup;

    return () => {
      disposeGroupChildren(measurementGroup);
      scene.remove(measurementGroup);
      if (measurementGroupRef.current === measurementGroup) {
        measurementGroupRef.current = null;
      }
    };
  }, [disposeGroupChildren, refs, sceneGeneration]);

  useEffect(() => {
    const measurementGroup = measurementGroupRef.current;
    if (!measurementGroup) return;

    disposeGroupChildren(measurementGroup);

    if (!measurement.start) {
      refs.needsRenderRef.current = true;
      return;
    }

    const startPoint = new THREE.Vector3(...measurement.start.point);
    const markerRadius = calculateMeasurementMarkerRadius(modelBounds);

    const addMarker = (point: THREE.Vector3, color: string) => {
      const geometry = new THREE.SphereGeometry(markerRadius, 18, 14);
      const material = new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
      });
      const marker = new THREE.Mesh(geometry, material);
      marker.position.copy(point);
      marker.renderOrder = 1000;
      measurementGroup.add(marker);
    };

    addMarker(startPoint, "#f97316");

    const previewPoint = resolveMeasurementPreviewPoint(
      measurement,
      measurementPreview,
    );

    if (previewPoint) {
      addMarker(previewPoint, "#38bdf8");

      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        startPoint,
        previewPoint,
      ]);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: "#2563eb",
        depthTest: false,
        transparent: true,
        opacity: 0.95,
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      line.renderOrder = 999;
      measurementGroup.add(line);
    }

    refs.needsRenderRef.current = true;
  }, [disposeGroupChildren, measurement, measurementPreview, modelBounds, refs]);
}
