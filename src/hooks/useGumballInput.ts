import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { SceneRefs } from "./useThreeScene";
import type {
  GumballComponents,
  GumballHandle,
  GumballHandleType,
} from "@/components/viewer/viewport/gumball";
import {
  applyGumballHandleState,
  clearGumballPreview,
  getGumballCurrentWorldScale,
  showAxisTranslationPreview,
  showPlaneTranslationPreview,
  showResizePreview,
  showRotationPreview,
} from "@/components/viewer/viewport/gumball";
import type {
  ClippingPlaneObject,
  ClippingInteractionKind,
} from "@/stores/slices/clippingSlice";
import type {
  ClippingPlaneWidgetVisual,
} from "@/components/viewer/viewport/clippingPlaneWidget";
import {
  buildAxisDragPlane,
  buildPlanarDragPlane,
  computeRotationAngle,
  projectAxisTranslationOffset,
  projectPlanarTranslationOffset,
  resizePlaneFromGumballHandle,
} from "@/components/viewer/viewport/gumballDragMath";

interface UseGumballInputActions {
  beginClippingInteraction: (
    planeId: string,
    kind: ClippingInteractionKind,
  ) => void;
  endClippingInteraction: () => void;
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

interface GumballDragState {
  handle: GumballHandle;
  planeId: string;
  interactionKind: ClippingInteractionKind;
  dragPlane: THREE.Plane;
  startPoint: THREE.Vector3;
  originalOrigin: THREE.Vector3;
  originalNormal: THREE.Vector3;
  originalUAxis: THREE.Vector3;
  originalVAxis: THREE.Vector3;
  originalWidth: number;
  originalHeight: number;
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
  const beginInteractionRef = useRef(actions.beginClippingInteraction);
  const endInteractionRef = useRef(actions.endClippingInteraction);
  const selectPlaneRef = useRef(actions.selectClippingPlane);
  const updateTransformRef = useRef(actions.updateClippingPlaneTransform);
  const resizePlaneRef = useRef(actions.resizeClippingPlane);

  useEffect(() => {
    selectedPlaneRef.current = selectedPlane;
  }, [selectedPlane]);

