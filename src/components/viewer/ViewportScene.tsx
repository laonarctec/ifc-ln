import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
    acceleratedRaycast,
    computeBoundsTree,
    disposeBoundsTree,
} from "three-mesh-bvh";
import { useViewerStore } from "@/stores";
import type {
    ViewportCommand,
    ViewportProjectionMode,
} from "@/stores/slices/uiSlice";
import type {
    RenderChunkPayload,
    RenderManifest,
    TransferableMeshData,
} from "@/types/worker-messages";
import type { AxisHelperRef } from "./AxisHelper";
import { ViewportOverlays } from "./ViewportOverlays";
import type { ViewCubeRef } from "./ViewCube";

interface ViewportSceneProps {
    manifest: RenderManifest;
    residentChunks: RenderChunkPayload[];
    chunkVersion: number;
    selectedEntityIds: number[];
    hiddenEntityIds: number[];
    projectionMode: ViewportProjectionMode;
    viewportCommand: ViewportCommand;
    onSelectEntity: (expressId: number | null, additive?: boolean) => void;
    onVisibleChunkIdsChange: (chunkIds: number[]) => void;
    onHoverEntity?: (
        expressId: number | null,
        position: { x: number; y: number } | null,
    ) => void;
    onContextMenu?: (
        expressId: number | null,
        position: { x: number; y: number },
    ) => void;
}

interface GeometryCacheEntry {
    geometry: THREE.BufferGeometry;
    refCount: number;
}

interface RenderEntry {
    expressId: number;
    object: THREE.Mesh | THREE.InstancedMesh;
    baseColor: THREE.Color;
    baseOpacity: number;
    instanceIndex: number | null;
    baseMatrix: THREE.Matrix4;
}

interface ChunkRenderGroup {
    group: THREE.Group;
    entries: RenderEntry[];
    materials: THREE.Material[];
}

interface InstanceGroup {
    key: string;
    items: TransferableMeshData[];
}

type ViewCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera;

const HIDDEN_SCALE_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

const bvhExtensions = THREE.BufferGeometry.prototype as THREE.BufferGeometry & {
    computeBoundsTree?: typeof computeBoundsTree;
    disposeBoundsTree?: typeof disposeBoundsTree;
};

