interface EventTargetLike {
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

interface ControlEventSourceLike {
  addEventListener(eventName: string, handler: () => void): void;
  removeEventListener(eventName: string, handler: () => void): void;
}

interface BindViewportInputEventsParams {
  domElement: EventTargetLike;
  controls: ControlEventSourceLike;
  windowTarget: EventTargetLike;
  documentTarget: EventTargetLike;
  clearHover: () => void;
  handleWheelCapture: (event: WheelEvent) => void;
  handleCtrlRmbDown: (event: PointerEvent) => void;
  handleCtrlRmbUp: (event: PointerEvent) => void;
  handlePointerDown: (event: PointerEvent) => void;
  handlePointerMove: (event: PointerEvent) => void;
  handlePointerUp: (event: PointerEvent) => void;
  handleClick: (event: MouseEvent) => void;
  handleHoverMove: (event: MouseEvent) => void;
  handleHoverLeave: () => void;
  handleContextMenu: (event: MouseEvent) => void;
  handleControlsChange: () => void;
  handleWindowBlur: () => void;
  handleVisibilityChange: () => void;
}

const CAPTURE_OPTIONS = { capture: true } as const;

export function bindViewportInputEvents({
  domElement,
  controls,
  windowTarget,
  documentTarget,
  clearHover,
  handleWheelCapture,
  handleCtrlRmbDown,
  handleCtrlRmbUp,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleClick,
  handleHoverMove,
  handleHoverLeave,
  handleContextMenu,
  handleControlsChange,
  handleWindowBlur,
  handleVisibilityChange,
}: BindViewportInputEventsParams) {
  domElement.addEventListener("wheel", handleWheelCapture as EventListener, CAPTURE_OPTIONS);
  domElement.addEventListener("pointerdown", handleCtrlRmbDown as EventListener, CAPTURE_OPTIONS);
  windowTarget.addEventListener("pointerup", handleCtrlRmbUp as EventListener);
  domElement.addEventListener("pointerdown", handlePointerDown as EventListener);
  windowTarget.addEventListener("pointermove", handlePointerMove as EventListener);
  windowTarget.addEventListener("pointerup", handlePointerUp as EventListener);
  domElement.addEventListener("click", handleClick as EventListener);
  domElement.addEventListener("mousemove", handleHoverMove as EventListener);
  domElement.addEventListener("mouseleave", handleHoverLeave as EventListener);
  domElement.addEventListener("pointerleave", handleHoverLeave as EventListener);
  domElement.addEventListener("contextmenu", handleContextMenu as EventListener);
  controls.addEventListener("change", handleControlsChange);
  windowTarget.addEventListener("blur", handleWindowBlur as EventListener);
  documentTarget.addEventListener(
    "visibilitychange",
    handleVisibilityChange as EventListener,
  );
  clearHover();

  return () => {
    clearHover();
    domElement.removeEventListener("wheel", handleWheelCapture as EventListener, CAPTURE_OPTIONS);
    domElement.removeEventListener("pointerdown", handleCtrlRmbDown as EventListener, CAPTURE_OPTIONS);
    windowTarget.removeEventListener("pointerup", handleCtrlRmbUp as EventListener);
    domElement.removeEventListener("pointerdown", handlePointerDown as EventListener);
    windowTarget.removeEventListener("pointermove", handlePointerMove as EventListener);
    windowTarget.removeEventListener("pointerup", handlePointerUp as EventListener);
    domElement.removeEventListener("click", handleClick as EventListener);
    domElement.removeEventListener("mousemove", handleHoverMove as EventListener);
    domElement.removeEventListener("mouseleave", handleHoverLeave as EventListener);
    domElement.removeEventListener("pointerleave", handleHoverLeave as EventListener);
    domElement.removeEventListener("contextmenu", handleContextMenu as EventListener);
    controls.removeEventListener("change", handleControlsChange);
    windowTarget.removeEventListener("blur", handleWindowBlur as EventListener);
    documentTarget.removeEventListener(
      "visibilitychange",
      handleVisibilityChange as EventListener,
    );
  };
}
