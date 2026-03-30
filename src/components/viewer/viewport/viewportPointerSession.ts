import { hasExceededPointerDragThreshold } from "./viewportPointerState";

export interface ViewportPointerSession {
  pointerIsDown: boolean;
  didDrag: boolean;
  pointerDownX: number;
  pointerDownY: number;
  rmbIsDown: boolean;
  rmbDidDrag: boolean;
  rmbDownX: number;
  rmbDownY: number;
  boxSelectActive: boolean;
  boxStartX: number | null;
  boxStartY: number | null;
}

export function createViewportPointerSession(): ViewportPointerSession {
  return {
    pointerIsDown: false,
    didDrag: false,
    pointerDownX: 0,
    pointerDownY: 0,
    rmbIsDown: false,
    rmbDidDrag: false,
    rmbDownX: 0,
    rmbDownY: 0,
    boxSelectActive: false,
    boxStartX: null,
    boxStartY: null,
  };
}

export function beginPrimaryPointerSession(
  session: ViewportPointerSession,
  clientX: number,
  clientY: number,
) {
  session.pointerIsDown = true;
  session.didDrag = false;
  session.pointerDownX = clientX;
  session.pointerDownY = clientY;
}

export function beginSecondaryPointerSession(
  session: ViewportPointerSession,
  clientX: number,
  clientY: number,
) {
  session.rmbIsDown = true;
  session.rmbDidDrag = false;
  session.rmbDownX = clientX;
  session.rmbDownY = clientY;
}

export function updatePrimaryPointerDrag(
  session: ViewportPointerSession,
  clientX: number,
  clientY: number,
  threshold: number,
) {
  if (
    hasExceededPointerDragThreshold(
      session.pointerDownX,
      session.pointerDownY,
      clientX,
      clientY,
      threshold,
    )
  ) {
    session.didDrag = true;
  }
  return session.didDrag;
}

export function updateSecondaryPointerDrag(
  session: ViewportPointerSession,
  clientX: number,
  clientY: number,
  threshold: number,
) {
  if (
    hasExceededPointerDragThreshold(
      session.rmbDownX,
      session.rmbDownY,
      clientX,
      clientY,
      threshold,
    )
  ) {
    session.rmbDidDrag = true;
  }
  return session.rmbDidDrag;
}

export function beginBoxSelectionCandidate(
  session: ViewportPointerSession,
  clientX: number,
  clientY: number,
) {
  session.boxStartX = clientX;
  session.boxStartY = clientY;
  session.boxSelectActive = false;
}

export function activateBoxSelection(session: ViewportPointerSession) {
  session.boxSelectActive = true;
}

export function clearBoxSelectionSession(session: ViewportPointerSession) {
  session.boxSelectActive = false;
  session.boxStartX = null;
  session.boxStartY = null;
}

export function finishPrimaryPointerSession(session: ViewportPointerSession) {
  session.pointerIsDown = false;
}

export function finishSecondaryPointerSession(session: ViewportPointerSession) {
  session.rmbIsDown = false;
  session.rmbDidDrag = false;
}

export function consumePrimaryPointerDrag(session: ViewportPointerSession) {
  const didDrag = session.didDrag;
  session.didDrag = false;
  return didDrag;
}
