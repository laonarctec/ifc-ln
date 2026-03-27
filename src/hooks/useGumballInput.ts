import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { SceneRefs } from "./useThreeScene";
import type {
  GumballComponents,
  GumballHandle,
  GumballHandleType,
} from "@/components/viewer/viewport/gumball";
import { highlightHandle } from "@/components/viewer/viewport/gumball";
import type {
  ClippingPlaneObject,
} from "@/stores/slices/clippingSlice";
import type {
  ClippingPlaneWidgetVisual,
} from "@/components/viewer/viewport/clippingPlaneWidget";
import {
  resizePlaneFromHandle,
  type ResizeHandleType,
} from "@/components/viewer/viewport/clippingMath";

interface UseGumballInputActions {
  selectClippingPlane: (planeId: string | null) => void;
  updateClippingPlaneTransform: (
    planeId: string,
    transform: Pick<ClippingPlaneObject, "origin" | "normal" | "uAxis" | "vAxis">,
  ) => void;
  resizeClippingPlane: (
    planeId: string,
    size: Pick<ClippingPlaneObject, "width" | "height">,
  ) => void;
}

function tupleToVector3(value: [number, number, number]) {
  return new THREE.Vector3(...value);
}

function vector3ToTuple(value: THREE.Vector3): [number, number, number] {
  return [value.x, value.y, value.z];
}

