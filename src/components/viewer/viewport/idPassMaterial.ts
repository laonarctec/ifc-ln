import * as THREE from "three";

/**
 * Override material that encodes entity IDs into RGB channels (24-bit).
 *
 * - Regular Mesh: set uEntityId uniform before rendering each mesh
 * - InstancedMesh: uses instanceEntityId InstancedBufferAttribute
 *
 * The alpha channel is set to 1.0 so the ID target is fully opaque.
 */

const vertexShader = /* glsl */ `
attribute vec3 instanceEntityId;
varying vec3 vEntityColor;
uniform float uEntityId;
uniform bool uUseInstancing;

vec3 encodeId(float id) {
  float r = mod(floor(id / 65536.0), 256.0) / 255.0;
  float g = mod(floor(id / 256.0), 256.0) / 255.0;
  float b = mod(id, 256.0) / 255.0;
  return vec3(r, g, b);
}

void main() {
  if (uUseInstancing) {
    vEntityColor = instanceEntityId;
  } else {
    vEntityColor = encodeId(uEntityId);
  }

  #ifdef USE_INSTANCING
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  #else
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  #endif

  gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vEntityColor;

void main() {
  gl_FragColor = vec4(vEntityColor, 1.0);
}
`;

export function createIdPassMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uEntityId: { value: 0 },
      uUseInstancing: { value: false },
    },
    side: THREE.FrontSide,
  });
}

/**
 * Encode an expressId into an RGB vec3 (0–1 range per channel).
 */
export function encodeEntityId(expressId: number): [number, number, number] {
  const r = ((expressId >> 16) & 0xff) / 255;
  const g = ((expressId >> 8) & 0xff) / 255;
  const b = (expressId & 0xff) / 255;
  return [r, g, b];
}

/**
 * Decode RGB pixel back to expressId.
 */
export function decodeEntityId(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b;
}

/**
 * Prepare an InstancedMesh with per-instance entity ID attribute
 * for the ID render pass.
 */
export function prepareInstancedMeshForIdPass(
  instancedMesh: THREE.InstancedMesh,
  expressIds: number[],
): void {
  const count = expressIds.length;
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const [r, g, b] = encodeEntityId(expressIds[i]);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }

  const attr = new THREE.InstancedBufferAttribute(colors, 3);
  instancedMesh.geometry.setAttribute("instanceEntityId", attr);
}
