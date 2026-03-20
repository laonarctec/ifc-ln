import * as THREE from "three";

/**
 * Post-processing pass that detects entity ID boundaries and darkens seams.
 *
 * Samples the 4 cardinal neighbours of each pixel in the ID texture;
 * if any neighbour has a different entity ID, the pixel is on a seam
 * and gets darkened.  Ported from ifc-lite's post-processor approach.
 */

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D tId;
uniform sampler2D tScene;
uniform vec2 uResolution;
uniform float uSeparationStrength;
varying vec2 vUv;

void main() {
  vec4 sceneColor = texture2D(tScene, vUv);

  vec2 texel = 1.0 / uResolution;
  vec3 center = texture2D(tId, vUv).rgb;
  vec3 left   = texture2D(tId, vUv + vec2(-texel.x, 0.0)).rgb;
  vec3 right  = texture2D(tId, vUv + vec2( texel.x, 0.0)).rgb;
  vec3 up     = texture2D(tId, vUv + vec2(0.0,  texel.y)).rgb;
  vec3 down   = texture2D(tId, vUv + vec2(0.0, -texel.y)).rgb;

  // If any neighbour differs from center, this pixel is on a boundary
  float diff = 0.0;
  diff += step(0.001, length(center - left));
  diff += step(0.001, length(center - right));
  diff += step(0.001, length(center - up));
  diff += step(0.001, length(center - down));

  float seamFactor = clamp(diff, 0.0, 1.0);
  float darken = mix(1.0, 1.0 - uSeparationStrength, seamFactor);

  gl_FragColor = vec4(sceneColor.rgb * darken, sceneColor.a);
}
`;

export class SeparationLinePass {
  private material: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  readonly sceneTarget: THREE.WebGLRenderTarget;

  constructor(
    width: number,
    height: number,
    public readonly idTarget: THREE.WebGLRenderTarget,
  ) {
    this.sceneTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        tId: { value: idTarget.texture },
        tScene: { value: this.sceneTarget.texture },
        uResolution: { value: new THREE.Vector2(width, height) },
        uSeparationStrength: { value: 0.35 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this.material,
    );

    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(width: number, height: number) {
    this.idTarget.setSize(width, height);
    this.sceneTarget.setSize(width, height);
    this.material.uniforms.uResolution.value.set(width, height);
  }

  render(renderer: THREE.WebGLRenderer) {
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.material.dispose();
    this.quad.geometry.dispose();
    this.idTarget.dispose();
    this.sceneTarget.dispose();
  }
}

export function createSeparationLinePass(width: number, height: number) {
  const idTarget = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });

  return new SeparationLinePass(width, height, idTarget);
}