export function useGumballInput(
  refs: SceneRefs,
  planeVisualsRef: React.MutableRefObject<Map<string, ClippingPlaneWidgetVisual>>,
  gumballRef: React.MutableRefObject<GumballComponents | null>,
  selectedPlane: ClippingPlaneObject | null,
  actions: UseGumballInputActions,
  minPlaneSize: number,
  sceneGeneration: number,
) {
  const selectedPlaneRef = useRef<ClippingPlaneObject | null>(selectedPlane);
  const selectPlaneRef = useRef(actions.selectClippingPlane);
  const updateTransformRef = useRef(actions.updateClippingPlaneTransform);
  const resizePlaneRef = useRef(actions.resizeClippingPlane);

  useEffect(() => {
    selectedPlaneRef.current = selectedPlane;
  }, [selectedPlane]);

  useEffect(() => {
    selectPlaneRef.current = actions.selectClippingPlane;
    updateTransformRef.current = actions.updateClippingPlaneTransform;
    resizePlaneRef.current = actions.resizeClippingPlane;
  }, [actions]);

  useEffect(() => {
    const renderer = refs.rendererRef.current;
    const camera = refs.cameraRef.current;
    const controls = refs.controlsRef.current;
    if (!renderer || !camera || !controls) return;

    const domElement = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    let hoveredHandle: GumballHandle | null = null;
    let activeHandle: GumballHandle | null = null;
    let activeResizeHandle: ResizeHandleType | null = null;
    let dragPlane = new THREE.Plane();
    const dragStartPoint = new THREE.Vector3();
    const originalOrigin = new THREE.Vector3();
    const originalNormal = new THREE.Vector3();
    const originalUAxis = new THREE.Vector3();
    const originalVAxis = new THREE.Vector3();
    let originalWidth = 0;
    let originalHeight = 0;
    let draggingPlaneId: string | null = null;

    function getPointerNdc(event: PointerEvent | MouseEvent) {
      const rect = domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      return pointer;
    }

    function getCurrentCamera() {
      return (refs.cameraRef.current ?? camera) as THREE.Camera;
    }

    function hitTestGumball(ndc: THREE.Vector2) {
      const gumball = gumballRef.current;
      if (!gumball) return null;

      raycaster.setFromCamera(ndc, getCurrentCamera());
      const intersects = raycaster.intersectObjects(gumball.group.children, true);

      for (const intersection of intersects) {
        let object: THREE.Object3D | null = intersection.object;
        while (object) {
          const handleType = object.userData.gumballHandleType as GumballHandleType | undefined;
          if (handleType) {
            return gumball.handles.find((handle) => handle.type === handleType) ?? null;
          }
          object = object.parent;
        }
      }

      return null;
    }

    function hitTestPlaneWidgets(ndc: THREE.Vector2) {
      const visuals = [...planeVisualsRef.current.values()]
        .filter((visual) => visual.group.visible)
        .map((visual) => visual.group);
      if (visuals.length === 0) return null;

      raycaster.setFromCamera(ndc, getCurrentCamera());
      const intersections = raycaster.intersectObjects(visuals, true);
      for (const intersection of intersections) {
        let object: THREE.Object3D | null = intersection.object;
        while (object) {
          const handleType = object.userData.clippingHandleType as
            | "plane-body"
            | ResizeHandleType
            | undefined;
          const planeId = object.userData.clippingPlaneId as string | undefined;
          const locked = Boolean(object.userData.clippingLocked);
          if (handleType && planeId) {
            return { handleType, planeId, locked };
          }
          object = object.parent;
        }
      }
      return null;
    }

    function intersectDragPlane(ndc: THREE.Vector2, plane: THREE.Plane) {
      raycaster.setFromCamera(ndc, getCurrentCamera());
      const target = new THREE.Vector3();
      return raycaster.ray.intersectPlane(plane, target) ? target : null;
    }

    function getHandleWorldAxis(handle: GumballHandle) {
      const gumball = gumballRef.current;
      if (!gumball) return handle.axis.clone();
      return handle.axis.clone().applyQuaternion(gumball.group.quaternion).normalize();
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;

      const plane = selectedPlaneRef.current;
      const ndc = getPointerNdc(event);

      const handle = hitTestGumball(ndc);
      if (handle && plane && !plane.locked) {
        event.stopImmediatePropagation();
        controls.enabled = false;
        activeHandle = handle;
        draggingPlaneId = plane.id;

        originalOrigin.copy(tupleToVector3(plane.origin));
        originalNormal.copy(tupleToVector3(plane.normal)).normalize();
        originalUAxis.copy(tupleToVector3(plane.uAxis)).normalize();
        originalVAxis.copy(tupleToVector3(plane.vAxis)).normalize();

        const worldAxis = getHandleWorldAxis(handle);
        const isRotation = handle.type.startsWith("rotate-");

        if (isRotation) {
          dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(worldAxis, originalOrigin);
        } else {
          const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
          dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
            cameraDirection,
            originalOrigin,
          );
        }

        const startPoint = intersectDragPlane(ndc, dragPlane);
        if (startPoint) {
          dragStartPoint.copy(startPoint);
        }
        return;
      }

      const widgetHit = hitTestPlaneWidgets(ndc);
      if (!widgetHit || widgetHit.locked) return;

      if (widgetHit.handleType === "plane-body") {
        event.stopImmediatePropagation();
        selectPlaneRef.current(widgetHit.planeId);
        refs.needsRenderRef.current = true;
        return;
      }

      const activePlane = selectedPlaneRef.current;
      if (!activePlane || activePlane.id !== widgetHit.planeId) {
        event.stopImmediatePropagation();
        selectPlaneRef.current(widgetHit.planeId);
        refs.needsRenderRef.current = true;
        return;
      }

      event.stopImmediatePropagation();
      controls.enabled = false;
      activeResizeHandle = widgetHit.handleType;
      draggingPlaneId = activePlane.id;
      originalOrigin.copy(tupleToVector3(activePlane.origin));
      originalNormal.copy(tupleToVector3(activePlane.normal)).normalize();
      originalUAxis.copy(tupleToVector3(activePlane.uAxis)).normalize();
      originalVAxis.copy(tupleToVector3(activePlane.vAxis)).normalize();
      originalWidth = activePlane.width;
      originalHeight = activePlane.height;
      dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        originalNormal,
        originalOrigin,
      );
    };

    const handlePointerMove = (event: PointerEvent) => {
      const ndc = getPointerNdc(event);

      if (activeHandle && draggingPlaneId) {
        event.stopImmediatePropagation();
        const currentPoint = intersectDragPlane(ndc, dragPlane);
        if (!currentPoint) return;

        if (activeHandle.type.startsWith("rotate-")) {
          const center = originalOrigin.clone();
          const startDirection = dragStartPoint.clone().sub(center).normalize();
          const currentDirection = currentPoint.clone().sub(center).normalize();
          if (startDirection.lengthSq() < 1e-8 || currentDirection.lengthSq() < 1e-8) {
            return;
          }

          const worldAxis = getHandleWorldAxis(activeHandle);
          let angle = Math.acos(THREE.MathUtils.clamp(startDirection.dot(currentDirection), -1, 1));
          const cross = new THREE.Vector3().crossVectors(startDirection, currentDirection);
          if (cross.dot(worldAxis) < 0) angle = -angle;

          const rotation = new THREE.Quaternion().setFromAxisAngle(worldAxis, angle);
          updateTransformRef.current(draggingPlaneId, {
            origin: vector3ToTuple(originalOrigin),
            normal: vector3ToTuple(originalNormal.clone().applyQuaternion(rotation).normalize()),
            uAxis: vector3ToTuple(originalUAxis.clone().applyQuaternion(rotation).normalize()),
            vAxis: vector3ToTuple(originalVAxis.clone().applyQuaternion(rotation).normalize()),
          });
        } else {
          const delta = currentPoint.clone().sub(dragStartPoint);
          const offset = delta.dot(getHandleWorldAxis(activeHandle));
          updateTransformRef.current(draggingPlaneId, {
            origin: vector3ToTuple(
              originalOrigin.clone().addScaledVector(getHandleWorldAxis(activeHandle), offset),
            ),
            normal: vector3ToTuple(originalNormal),
            uAxis: vector3ToTuple(originalUAxis),
            vAxis: vector3ToTuple(originalVAxis),
          });
        }

        refs.needsRenderRef.current = true;
        return;
      }

      if (activeResizeHandle && draggingPlaneId) {
        event.stopImmediatePropagation();
        const worldPoint = intersectDragPlane(ndc, dragPlane);
        if (!worldPoint) return;

        const resized = resizePlaneFromHandle(
          {
            origin: vector3ToTuple(originalOrigin),
            uAxis: vector3ToTuple(originalUAxis),
            vAxis: vector3ToTuple(originalVAxis),
            width: originalWidth,
            height: originalHeight,
          },
          activeResizeHandle,
          worldPoint,
          minPlaneSize,
        );

        updateTransformRef.current(draggingPlaneId, {
          origin: resized.origin,
          normal: vector3ToTuple(originalNormal),
          uAxis: vector3ToTuple(originalUAxis),
          vAxis: vector3ToTuple(originalVAxis),
        });
        resizePlaneRef.current(draggingPlaneId, {
          width: resized.width,
          height: resized.height,
        });
        refs.needsRenderRef.current = true;
        return;
      }

      const nextHoveredHandle = hitTestGumball(ndc);
      if (nextHoveredHandle !== hoveredHandle) {
        if (hoveredHandle) highlightHandle(hoveredHandle, false);
        if (nextHoveredHandle) highlightHandle(nextHoveredHandle, true);
        hoveredHandle = nextHoveredHandle;
        refs.needsRenderRef.current = true;
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (!activeHandle && !activeResizeHandle) return;
      event.stopImmediatePropagation();
      activeHandle = null;
      activeResizeHandle = null;
      draggingPlaneId = null;
      controls.enabled = true;
      refs.needsRenderRef.current = true;
    };

    domElement.addEventListener("pointerdown", handlePointerDown, { capture: true });
    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true });

    return () => {
      domElement.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });

      if (hoveredHandle) highlightHandle(hoveredHandle, false);
      if (activeHandle || activeResizeHandle) {
        controls.enabled = true;
      }
    };
  }, [gumballRef, minPlaneSize, planeVisualsRef, refs, sceneGeneration]);
}