if (bvhExtensions.computeBoundsTree !== computeBoundsTree) {
    bvhExtensions.computeBoundsTree = computeBoundsTree;
    bvhExtensions.disposeBoundsTree = disposeBoundsTree;
    THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

function getCameraAspect(camera: ViewCamera) {
    if (camera instanceof THREE.PerspectiveCamera) {
        return camera.aspect;
    }

    const height = Math.max(camera.top - camera.bottom, 0.0001);
    return Math.max((camera.right - camera.left) / height, 0.0001);
}

function setCameraAspect(camera: ViewCamera, aspect: number) {
    if (camera instanceof THREE.PerspectiveCamera) {
        camera.aspect = aspect;
        return;
    }

    camera.userData.viewportAspect = aspect;
}

function getWebGLBlockReason() {
    const canvas = document.createElement("canvas");
    const webgl2Context = canvas.getContext("webgl2");
    const releaseContext = (
        context: WebGLRenderingContext | WebGL2RenderingContext | null,
    ) => {
        context?.getExtension("WEBGL_lose_context")?.loseContext();
    };
    if (webgl2Context) {
        releaseContext(webgl2Context);
        return null;
    }

    const webglContext =
        canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");

    if (webglContext) {
        releaseContext(webglContext as WebGLRenderingContext);
        return null;
    }

    return "현재 브라우저 또는 실행 환경에서 WebGL이 비활성화되어 있습니다.";
}

function createRenderableGeometry(mesh: TransferableMeshData) {
    const stride = 6;
    const vertexCount = Math.floor(mesh.vertices.length / stride);
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);

    for (let i = 0; i < vertexCount; i += 1) {
        const sourceIndex = i * stride;
        const targetIndex = i * 3;

        positions[targetIndex] = mesh.vertices[sourceIndex];
        positions[targetIndex + 1] = mesh.vertices[sourceIndex + 1];
        positions[targetIndex + 2] = mesh.vertices[sourceIndex + 2];

        normals[targetIndex] = mesh.vertices[sourceIndex + 3] ?? 0;
        normals[targetIndex + 1] = mesh.vertices[sourceIndex + 4] ?? 1;
        normals[targetIndex + 2] = mesh.vertices[sourceIndex + 5] ?? 0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    (
        geometry as THREE.BufferGeometry & {
            computeBoundsTree?: (options?: object) => unknown;
        }
    ).computeBoundsTree?.({
        maxLeafSize: 24,
    });
    return geometry;
}

function getOrCreateGeometry(
    mesh: TransferableMeshData,
    geometryCache: Map<number, GeometryCacheEntry>,
) {
    const cached = geometryCache.get(mesh.geometryExpressId);
    if (cached) {
        cached.refCount += 1;
        return cached.geometry;
    }

    const geometry = createRenderableGeometry(mesh);
    geometryCache.set(mesh.geometryExpressId, {
        geometry,
        refCount: 1,
    });
    return geometry;
}

function updateOrthographicFrustum(
    camera: THREE.OrthographicCamera,
    halfHeight: number,
) {
    const safeHalfHeight = Math.max(halfHeight, 0.5);
    const aspect = Math.max(
        camera.userData.viewportAspect ?? getCameraAspect(camera),
        0.0001,
    );
    const halfWidth = safeHalfHeight * aspect;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = safeHalfHeight;
    camera.bottom = -safeHalfHeight;
}

function boundsFromTuple(
    bounds: [number, number, number, number, number, number],
) {
    return new THREE.Box3(
        new THREE.Vector3(bounds[0], bounds[1], bounds[2]),
        new THREE.Vector3(bounds[3], bounds[4], bounds[5]),
    );
}

function fitCameraToBounds(
    camera: ViewCamera,
    controls: OrbitControls,
    bounds: THREE.Box3,
) {
    fitCameraToBoundsWithDirection(
        camera,
        controls,
        bounds,
        new THREE.Vector3(1, 0.75, 1),
    );
}

function fitCameraToBoundsWithDirection(
    camera: ViewCamera,
    controls: OrbitControls,
    bounds: THREE.Box3,
    direction: THREE.Vector3,
) {
    if (bounds.isEmpty()) {
        camera.position.set(12, 10, 12);
        controls.target.set(0, 0, 0);
        if (camera instanceof THREE.OrthographicCamera) {
            updateOrthographicFrustum(camera, 12);
            camera.zoom = 1;
        }
        controls.update();
        camera.updateProjectionMatrix();
        return;
    }

    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    const normalizedDirection = direction.clone().normalize();

    if (camera instanceof THREE.PerspectiveCamera) {
        const fitHeightDistance =
            maxDimension / (2 * Math.tan((Math.PI * camera.fov) / 360));
        const fitWidthDistance = fitHeightDistance / camera.aspect;
        const distance = 1.18 * Math.max(fitHeightDistance, fitWidthDistance);

        camera.near = Math.max(distance / 100, 0.1);
        camera.far = Math.max(distance * 120, 2400);
        camera.position
            .copy(center)
            .addScaledVector(normalizedDirection, distance);
        camera.lookAt(center);
        camera.updateProjectionMatrix();

        controls.target.copy(center);
        controls.minDistance = Math.max(distance * 0.08, 0.2);
        controls.maxDistance = distance * 12;
        controls.update();
        return;
    }

    const distance = Math.max(maxDimension * 2.4, 24);
    camera.position.copy(center).addScaledVector(normalizedDirection, distance);
    camera.near = 0.1;
    camera.far = Math.max(distance * 24, 2400);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();

    camera.updateMatrixWorld(true);
    const inverseMatrix = camera.matrixWorldInverse.clone();
    const corners = [
        new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
        new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
        new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
        new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
        new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
        new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
        new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
        new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
    ];

    let maxX = 0;
    let maxY = 0;
    for (const corner of corners) {
        corner.applyMatrix4(inverseMatrix);
        maxX = Math.max(maxX, Math.abs(corner.x));
        maxY = Math.max(maxY, Math.abs(corner.y));
    }

    const halfHeight = Math.max(
        maxY * 1.18,
        (maxX * 1.18) / getCameraAspect(camera),
        0.5,
    );
    updateOrthographicFrustum(camera, halfHeight);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.minDistance = Math.max(distance * 0.08, 0.2);
    controls.maxDistance = distance * 12;
    controls.update();
}

function colorKey(mesh: TransferableMeshData) {
    return mesh.color.map((value) => value.toFixed(4)).join(":");
}

function groupMeshes(meshes: TransferableMeshData[]) {
    const grouped = new Map<string, InstanceGroup>();

    for (const mesh of meshes) {
        if (mesh.vertices.length < 6 || mesh.indices.length === 0) {
            continue;
        }

        const key = `${mesh.geometryExpressId}:${colorKey(mesh)}`;
        const existing = grouped.get(key);
        if (existing) {
            existing.items.push(mesh);
            continue;
        }

        grouped.set(key, {
            key,
            items: [mesh],
        });
    }

    return [...grouped.values()];
}

function indexRenderEntry(
    entryIndex: Map<number, RenderEntry[]>,
    entry: RenderEntry,
) {
    const existing = entryIndex.get(entry.expressId);
    if (existing) {
        existing.push(entry);
        return;
    }

    entryIndex.set(entry.expressId, [entry]);
}

function removeIndexedRenderEntry(
    entryIndex: Map<number, RenderEntry[]>,
    entry: RenderEntry,
) {
    const existing = entryIndex.get(entry.expressId);
    if (!existing) {
        return;
    }

    const filtered = existing.filter((candidate) => candidate !== entry);
    if (filtered.length === 0) {
        entryIndex.delete(entry.expressId);
        return;
    }

    entryIndex.set(entry.expressId, filtered);
}

function setEntryVisualState(
    entry: RenderEntry,
    isHidden: boolean,
    isSelected: boolean,
) {
    if (entry.object instanceof THREE.InstancedMesh) {
        const targetMatrix = isHidden ? HIDDEN_SCALE_MATRIX : entry.baseMatrix;
        entry.object.setMatrixAt(entry.instanceIndex ?? 0, targetMatrix);

        const color = entry.baseColor.clone();
        if (isSelected) {
            color.lerp(new THREE.Color("#88ccff"), 0.45);
        }
        entry.object.setColorAt(entry.instanceIndex ?? 0, color);
        entry.object.instanceMatrix.needsUpdate = true;
        if (entry.object.instanceColor) {
            entry.object.instanceColor.needsUpdate = true;
        }
        return;
    }

    const material = entry.object.material;
    if (!(material instanceof THREE.MeshPhongMaterial)) {
        return;
    }

    entry.object.visible = !isHidden;
    material.color.copy(entry.baseColor);
    material.opacity = entry.baseOpacity;
    material.transparent = entry.baseOpacity < 1;
    material.emissive.setRGB(
        isSelected ? 0.3 : 0,
        isSelected ? 0.6 : 0,
        isSelected ? 1.0 : 0,
    );
    material.emissiveIntensity = isSelected ? 0.6 : 0;

    if (isSelected) {
        material.color.lerp(new THREE.Color("#ffffff"), 0.4);
        material.opacity = 1;
        material.transparent = false;
    }
}

function appendMeshesToGroup(
    meshes: TransferableMeshData[],
    group: THREE.Group,
    geometryCache: Map<number, GeometryCacheEntry>,
    entryIndex: Map<number, RenderEntry[]>,
    selectedEntityIds: number[],
    hiddenEntityIds: number[],
) {
    const hiddenSet = new Set(hiddenEntityIds);
    const selectedSet = new Set(selectedEntityIds);
    const entries: RenderEntry[] = [];
    const materials: THREE.Material[] = [];

    for (const instanceGroup of groupMeshes(meshes)) {
        const [first] = instanceGroup.items;
        const geometry = getOrCreateGeometry(first, geometryCache);
        const baseColor = new THREE.Color(
            first.color[0],
            first.color[1],
            first.color[2],
        );
        const baseOpacity = first.color[3];

        if (instanceGroup.items.length === 1) {
            const material = new THREE.MeshPhongMaterial({
                color: baseColor.clone(),
                transparent: baseOpacity < 1,
                opacity: baseOpacity,
                shininess: 30,
                side: THREE.FrontSide,
            });
            materials.push(material);

            const object = new THREE.Mesh(geometry, material);
            object.matrixAutoUpdate = false;
            object.matrix.fromArray(first.transform);
            object.userData.expressId = first.expressId;
            group.add(object);

            const entry: RenderEntry = {
                expressId: first.expressId,
                object,
                baseColor,
                baseOpacity,
                instanceIndex: null,
                baseMatrix: object.matrix.clone(),
            };
            setEntryVisualState(
                entry,
                hiddenSet.has(first.expressId),
                selectedSet.has(first.expressId),
            );
            entries.push(entry);
            indexRenderEntry(entryIndex, entry);
            continue;
        }

        const material = new THREE.MeshPhongMaterial({
            color: "#ffffff",
            transparent: baseOpacity < 1,
            opacity: baseOpacity,
            shininess: 30,
            side: THREE.FrontSide,
        });
        materials.push(material);

        const instancedMesh = new THREE.InstancedMesh(
            geometry,
            material,
            instanceGroup.items.length,
        );
        instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        instancedMesh.userData.instanceExpressIds = instanceGroup.items.map(
            (item) => item.expressId,
        );

        instanceGroup.items.forEach((item, index) => {
            const matrix = new THREE.Matrix4().fromArray(item.transform);
            const itemColor = new THREE.Color(
                item.color[0],
                item.color[1],
                item.color[2],
            );
            instancedMesh.setMatrixAt(index, matrix);
            instancedMesh.setColorAt(index, itemColor);

            const entry: RenderEntry = {
                expressId: item.expressId,
                object: instancedMesh,
                baseColor: itemColor,
                baseOpacity,
                instanceIndex: index,
                baseMatrix: matrix,
            };
            setEntryVisualState(
                entry,
                hiddenSet.has(item.expressId),
                selectedSet.has(item.expressId),
            );
            entries.push(entry);
            indexRenderEntry(entryIndex, entry);
        });

        instancedMesh.instanceMatrix.needsUpdate = true;
        if (instancedMesh.instanceColor) {
            instancedMesh.instanceColor.needsUpdate = true;
        }
        group.add(instancedMesh);
    }

    return { entries, materials };
}

function updateMeshVisualState(
    entryIndex: Map<number, RenderEntry[]>,
    previousSelectedSet: Set<number>,
    previousHiddenSet: Set<number>,
    selectedEntityIds: number[],
    hiddenEntityIds: number[],
) {
    const currentSelectedSet = new Set(selectedEntityIds);
    const currentHiddenSet = new Set(hiddenEntityIds);
    const changedEntityIds = new Set<number>();

    previousSelectedSet.forEach((entityId) => {
        if (!currentSelectedSet.has(entityId)) {
            changedEntityIds.add(entityId);
        }
    });
    currentSelectedSet.forEach((entityId) => {
        if (!previousSelectedSet.has(entityId)) {
            changedEntityIds.add(entityId);
        }
    });

    previousHiddenSet.forEach((entityId) => {
        if (!currentHiddenSet.has(entityId)) {
            changedEntityIds.add(entityId);
        }
    });
    currentHiddenSet.forEach((entityId) => {
        if (!previousHiddenSet.has(entityId)) {
            changedEntityIds.add(entityId);
        }
    });

    changedEntityIds.forEach((entityId) => {
        entryIndex.get(entityId)?.forEach((entry) => {
            setEntryVisualState(
                entry,
                currentHiddenSet.has(entityId),
                currentSelectedSet.has(entityId),
            );
        });
    });

    return {
        currentSelectedSet,
        currentHiddenSet,
    };
}

function expandBoundsForEntry(bounds: THREE.Box3, entry: RenderEntry) {
    const geometryBounds = entry.object.geometry.boundingBox;
    if (!geometryBounds) {
        return;
    }

    const transformedBounds = geometryBounds
        .clone()
        .applyMatrix4(entry.baseMatrix);
    bounds.union(transformedBounds);
}

function buildBoundsForEntries(
    meshEntries: RenderEntry[],
    hiddenEntityIds: number[] = [],
) {
    const hiddenSet = new Set(hiddenEntityIds);
    const bounds = new THREE.Box3();

    meshEntries.forEach((entry) => {
        if (hiddenSet.has(entry.expressId)) {
            return;
        }

        expandBoundsForEntry(bounds, entry);
    });

    if (!bounds.isEmpty()) {
        return bounds;
    }

    meshEntries.forEach((entry) => {
        expandBoundsForEntry(bounds, entry);
    });

    return bounds;
}

function formatScaleLabel(worldSize: number) {
    if (worldSize >= 1000) {
        return `${(worldSize / 1000).toFixed(1)}km`;
    }

    if (worldSize >= 1) {
        return `${worldSize.toFixed(1)}m`;
    }

    if (worldSize >= 0.1) {
        return `${(worldSize * 100).toFixed(0)}cm`;
    }

    return `${(worldSize * 1000).toFixed(0)}mm`;
}

function calculateScaleBarWorldSize(
    camera: ViewCamera,
    cameraDistance: number,
    viewportHeight: number,
) {
    const scaleBarPixels = 96;
    if (camera instanceof THREE.OrthographicCamera) {
        return (
            (scaleBarPixels / viewportHeight) *
            ((camera.top - camera.bottom) / camera.zoom)
        );
    }

    const fov = THREE.MathUtils.degToRad(camera.fov);
    return (
        (scaleBarPixels / viewportHeight) *
        (cameraDistance * Math.tan(fov / 2) * 2)
    );
}

function getCameraOverlayRotation(camera: ViewCamera, controls: OrbitControls) {
    const offset = camera.position.clone().sub(controls.target);
    const radius = Math.max(offset.length(), 0.0001);
    const azimuth = THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z));
    const elevation = THREE.MathUtils.radToDeg(Math.asin(offset.y / radius));

    return {
        rotationX: -elevation,
        rotationY: -azimuth,
        distance: radius,
    };
}