  useEffect(() => {
    beginInteractionRef.current = actions.beginClippingInteraction;
    endInteractionRef.current = actions.endClippingInteraction;
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
    let activeDrag: GumballDragState | null = null;

    function getPointerNdc(event: PointerEvent | MouseEvent) {
      const rect = domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      return pointer;
    }

    function getCurrentCamera() {
      return (refs.cameraRef.current ?? camera) as THREE.Camera;
    }

    function syncHandleVisualState() {
      const gumball = gumballRef.current;
      if (gumball) {
        applyGumballHandleState(
          gumball,
          hoveredHandle?.type ?? null,
          activeDrag?.handle.type ?? null,
        );
      }

      domElement.style.cursor = activeDrag
        ? "grabbing"
        : hoveredHandle?.cursor ?? "";
      refs.needsRenderRef.current = true;
    }

    function hitTestGumball(ndc: THREE.Vector2) {
      const gumball = gumballRef.current;
      if (!gumball) return null;

      raycaster.setFromCamera(ndc, getCurrentCamera());
      const intersections = raycaster.intersectObjects(gumball.hitTargets, true);
      const seen = new Set<GumballHandleType>();
      let bestHandle: GumballHandle | null = null;
      let bestDistance = Infinity;

      for (const intersection of intersections) {
        let object: THREE.Object3D | null = intersection.object;
        while (object) {
          const handleType = object.userData.gumballHandleType as GumballHandleType | undefined;
          if (handleType) {
            if (seen.has(handleType)) {
              break;
            }
            seen.add(handleType);
            const handle = gumball.handlesByType.get(handleType) ?? null;
            if (
              handle &&
              (!bestHandle ||
                handle.priority < bestHandle.priority ||
                (handle.priority === bestHandle.priority && intersection.distance < bestDistance))
            ) {
              bestHandle = handle;
              bestDistance = intersection.distance;
            }
            break;
          }
          object = object.parent;
        }
      }

      return bestHandle;
    }

    function hitTestPlaneWidgets(ndc: THREE.Vector2) {
      const bodies = [...planeVisualsRef.current.values()]
        .filter((visual) => visual.group.visible)
        .map((visual) => visual.bodyMesh);
      if (bodies.length === 0) return null;

      raycaster.setFromCamera(ndc, getCurrentCamera());
      const intersections = raycaster.intersectObjects(bodies, true);
      for (const intersection of intersections) {
        let object: THREE.Object3D | null = intersection.object;
        while (object) {
          const handleType = object.userData.clippingHandleType as "plane-body" | undefined;
          const planeId = object.userData.clippingPlaneId as string | undefined;
          const locked = Boolean(object.userData.clippingLocked);
          if (handleType === "plane-body" && planeId) {
            return { planeId, locked };
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
      if (!gumball || !handle.axis) return null;
      return handle.axis.clone().applyQuaternion(gumball.group.quaternion).normalize();
    }

    function getHandleWorldPlaneAxes(handle: GumballHandle) {
      const gumball = gumballRef.current;
      if (!gumball || !handle.planeAxes) return null;
      return handle.planeAxes.map((axis) =>
        axis.clone().applyQuaternion(gumball.group.quaternion).normalize(),
      ) as [THREE.Vector3, THREE.Vector3];
    }

    function beginDrag(
      handle: GumballHandle,
      plane: ClippingPlaneObject,
      ndc: THREE.Vector2,
    ) {
      const originalOrigin = tupleToVector3(plane.origin);
      const originalNormal = tupleToVector3(plane.normal).normalize();
      const originalUAxis = tupleToVector3(plane.uAxis).normalize();
      const originalVAxis = tupleToVector3(plane.vAxis).normalize();
      const currentCamera = getCurrentCamera();
      const cameraDirection = currentCamera.getWorldDirection(new THREE.Vector3());

      let dragPlane: THREE.Plane;
      let interactionKind: ClippingInteractionKind;

      if (handle.kind === "rotate") {
        const worldAxis = getHandleWorldAxis(handle);
        if (!worldAxis) return null;
        dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(worldAxis, originalOrigin);
        interactionKind = "rotate";
      } else if (handle.kind === "translate-axis") {
        const worldAxis = getHandleWorldAxis(handle);
        if (!worldAxis) return null;
        dragPlane = buildAxisDragPlane(originalOrigin, worldAxis, cameraDirection);
        interactionKind = "move";
      } else if (handle.kind === "translate-plane") {
        const planeAxes = getHandleWorldPlaneAxes(handle);
        if (!planeAxes) return null;
        dragPlane = buildPlanarDragPlane(originalOrigin, planeAxes[0], planeAxes[1]);
        interactionKind = "move";
      } else if (handle.kind === "translate-center") {
        dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDirection, originalOrigin);
        interactionKind = "move";
      } else {
        dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(originalNormal, originalOrigin);
        interactionKind = "resize";
      }

      const startPoint = intersectDragPlane(ndc, dragPlane);
      if (!startPoint) {
        return null;
      }

      return {
        handle,
        planeId: plane.id,
        interactionKind,
        dragPlane,
        startPoint: startPoint.clone(),
        originalOrigin,
        originalNormal,
        originalUAxis,
        originalVAxis,
        originalWidth: plane.width,
        originalHeight: plane.height,
      } satisfies GumballDragState;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;

      const plane = selectedPlaneRef.current;
      const ndc = getPointerNdc(event);

      const handle = hitTestGumball(ndc);
      if (handle && plane && !plane.locked) {
        const dragState = beginDrag(handle, plane, ndc);
        if (!dragState) {
          return;
        }

        event.stopImmediatePropagation();
        controls.enabled = false;
        activeDrag = dragState;
        hoveredHandle = handle;
        beginInteractionRef.current(plane.id, dragState.interactionKind);
        if (gumballRef.current) {
          clearGumballPreview(gumballRef.current);
        }
        syncHandleVisualState();
        return;
      }

      const widgetHit = hitTestPlaneWidgets(ndc);
      if (!widgetHit || widgetHit.locked) return;

      event.stopImmediatePropagation();
      selectPlaneRef.current(widgetHit.planeId);
      refs.needsRenderRef.current = true;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const ndc = getPointerNdc(event);

      if (activeDrag) {
        event.stopImmediatePropagation();
        const currentPoint = intersectDragPlane(ndc, activeDrag.dragPlane);
        if (!currentPoint) {
          return;
        }

        const gumball = gumballRef.current;
        const worldScale = gumball ? Math.max(getGumballCurrentWorldScale(gumball), 1e-6) : 1;
        const {
          handle,
          planeId,
          startPoint,
          originalOrigin,
          originalNormal,
          originalUAxis,
          originalVAxis,
          originalWidth,
          originalHeight,
        } = activeDrag;

        if (handle.kind === "rotate") {
          const worldAxis = getHandleWorldAxis(handle);
          if (!worldAxis) return;
          const angle = computeRotationAngle(
            originalOrigin,
            startPoint,
            currentPoint,
            worldAxis,
          );
          const rotation = new THREE.Quaternion().setFromAxisAngle(worldAxis, angle);
          updateTransformRef.current(planeId, {
            origin: vector3ToTuple(originalOrigin),
            normal: vector3ToTuple(originalNormal.clone().applyQuaternion(rotation).normalize()),
            uAxis: vector3ToTuple(originalUAxis.clone().applyQuaternion(rotation).normalize()),
            vAxis: vector3ToTuple(originalVAxis.clone().applyQuaternion(rotation).normalize()),
          });
          if (gumball && handle.axis) {
            showRotationPreview(gumball, handle.axis, angle, handle.highlightColor);
          }
        } else if (handle.kind === "translate-axis") {
          const worldAxis = getHandleWorldAxis(handle);
          if (!worldAxis) return;
          const offset = projectAxisTranslationOffset(startPoint, currentPoint, worldAxis);
          updateTransformRef.current(planeId, {
            origin: vector3ToTuple(originalOrigin.clone().addScaledVector(worldAxis, offset)),
            normal: vector3ToTuple(originalNormal),
            uAxis: vector3ToTuple(originalUAxis),
            vAxis: vector3ToTuple(originalVAxis),
          });
          if (gumball && handle.axis) {
            showAxisTranslationPreview(
              gumball,
              handle.axis,
              offset / worldScale,
              handle.highlightColor,
            );
          }
        } else if (handle.kind === "translate-plane") {
          const planeAxes = getHandleWorldPlaneAxes(handle);
          if (!planeAxes || !handle.planeAxes) return;
          const { offsetA, offsetB } = projectPlanarTranslationOffset(
            startPoint,
            currentPoint,
            planeAxes[0],
            planeAxes[1],
          );
          updateTransformRef.current(planeId, {
            origin: vector3ToTuple(
              originalOrigin
                .clone()
                .addScaledVector(planeAxes[0], offsetA)
                .addScaledVector(planeAxes[1], offsetB),
            ),
            normal: vector3ToTuple(originalNormal),
            uAxis: vector3ToTuple(originalUAxis),
            vAxis: vector3ToTuple(originalVAxis),
          });
          if (gumball) {
            showPlaneTranslationPreview(
              gumball,
              handle.planeAxes[0],
              handle.planeAxes[1],
              offsetA / worldScale,
              offsetB / worldScale,
              handle.highlightColor,
            );
          }
        } else if (handle.kind === "translate-center") {
          const delta = currentPoint.clone().sub(startPoint);
          updateTransformRef.current(planeId, {
            origin: vector3ToTuple(originalOrigin.clone().add(delta)),
            normal: vector3ToTuple(originalNormal),
            uAxis: vector3ToTuple(originalUAxis),
            vAxis: vector3ToTuple(originalVAxis),
          });
          if (gumball) {
            showPlaneTranslationPreview(
              gumball,
              new THREE.Vector3(1, 0, 0),
              new THREE.Vector3(0, 1, 0),
              delta.dot(originalUAxis) / worldScale,
              delta.dot(originalVAxis) / worldScale,
              handle.highlightColor,
            );
          }
        } else {
          const resized = resizePlaneFromGumballHandle(
            {
              origin: originalOrigin,
              uAxis: originalUAxis,
              vAxis: originalVAxis,
              normal: originalNormal,
              width: originalWidth,
              height: originalHeight,
            },
            handle.type,
            currentPoint,
            minPlaneSize,
          );

          updateTransformRef.current(planeId, {
            origin: vector3ToTuple(originalOrigin),
            normal: vector3ToTuple(originalNormal),
            uAxis: vector3ToTuple(originalUAxis),
            vAxis: vector3ToTuple(originalVAxis),
          });
          resizePlaneRef.current(planeId, resized);
          if (gumball) {
            showResizePreview(
              gumball,
              resized.width / Math.max(originalWidth, minPlaneSize),
              resized.height / Math.max(originalHeight, minPlaneSize),
              handle.highlightColor,
            );
          }
        }

        refs.needsRenderRef.current = true;
        return;
      }

      const nextHoveredHandle = hitTestGumball(ndc);
      if (nextHoveredHandle !== hoveredHandle) {
        hoveredHandle = nextHoveredHandle;
        syncHandleVisualState();
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (!activeDrag) return;
      event.stopImmediatePropagation();

      const gumball = gumballRef.current;
      if (gumball) {
        clearGumballPreview(gumball);
      }

      activeDrag = null;
      endInteractionRef.current();
      controls.enabled = true;
      hoveredHandle = hitTestGumball(getPointerNdc(event));
      syncHandleVisualState();
    };

    domElement.addEventListener("pointerdown", handlePointerDown, { capture: true });
    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true });

    return () => {
      domElement.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });

      domElement.style.cursor = "";
      const gumball = gumballRef.current;
      if (gumball) {
        clearGumballPreview(gumball);
        applyGumballHandleState(gumball, null, null);
      }
      if (activeDrag) {
        endInteractionRef.current();
        controls.enabled = true;
      }
    };
  }, [gumballRef, minPlaneSize, planeVisualsRef, refs, sceneGeneration]);
}
