import type { InteractionMode } from "@/stores/slices/toolsSlice";
import type {
  PointerPickResult,
  RaycastHit,
} from "./raycasting";

export type ViewportClickCommand =
  | { kind: "none" }
  | { kind: "blocked" }
  | { kind: "clipping-place"; hit: RaycastHit | null }
  | { kind: "split-place"; hit: RaycastHit | null }
  | { kind: "measure-point"; hit: RaycastHit }
  | { kind: "clear-selection" }
  | {
      kind: "select-entity";
      modelId: number;
      expressId: number;
      additive: boolean;
    };

export type ViewportHoverCommand =
  | { kind: "clipping-preview"; hit: RaycastHit | null }
  | { kind: "split-preview"; hit: RaycastHit | null }
  | { kind: "blocked" }
  | { kind: "hover"; hit: RaycastHit | null };

export type ViewportContextMenuCommand =
  | { kind: "none" }
  | { kind: "blocked" }
  | {
      kind: "open";
      modelId: number | null;
      expressId: number | null;
      selectBeforeOpen: boolean;
    };

function resolveClippingFallbackHit(
  result: PointerPickResult,
  fallbackHit: RaycastHit | null,
) {
  if (result.kind === "hit") {
    return result.hit;
  }

  if (result.kind === "blocked") {
    return fallbackHit;
  }

  return null;
}

export function createViewportClickCommand(params: {
  interactionMode: InteractionMode;
  result: PointerPickResult;
  fallbackHit: RaycastHit | null;
  additive: boolean;
}): ViewportClickCommand {
  const { interactionMode, result, fallbackHit, additive } = params;

  if (interactionMode === "create-clipping-plane") {
    return {
      kind: "clipping-place",
      hit: resolveClippingFallbackHit(result, fallbackHit),
    };
  }

  if (interactionMode === "quantity-split") {
    return {
      kind: "split-place",
      hit: resolveClippingFallbackHit(result, fallbackHit),
    };
  }

  if (result.kind === "blocked") {
    return { kind: "blocked" };
  }

  const hit = result.kind === "hit" ? result.hit : null;
  if (interactionMode === "measure-distance") {
    return hit ? { kind: "measure-point", hit } : { kind: "none" };
  }

  if (!hit && !additive) {
    return { kind: "clear-selection" };
  }

  if (!hit) {
    return { kind: "none" };
  }

  return {
    kind: "select-entity",
    modelId: hit.modelId,
    expressId: hit.expressId,
    additive,
  };
}

export function createViewportHoverCommand(params: {
  interactionMode: InteractionMode;
  result: PointerPickResult;
  fallbackHit: RaycastHit | null;
}): ViewportHoverCommand {
  const { interactionMode, result, fallbackHit } = params;

  if (interactionMode === "create-clipping-plane") {
    return {
      kind: "clipping-preview",
      hit: resolveClippingFallbackHit(result, fallbackHit),
    };
  }

  if (interactionMode === "quantity-split") {
    return {
      kind: "split-preview",
      hit: resolveClippingFallbackHit(result, fallbackHit),
    };
  }

  if (result.kind === "blocked") {
    return { kind: "blocked" };
  }

  return {
    kind: "hover",
    hit: result.kind === "hit" ? result.hit : null,
  };
}

export function createViewportContextMenuCommand(params: {
  result: PointerPickResult;
  hasSelection: boolean;
}): ViewportContextMenuCommand {
  const { result, hasSelection } = params;
  if (result.kind === "blocked") {
    return { kind: "blocked" };
  }

  const hit = result.kind === "hit" ? result.hit : null;
  return {
    kind: "open",
    modelId: hit?.modelId ?? null,
    expressId: hit?.expressId ?? null,
    selectBeforeOpen: !hasSelection && typeof hit?.expressId === "number",
  };
}
