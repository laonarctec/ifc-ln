import { describe, expect, it } from "vitest";
import {
  activateBoxSelection,
  beginBoxSelectionCandidate,
  beginPrimaryPointerSession,
  beginSecondaryPointerSession,
  clearBoxSelectionSession,
  consumePrimaryPointerDrag,
  createViewportPointerSession,
  finishPrimaryPointerSession,
  finishSecondaryPointerSession,
  updatePrimaryPointerDrag,
  updateSecondaryPointerDrag,
} from "./viewportPointerSession";

describe("viewportPointerSession", () => {
  it("tracks primary pointer drag state and consumption", () => {
    const session = createViewportPointerSession();

    beginPrimaryPointerSession(session, 10, 20);
    expect(session.pointerIsDown).toBe(true);
    expect(updatePrimaryPointerDrag(session, 12, 22, 6)).toBe(false);
    expect(updatePrimaryPointerDrag(session, 20, 32, 6)).toBe(true);
    expect(consumePrimaryPointerDrag(session)).toBe(true);
    expect(session.didDrag).toBe(false);

    finishPrimaryPointerSession(session);
    expect(session.pointerIsDown).toBe(false);
  });

  it("tracks secondary pointer drag and reset", () => {
    const session = createViewportPointerSession();

    beginSecondaryPointerSession(session, 30, 40);
    expect(session.rmbIsDown).toBe(true);
    expect(updateSecondaryPointerDrag(session, 31, 41, 6)).toBe(false);
    expect(updateSecondaryPointerDrag(session, 40, 50, 6)).toBe(true);

    finishSecondaryPointerSession(session);
    expect(session.rmbIsDown).toBe(false);
    expect(session.rmbDidDrag).toBe(false);
  });

  it("tracks box selection candidate and reset state", () => {
    const session = createViewportPointerSession();

    beginBoxSelectionCandidate(session, 0, 0);
    expect(session.boxStartX).toBe(0);
    expect(session.boxStartY).toBe(0);
    expect(session.boxSelectActive).toBe(false);

    activateBoxSelection(session);
    expect(session.boxSelectActive).toBe(true);

    clearBoxSelectionSession(session);
    expect(session.boxSelectActive).toBe(false);
    expect(session.boxStartX).toBe(null);
    expect(session.boxStartY).toBe(null);
  });
});
