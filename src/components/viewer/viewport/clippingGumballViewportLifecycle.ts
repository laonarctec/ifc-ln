interface EventSourceLike {
  addEventListener(eventName: string, handler: () => void): void;
  removeEventListener(eventName: string, handler: () => void): void;
}

interface ResizeObserverLike {
  observe(target: Element): void;
  disconnect(): void;
}

interface BindClippingGumballViewportLifecycleParams {
  controls: EventSourceLike;
  container: Element;
  syncAndRequestRender: () => void;
  createResizeObserver?: (callback: () => void) => ResizeObserverLike;
}

export function bindClippingGumballViewportLifecycle({
  controls,
  container,
  syncAndRequestRender,
  createResizeObserver = (callback) => new ResizeObserver(callback),
}: BindClippingGumballViewportLifecycleParams) {
  controls.addEventListener("change", syncAndRequestRender);
  const resizeObserver = createResizeObserver(syncAndRequestRender);
  resizeObserver.observe(container);
  syncAndRequestRender();

  return () => {
    controls.removeEventListener("change", syncAndRequestRender);
    resizeObserver.disconnect();
  };
}
