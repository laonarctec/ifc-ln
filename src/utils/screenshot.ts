export function captureViewportScreenshot(container: HTMLElement) {
  const canvas = container.querySelector('canvas');
  if (!canvas) return null;

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `viewport-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
  return true;
}
