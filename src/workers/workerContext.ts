import type { IfcAPI } from "web-ifc";
import webIfcWasmUrl from "web-ifc/web-ifc.wasm?url";
import type { IfcSpatialNode, IfcWorkerResponse } from "@/types/worker-messages";
import type { RenderCache } from "./ifcGeometryUtils";

// --- Shared mutable state ---

let api: IfcAPI | undefined;
let initPromise: Promise<void> | null = null;

export const openModelIds = new Set<number>();
export const renderCaches = new Map<number, RenderCache>();
export const spatialTrees = new Map<number, IfcSpatialNode>();

// --- API lifecycle ---

// NOTE: web-ifc MT mode (forceSingleThread=false) spawns internal pthread
// workers that require specific JS worker files. These files are not properly
// resolved by Vite dev server, causing cascading "Cannot use import statement
// outside a module" errors on Windows and silent failures on Mac.
// MT mode is disabled until a proper worker bundling strategy is in place.
// To re-enable, add SharedArrayBuffer + crossOriginIsolated detection and
// import web-ifc-mt.wasm. See docs/ifcWeb성능개선전략.md §4.1.

export function isSingleThreaded(): boolean {
  return true;
}

export async function ensureApi(): Promise<IfcAPI> {
  if (api) return api;

  if (!initPromise) {
    const { IfcAPI: IfcAPIClass } = await import("web-ifc");
    api = new IfcAPIClass();
    initPromise = api.Init((path) => {
      if (path.endsWith("web-ifc.wasm")) return webIfcWasmUrl;
      return path;
    }, true);
  }

  await initPromise;
  if (!api) throw new Error("web-ifc API가 초기화되지 않았습니다.");
  return api;
}

export function getWasmUrl() {
  return webIfcWasmUrl;
}

// --- Response helper ---

const workerScope = self as unknown as Worker;

export function postResponse(message: IfcWorkerResponse) {
  workerScope.postMessage(message);
}

export function postWithTransfer(
  message: IfcWorkerResponse,
  transferables: Transferable[],
) {
  workerScope.postMessage(message, transferables);
}
