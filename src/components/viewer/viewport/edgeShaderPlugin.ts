import * as THREE from "three";

export interface EdgeShaderOptions {
  edgeEnabled: boolean;
  edgeIntensity: number; // 0.0 ~ 3.0, default 1.0
}

/**
 * Inject dFdx/dFdy edge detection into a MeshPhongMaterial's fragment shader.
 *
 * Uses onBeforeCompile to patch the compiled GLSL — the material remains a
 * MeshPhongMaterial (instanceof checks still pass) and Three.js lighting /
 * tone-mapping is preserved.
 *
 * The edge effect darkens pixels at depth and normal discontinuities,
 * ported from ifc-lite's main.wgsl.ts approach.
 */
export function applyEdgeShader(
  material: THREE.MeshPhongMaterial,
  options: EdgeShaderOptions,
): void {
  const uniforms = {
    uEdgeEnabled: { value: options.edgeEnabled },
    uEdgeIntensity: { value: options.edgeIntensity },
  };

  material.userData.edgeUniforms = uniforms;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uEdgeEnabled = uniforms.uEdgeEnabled;
    shader.uniforms.uEdgeIntensity = uniforms.uEdgeIntensity;

    // Declare uniforms at the top of fragment shader
    shader.fragmentShader =
      `uniform bool uEdgeEnabled;\nuniform float uEdgeIntensity;\n` +
      shader.fragmentShader;

    // Inject edge darkening after #include <output_fragment>
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <output_fragment>",
      `#include <output_fragment>
if (uEdgeEnabled) {
  float depthGrad = length(vec2(dFdx(vViewPosition.z), dFdy(vViewPosition.z)));
  float normalGrad = length(vec2(length(dFdx(vNormal)), length(dFdy(vNormal))));
  float edgeFactor = smoothstep(0.0, 0.1, depthGrad * 10.0 + normalGrad * 5.0);
  float darkenStrength = clamp(0.25 * uEdgeIntensity, 0.0, 0.85);
  float edgeDarken = mix(1.0, 1.0 - darkenStrength, edgeFactor);
  gl_FragColor.rgb *= edgeDarken;
}`,
    );
  };

  // Ensure Three.js cache key distinguishes this patched material
  material.customProgramCacheKey = () =>
    `edge_shader_${options.edgeEnabled ? 1 : 0}`;
}
