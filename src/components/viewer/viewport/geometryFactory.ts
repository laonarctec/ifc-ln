import * as THREE from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
import type { TransferableMeshData } from "@/types/worker-messages";
import type { BufferGeometryWithBVH } from "@/utils/three-bvh";

// --- Types ---

export interface GeometryCacheEntry {
  geometry: THREE.BufferGeometry;
  refCount: number;
}

// --- BVH Setup ---

const bvhProto = THREE.BufferGeometry.prototype as BufferGeometryWithBVH;

if (bvhProto.computeBoundsTree !== computeBoundsTree) {
  bvhProto.computeBoundsTree = computeBoundsTree;
  bvhProto.disposeBoundsTree = disposeBoundsTree;
  THREE.Mesh.prototype.raycast = acceleratedRaycast;
}

// --- WebGL check ---

export function getWebGLBlockReason() {
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

  return "\uD604\uC7AC \uBE0C\uB77C\uC6B0\uC800 \uB610\uB294 \uC2E4\uD589 \uD658\uACBD\uC5D0\uC11C WebGL\uC774 \uBE44\uD65C\uC131\uD654\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.";
}

// --- Geometry creation ---

export function createRenderableGeometry(mesh: TransferableMeshData) {
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
  // BVH is now generated asynchronously via bvhScheduler — not blocking attach
  return geometry;
}

export function getOrCreateGeometry(
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