function zoomCamera(
    camera: ViewCamera,
    controls: OrbitControls,
    factor: number,
) {
    if (camera instanceof THREE.OrthographicCamera) {
        camera.zoom = THREE.MathUtils.clamp(camera.zoom / factor, 0.2, 24);
        camera.updateProjectionMatrix();
        controls.update();
        return;
    }

    const offset = camera.position.clone().sub(controls.target);
    if (offset.lengthSq() === 0) {
        return;
    }

    const nextOffset = offset.multiplyScalar(factor);
    const nextDistance = nextOffset.length();

    camera.position.copy(controls.target).add(nextOffset);
    camera.near = Math.max(nextDistance / 100, 0.1);
    camera.far = Math.max(nextDistance * 120, 2400);
    camera.updateProjectionMatrix();
    controls.update();
}

function orbitCamera(
    camera: ViewCamera,
    controls: OrbitControls,
    deltaX: number,
    deltaY: number,
) {
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    spherical.theta -= deltaX * 0.008;
    spherical.phi += deltaY * 0.008;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.08, Math.PI - 0.08);

    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
}

function calculateVisibleChunkIds(
    camera: ViewCamera,
    manifest: RenderManifest,
) {
    const projectionMatrix = new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
    );
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
        projectionMatrix,
    );

    return manifest.chunks
        .filter((chunk) => frustum.intersectsBox(boundsFromTuple(chunk.bounds)))
        .map((chunk) => chunk.chunkId)
        .sort((left, right) => left - right);
}

