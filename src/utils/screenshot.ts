import type * as THREE from 'three';

export function captureViewportScreenshot(
  container: HTMLElement,
  renderer?: THREE.WebGLRenderer,
  scene?: THREE.Scene,
  camera?: THREE.Camera,
) {
  const canvas = container.querySelector('canvas');
  if (!canvas) return null;

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `viewport-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
  return true;
}