export function ViewportScene({
    manifest,
    residentChunks,
    chunkVersion,
    selectedEntityIds,
    hiddenEntityIds,
    projectionMode,
    viewportCommand,
    onSelectEntity,
    onVisibleChunkIdsChange,
    onHoverEntity,
    onContextMenu,
}: ViewportSceneProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const sceneRootRef = useRef<THREE.Group | null>(null);
    const chunkGroupsRef = useRef<Map<number, ChunkRenderGroup>>(new Map());
    const meshEntriesRef = useRef<RenderEntry[]>([]);
    const entryIndexRef = useRef<Map<number, RenderEntry[]>>(new Map());
    const geometryCacheRef = useRef<Map<number, GeometryCacheEntry>>(new Map());
    const needsRenderRef = useRef(true);
    const cameraRef = useRef<ViewCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const onSelectEntityRef = useRef(onSelectEntity);
    const onHoverEntityRef = useRef(onHoverEntity);
    const onContextMenuRef = useRef(onContextMenu);
    const selectedEntityIdsRef = useRef(selectedEntityIds);
    const hiddenEntityIdsRef = useRef(hiddenEntityIds);
    const lastHandledViewportCommandSeqRef = useRef(0);
    const viewCubeRef = useRef<ViewCubeRef | null>(null);
    const axisHelperRef = useRef<AxisHelperRef | null>(null);
    const lastScaleValueRef = useRef(0);
    const cameraViewSnapshotRef = useRef<{
        position: THREE.Vector3;
        target: THREE.Vector3;
        zoom: number;
        isOrtho: boolean;
        halfHeight: number;
    } | null>(null);
    const previousSelectedSetRef = useRef(new Set<number>(selectedEntityIds));
    const previousHiddenSetRef = useRef(new Set<number>(hiddenEntityIds));
    const lastVisibleChunkKeyRef = useRef("");
    const [rendererError, setRendererError] = useState<string | null>(null);
    const [sceneGeneration, setSceneGeneration] = useState(0);
    const [scaleLabel, setScaleLabel] = useState("10m");

    useEffect(() => {
        return () => {
            useViewerStore.setState({ frameRate: null });
        };
    }, []);

    const homeToFit = useCallback(() => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) {
            return;
        }

        fitCameraToBounds(
            camera,
            controls,
            boundsFromTuple(manifest.modelBounds),
        );
    }, [manifest.modelBounds]);

    const fitAllCurrentView = useCallback(() => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) {
            return;
        }

        const direction = camera.position.clone().sub(controls.target);
        if (direction.lengthSq() === 0) {
            direction.set(1, 0.75, 1);
        }

        fitCameraToBoundsWithDirection(
            camera,
            controls,
            boundsFromTuple(manifest.modelBounds),
            direction,
        );
    }, [manifest.modelBounds]);

    const setPresetView = useCallback(
        (view: "top" | "bottom" | "front" | "back" | "left" | "right") => {
            const camera = cameraRef.current;
            const controls = controlsRef.current;
            if (!camera || !controls) {
                return;
            }

            const directionMap: Record<typeof view, THREE.Vector3> = {
                front: new THREE.Vector3(0, 0, 1),
                back: new THREE.Vector3(0, 0, -1),
                left: new THREE.Vector3(-1, 0, 0),
                right: new THREE.Vector3(1, 0, 0),
                top: new THREE.Vector3(0.0001, 1, 0.0001),
                bottom: new THREE.Vector3(0.0001, -1, 0.0001),
            };

            fitCameraToBoundsWithDirection(
                camera,
                controls,
                boundsFromTuple(manifest.modelBounds),
                directionMap[view],
            );
        },
        [manifest.modelBounds],
    );

    const zoomIn = useCallback(() => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) {
            return;
        }

        zoomCamera(camera, controls, 0.84);
    }, []);

    const zoomOut = useCallback(() => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) {
            return;
        }

        zoomCamera(camera, controls, 1.2);
    }, []);

    const orbitFromViewCube = useCallback((deltaX: number, deltaY: number) => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) {
            return;
        }

        orbitCamera(camera, controls, deltaX, deltaY);
    }, []);

    useEffect(() => {
        onSelectEntityRef.current = onSelectEntity;
    }, [onSelectEntity]);

    useEffect(() => {
        onHoverEntityRef.current = onHoverEntity;
    }, [onHoverEntity]);

    useEffect(() => {
        onContextMenuRef.current = onContextMenu;
    }, [onContextMenu]);

    useEffect(() => {
        const { currentSelectedSet, currentHiddenSet } = updateMeshVisualState(
            entryIndexRef.current,
            previousSelectedSetRef.current,
            previousHiddenSetRef.current,
            selectedEntityIds,
            hiddenEntityIds,
        );

        selectedEntityIdsRef.current = selectedEntityIds;
        hiddenEntityIdsRef.current = hiddenEntityIds;
        previousSelectedSetRef.current = currentSelectedSet;
        previousHiddenSetRef.current = currentHiddenSet;
        needsRenderRef.current = true;
    }, [hiddenEntityIds, selectedEntityIds]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        setRendererError(null);
        setSceneGeneration((g) => g + 1);
        const webglBlockReason = getWebGLBlockReason();
        if (webglBlockReason) {
            setRendererError(webglBlockReason);
            useViewerStore.setState({ frameRate: null });
            return;
        }

        const scene = new THREE.Scene();
        const isDark = useViewerStore.getState().theme === "dark";
        scene.background = new THREE.Color(isDark ? "#1e293b" : "#edf4fb");

        const aspect =
            Math.max(container.clientWidth, 1) /
            Math.max(container.clientHeight, 1);
        const camera =
            projectionMode === "orthographic"
                ? new THREE.OrthographicCamera(
                      -12 * aspect,
                      12 * aspect,
                      12,
                      -12,
                      0.1,
                      5000,
                  )
                : new THREE.PerspectiveCamera(45, aspect, 0.1, 5000);
        setCameraAspect(camera, aspect);
        camera.position.set(12, 10, 12);

        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: false,
                powerPreference: "high-performance",
                preserveDrawingBuffer: true,
            });
        } catch (error) {
            setRendererError(
                error instanceof Error
                    ? error.message
                    : "현재 환경에서 WebGL 컨텍스트를 만들 수 없습니다.",
            );
            return;
        }

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.85;
        renderer.autoClear = false;
        container.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = false;
        controls.screenSpacePanning = true;
        controls.rotateSpeed = 0.78;
        controls.zoomSpeed = 1.08;
        controls.panSpeed = 0.92;
        controls.target.set(0, 0, 0);
        controls.addEventListener("change", () => {
            needsRenderRef.current = true;
        });
        controls.mouseButtons = {
            LEFT: -1 as THREE.MOUSE, // LMB: OrbitControls 무시 (선택 전용)
            MIDDLE: THREE.MOUSE.PAN, // MMB: 팬
            RIGHT: THREE.MOUSE.ROTATE, // RMB: 오빗
        };
        controls.zoomToCursor = true; // 스크롤 줌이 커서 위치 방향으로 동작

        // ifc-lite 스타일 조명: hemisphere + sun/fill/rim
        const hemiLight = new THREE.HemisphereLight();
        hemiLight.color.setRGB(0.3, 0.35, 0.4);
        hemiLight.groundColor.setRGB(0.15, 0.1, 0.08);
        hemiLight.intensity = 0.8;
        scene.add(hemiLight);

        const sunLight = new THREE.DirectionalLight("#ffffff", 1.7);
        sunLight.position.set(0.5, 1.0, 0.3).normalize();
        scene.add(sunLight);

        const fillLight = new THREE.DirectionalLight("#ffffff", 0.5);
        fillLight.position.set(-0.5, 0.3, -0.3).normalize();
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight("#ffffff", 0.5);
        rimLight.position.set(0.0, 0.2, -1.0).normalize();
        scene.add(rimLight);

        const grid = new THREE.GridHelper(
            140,
            28,
            isDark ? "#334155" : "#cbd5e1",
            isDark ? "#1e293b" : "#e5edf6",
        );
        const gridMaterial = grid.material;
        if (Array.isArray(gridMaterial)) {
            gridMaterial.forEach((material) => {
                material.transparent = true;
                material.opacity = 0.36;
            });
        } else {
            gridMaterial.transparent = true;
            gridMaterial.opacity = 0.36;
        }
        scene.add(grid);

        const sceneRoot = new THREE.Group();
        scene.add(sceneRoot);
        sceneRootRef.current = sceneRoot;
        cameraRef.current = camera;
        controlsRef.current = controls;
        chunkGroupsRef.current = new Map();
        meshEntriesRef.current = [];
        entryIndexRef.current = new Map();
        geometryCacheRef.current = new Map();

        const snap = cameraViewSnapshotRef.current;
        if (snap && snap.position.clone().sub(snap.target).lengthSq() > 0) {
            const dir = snap.position.clone().sub(snap.target);
            const prevDistance = dir.length();

            if (camera instanceof THREE.OrthographicCamera) {
                // Perspective → Ortho: convert distance to halfHeight
                let halfHeight: number;
                if (!snap.isOrtho) {
                    const fovRad = THREE.MathUtils.degToRad(45);
                    halfHeight = prevDistance * Math.tan(fovRad / 2);
                } else {
                    halfHeight = snap.halfHeight;
                }
                halfHeight = Math.max(halfHeight, 0.5);

                camera.position.copy(snap.position);
                controls.target.copy(snap.target);
                camera.lookAt(snap.target);
                updateOrthographicFrustum(camera, halfHeight);
                camera.zoom = snap.isOrtho ? snap.zoom : 1;
                camera.near = 0.1;
                camera.far = Math.max(prevDistance * 24, 2400);
                camera.updateProjectionMatrix();
                controls.update();
            } else {
                // Ortho → Perspective: convert halfHeight to distance
                let distance: number;
                if (snap.isOrtho) {
                    const fovRad = THREE.MathUtils.degToRad(45);
                    const effectiveHalfHeight = snap.halfHeight / snap.zoom;
                    distance = effectiveHalfHeight / Math.tan(fovRad / 2);
                } else {
                    distance = prevDistance;
                }

                const normalizedDir = dir.normalize();
                camera.position
                    .copy(snap.target)
                    .addScaledVector(normalizedDir, distance);
                controls.target.copy(snap.target);
                camera.lookAt(snap.target);
                camera.near = Math.max(distance / 100, 0.1);
                camera.far = Math.max(distance * 120, 2400);
                camera.updateProjectionMatrix();
                controls.update();
            }

            // Set orbit distance limits
            const finalDistance = camera.position
                .clone()
                .sub(controls.target)
                .length();
            controls.minDistance = Math.max(finalDistance * 0.02, 0.2);
            controls.maxDistance = finalDistance * 20;
        } else {
            fitCameraToBounds(
                camera,
                controls,
                boundsFromTuple(manifest.modelBounds),
            );
        }

        const raycaster = new THREE.Raycaster();
        (
            raycaster as THREE.Raycaster & { firstHitOnly?: boolean }
        ).firstHitOnly = true;
        const pointer = new THREE.Vector2();
        let pointerIsDown = false;
        let didDrag = false;
        let pointerDownX = 0;
        let pointerDownY = 0;

        let rmbIsDown = false;
        let rmbDidDrag = false;
        let rmbDownX = 0;
        let rmbDownY = 0;

        const handlePointerDown = (event: PointerEvent) => {
            if (event.button === 0) {
                pointerIsDown = true;
                didDrag = false;
                pointerDownX = event.clientX;
                pointerDownY = event.clientY;
            } else if (event.button === 2) {
                rmbIsDown = true;
                rmbDidDrag = false;
                rmbDownX = event.clientX;
                rmbDownY = event.clientY;
            }
        };

        const handlePointerMove = (event: PointerEvent) => {
            if (pointerIsDown) {
                const deltaX = event.clientX - pointerDownX;
                const deltaY = event.clientY - pointerDownY;
                if (Math.hypot(deltaX, deltaY) > 4) {
                    didDrag = true;
                }
            }
            if (rmbIsDown) {
                const deltaX = event.clientX - rmbDownX;
                const deltaY = event.clientY - rmbDownY;
                if (Math.hypot(deltaX, deltaY) > 4) {
                    rmbDidDrag = true;
                }
            }
        };

        const handlePointerUp = (event: PointerEvent) => {
            if (event.button === 0) {
                pointerIsDown = false;
            } else if (event.button === 2) {
                rmbIsDown = false;
            }
        };

        const handleClick = (event: MouseEvent) => {
            if (didDrag) {
                didDrag = false;
                return;
            }

            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObjects(
                sceneRoot.children,
                true,
            );
            const firstHit = intersects.find(
                (intersection) =>
                    intersection.object instanceof THREE.Mesh ||
                    intersection.object instanceof THREE.InstancedMesh,
            );

            if (!firstHit) {
                if (!event.shiftKey) {
                    onSelectEntityRef.current(null);
                }
                return;
            }

            if (
                firstHit.object instanceof THREE.InstancedMesh &&
                firstHit.instanceId !== undefined
            ) {
                const instanceExpressIds = firstHit.object.userData
                    .instanceExpressIds as number[] | undefined;
                const expressId = instanceExpressIds?.[firstHit.instanceId];
                onSelectEntityRef.current(
                    typeof expressId === "number" ? expressId : null,
                    event.shiftKey,
                );
                return;
            }

            const expressId = firstHit.object.userData.expressId;
            onSelectEntityRef.current(
                typeof expressId === "number" ? expressId : null,
                event.shiftKey,
            );
        };

        let lastHoverTime = 0;
        let lastHoveredId: number | null = null;
        const hoverPointer = new THREE.Vector2();

        const handleHoverMove = (event: MouseEvent) => {
            if (pointerIsDown || rmbIsDown) {
                if (lastHoveredId !== null) {
                    lastHoveredId = null;
                    onHoverEntityRef.current?.(null, null);
                }
                return;
            }

            const now = performance.now();
            if (now - lastHoverTime < 50) return;
            lastHoverTime = now;

            const rect = renderer.domElement.getBoundingClientRect();
            hoverPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            hoverPointer.y =
                -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(hoverPointer, camera);
            const intersects = raycaster.intersectObjects(
                sceneRoot.children,
                true,
            );
            const firstHit = intersects.find(
                (intersection) =>
                    intersection.object instanceof THREE.Mesh ||
                    intersection.object instanceof THREE.InstancedMesh,
            );

            let hoveredId: number | null = null;
            if (firstHit) {
                if (
                    firstHit.object instanceof THREE.InstancedMesh &&
                    firstHit.instanceId !== undefined
                ) {
                    const instanceExpressIds = firstHit.object.userData
                        .instanceExpressIds as number[] | undefined;
                    hoveredId =
                        instanceExpressIds?.[firstHit.instanceId] ?? null;
                } else {
                    hoveredId =
                        typeof firstHit.object.userData.expressId === "number"
                            ? firstHit.object.userData.expressId
                            : null;
                }
            }

            if (hoveredId !== lastHoveredId) {
                lastHoveredId = hoveredId;
                onHoverEntityRef.current?.(
                    hoveredId,
                    hoveredId !== null
                        ? { x: event.clientX, y: event.clientY }
                        : null,
                );
            } else if (hoveredId !== null) {
                onHoverEntityRef.current?.(hoveredId, {
                    x: event.clientX,
                    y: event.clientY,
                });
            }
        };

        const handleContextMenu = (event: MouseEvent) => {
            event.preventDefault();
            if (rmbDidDrag) {
                rmbDidDrag = false;
                return;
            }
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObjects(
                sceneRoot.children,
                true,
            );
            const firstHit = intersects.find(
                (intersection) =>
                    intersection.object instanceof THREE.Mesh ||
                    intersection.object instanceof THREE.InstancedMesh,
            );

            let expressId: number | null = null;
            if (firstHit) {
                if (
                    firstHit.object instanceof THREE.InstancedMesh &&
                    firstHit.instanceId !== undefined
                ) {
                    const instanceExpressIds = firstHit.object.userData
                        .instanceExpressIds as number[] | undefined;
                    expressId =
                        instanceExpressIds?.[firstHit.instanceId] ?? null;
                } else {
                    expressId =
                        typeof firstHit.object.userData.expressId === "number"
                            ? firstHit.object.userData.expressId
                            : null;
                }
            }

            if (expressId !== null) {
                onSelectEntityRef.current(expressId);
            }
            onContextMenuRef.current?.(expressId, {
                x: event.clientX,
                y: event.clientY,
            });
        };

        const handleCtrlRmbDown = (event: PointerEvent) => {
            if (event.button === 2 && (event.ctrlKey || event.metaKey)) {
                controls.mouseButtons.RIGHT = THREE.MOUSE.DOLLY;
            }
        };
        const handleCtrlRmbUp = (event: PointerEvent) => {
            if (event.button === 2) {
                controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
            }
        };

        // 트랙패드 관성(momentum) 스크롤 제거: 100ms 쓰로틀
        let lastWheelTime = 0;
        const handleWheelCapture = (event: WheelEvent) => {
            const now = performance.now();
            if (now - lastWheelTime < 100) {
                event.preventDefault();
                event.stopImmediatePropagation();
                return;
            }
            lastWheelTime = now;
        };
        renderer.domElement.addEventListener("wheel", handleWheelCapture, {
            capture: true,
        });

        renderer.domElement.addEventListener("pointerdown", handleCtrlRmbDown, {
            capture: true,
        });
        window.addEventListener("pointerup", handleCtrlRmbUp);
        renderer.domElement.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        renderer.domElement.addEventListener("click", handleClick);
        renderer.domElement.addEventListener("mousemove", handleHoverMove);
        renderer.domElement.addEventListener("contextmenu", handleContextMenu);

        const resizeObserver = new ResizeObserver(() => {
            const width = Math.max(container.clientWidth, 1);
            const height = Math.max(container.clientHeight, 1);
            setCameraAspect(camera, width / height);
            if (camera instanceof THREE.OrthographicCamera) {
                updateOrthographicFrustum(
                    camera,
                    (camera.top - camera.bottom) / 2,
                );
            }
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
            needsRenderRef.current = true;
        });
        resizeObserver.observe(container);

        let animationFrame = 0;
        let fpsSampleStart = performance.now();
        let fpsSampleFrames = 0;
        let lastPublishedFrameRate: number | null =
            useViewerStore.getState().frameRate;
        let lastVisibleSample = 0;
        const renderFrame = () => {
            controls.update();

            if (needsRenderRef.current) {
                const viewportWidth = Math.max(1, container.clientWidth);
                const viewportHeight = Math.max(1, container.clientHeight);

                renderer.setViewport(0, 0, viewportWidth, viewportHeight);
                renderer.setScissorTest(false);
                renderer.clear();
                renderer.render(scene, camera);

                const { distance, rotationX, rotationY } =
                    getCameraOverlayRotation(camera, controls);
                viewCubeRef.current?.updateRotation(rotationX, rotationY);
                axisHelperRef.current?.updateRotation(rotationX, rotationY);

                const worldScale = calculateScaleBarWorldSize(
                    camera,
                    distance,
                    viewportHeight,
                );
                const scaleDelta =
                    lastScaleValueRef.current === 0
                        ? 1
                        : Math.abs(worldScale - lastScaleValueRef.current) /
                          lastScaleValueRef.current;
                if (scaleDelta > 0.01) {
                    lastScaleValueRef.current = worldScale;
                    setScaleLabel(formatScaleLabel(worldScale));
                }

                const now = performance.now();
                if (now - lastVisibleSample >= 150) {
                    const visibleChunkIds = calculateVisibleChunkIds(
                        camera,
                        manifest,
                    );
                    const visibleChunkKey = visibleChunkIds.join(",");
                    if (visibleChunkKey !== lastVisibleChunkKeyRef.current) {
                        lastVisibleChunkKeyRef.current = visibleChunkKey;
                        onVisibleChunkIdsChange(visibleChunkIds);
                    }
                    lastVisibleSample = now;
                }

                fpsSampleFrames += 1;
                if (now - fpsSampleStart >= 250) {
                    const nextFrameRate = Math.round(
                        (fpsSampleFrames * 1000) / (now - fpsSampleStart),
                    );
                    if (nextFrameRate !== lastPublishedFrameRate) {
                        useViewerStore.setState({ frameRate: nextFrameRate });
                        lastPublishedFrameRate = nextFrameRate;
                    }
                    fpsSampleStart = now;
                    fpsSampleFrames = 0;
                }

                needsRenderRef.current = false;
            }

            animationFrame = window.requestAnimationFrame(renderFrame);
        };
        renderFrame();

        return () => {
            window.cancelAnimationFrame(animationFrame);
            resizeObserver.disconnect();
            renderer.domElement.removeEventListener(
                "wheel",
                handleWheelCapture,
                { capture: true } as EventListenerOptions,
            );
            renderer.domElement.removeEventListener(
                "pointerdown",
                handleCtrlRmbDown,
                { capture: true },
            );
            window.removeEventListener("pointerup", handleCtrlRmbUp);
            renderer.domElement.removeEventListener(
                "pointerdown",
                handlePointerDown,
            );
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            renderer.domElement.removeEventListener("click", handleClick);
            renderer.domElement.removeEventListener(
                "mousemove",
                handleHoverMove,
            );
            renderer.domElement.removeEventListener(
                "contextmenu",
                handleContextMenu,
            );
            cameraViewSnapshotRef.current = {
                position: camera.position.clone(),
                target: controls.target.clone(),
                zoom:
                    camera instanceof THREE.OrthographicCamera
                        ? camera.zoom
                        : 1,
                isOrtho: camera instanceof THREE.OrthographicCamera,
                halfHeight:
                    camera instanceof THREE.OrthographicCamera
                        ? (camera.top - camera.bottom) / 2
                        : 0,
            };
            controls.dispose();

            chunkGroupsRef.current.forEach((chunkGroup) => {
                chunkGroup.materials.forEach((material) => material.dispose());
            });
            geometryCacheRef.current.forEach(({ geometry }) => {
                (
                    geometry as THREE.BufferGeometry & {
                        disposeBoundsTree?: () => void;
                    }
                ).disposeBoundsTree?.();
                geometry.dispose();
            });
            chunkGroupsRef.current = new Map();
            meshEntriesRef.current = [];
            entryIndexRef.current = new Map();
            geometryCacheRef.current = new Map();
            sceneRootRef.current = null;
            cameraRef.current = null;
            controlsRef.current = null;
            renderer.forceContextLoss();
            renderer.dispose();
            if (renderer.domElement.parentElement === container) {
                container.removeChild(renderer.domElement);
            }
        };
    }, [manifest, projectionMode, onVisibleChunkIdsChange]);

    useEffect(() => {
        const sceneRoot = sceneRootRef.current;
        if (!sceneRoot) {
            return;
        }

        const nextChunkIds = new Set(
            residentChunks.map((chunk) => chunk.chunkId),
        );

        chunkGroupsRef.current.forEach((chunkGroup, chunkId) => {
            if (nextChunkIds.has(chunkId)) {
                return;
            }

            sceneRoot.remove(chunkGroup.group);
            chunkGroup.entries.forEach((entry) => {
                removeIndexedRenderEntry(entryIndexRef.current, entry);
            });
            meshEntriesRef.current = meshEntriesRef.current.filter(
                (entry) => !chunkGroup.entries.includes(entry),
            );
            chunkGroup.materials.forEach((material) => material.dispose());
            chunkGroupsRef.current.delete(chunkId);
        });

        residentChunks.forEach((chunk) => {
            if (chunkGroupsRef.current.has(chunk.chunkId)) {
                return;
            }

            const chunkGroup = new THREE.Group();
            const builtChunk = appendMeshesToGroup(
                chunk.meshes,
                chunkGroup,
                geometryCacheRef.current,
                entryIndexRef.current,
                selectedEntityIdsRef.current,
                hiddenEntityIdsRef.current,
            );
            meshEntriesRef.current.push(...builtChunk.entries);
            sceneRoot.add(chunkGroup);
            chunkGroupsRef.current.set(chunk.chunkId, {
                group: chunkGroup,
                entries: builtChunk.entries,
                materials: builtChunk.materials,
            });
        });
        needsRenderRef.current = true;
    }, [chunkVersion, residentChunks, sceneGeneration]);

    useEffect(() => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;

        if (!camera || !controls || viewportCommand.type === "none") {
            return;
        }

        if (viewportCommand.seq <= lastHandledViewportCommandSeqRef.current) {
            return;
        }

        lastHandledViewportCommandSeqRef.current = viewportCommand.seq;

        if (viewportCommand.type === "home") {
            homeToFit();
            return;
        }

        if (
            viewportCommand.type === "view-front" ||
            viewportCommand.type === "view-right" ||
            viewportCommand.type === "view-top" ||
            viewportCommand.type === "view-iso"
        ) {
            if (viewportCommand.type === "view-front") {
                setPresetView("front");
            } else if (viewportCommand.type === "view-right") {
                setPresetView("right");
            } else if (viewportCommand.type === "view-top") {
                setPresetView("top");
            } else {
                fitCameraToBoundsWithDirection(
                    camera,
                    controls,
                    boundsFromTuple(manifest.modelBounds),
                    new THREE.Vector3(1, 0.75, 1),
                );
            }
            return;
        }

        if (
            viewportCommand.type === "fit-selected" &&
            selectedEntityIds.length > 0
        ) {
            const selectedEntries = meshEntriesRef.current.filter(
                (entry) =>
                    selectedEntityIdsRef.current.includes(entry.expressId) &&
                    !hiddenEntityIdsRef.current.includes(entry.expressId),
            );
            if (selectedEntries.length === 0) {
                return;
            }

            const selectedBounds = new THREE.Box3();
            selectedEntries.forEach((entry) => {
                expandBoundsForEntry(selectedBounds, entry);
            });
            fitCameraToBounds(camera, controls, selectedBounds);
        }
    }, [
        homeToFit,
        manifest.modelBounds,
        selectedEntityIds.length,
        setPresetView,
        viewportCommand,
    ]);

    return (
        <div ref={containerRef} className="viewer-viewport__canvas">
            {rendererError ? (
                <div className="viewer-viewport__empty-state viewer-viewport__empty-state--error">
                    <h1>WebGL Renderer Error</h1>
                    <p>{rendererError}</p>
                </div>
            ) : null}
            <ViewportOverlays
                axisHelperRef={axisHelperRef}
                projectionMode={projectionMode}
                scaleLabel={scaleLabel}
                onFitAll={fitAllCurrentView}
                onHome={homeToFit}
                onViewChange={setPresetView}
                onViewCubeDrag={orbitFromViewCube}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                viewCubeRef={viewCubeRef}
            />
        </div>
    );
}
