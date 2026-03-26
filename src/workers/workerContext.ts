import type { IfcAPI } from "web-ifc";
import webIfcWasmUrl from "web-ifc/web-ifc.wasm?url";
import webIfcMtWasmUrl from "web-ifc/web-ifc-mt.wasm?url";
import type { IfcSpatialNode, IfcWorkerResponse, ThreadMode } from "@/types/worker-messages";
import type { RenderCache } from "./ifcGeometryUtils";

// --- Shared mutable state ---

let api: IfcAPI | undefined;
let initPromise: Promise<void> | null = null;
let singleThreaded = true;

export const openModelIds = new Set<number>();
export const renderCaches = new Map<number, RenderCache>();
export const spatialTrees = new Map<number, IfcSpatialNode>();

// --- MT infrastructure ---

function canAttemptMT(): boolean {
  return (
    typeof self !== "undefined" &&
    (self as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated === true &&
    typeof SharedArrayBuffer !== "undefined"
  );
}

function createPthreadBlobUrl(): string {
  const iifeUrl = `${self.location.origin}/__web-ifc-pthread.js`;
  const script = `importScripts(${JSON.stringify(iifeUrl)});`;
  return URL.createObjectURL(new Blob([script], { type: "application/javascript" }));
}

function patchWorkerForPthreads(blobUrl: string): () => void {
  const OriginalWorker = self.Worker;
  self.Worker = class PatchedWorker extends OriginalWorker {
    constructor(scriptUrl: string | URL, options?: WorkerOptions) {
      if (options?.name === "em-pthread") {
        super(blobUrl, options);
      } else {
        super(scriptUrl, options);
      }
    }
  };
  return () => { self.Worker = OriginalWorker; };
}

// --- API lifecycle ---

export function isSingleThreaded(): boolean {
  return singleThreaded;
}

function locateFile(path: string): string {
  if (path.endsWith("web-ifc-mt.wasm")) return webIfcMtWasmUrl;
  if (path.endsWith("web-ifc.wasm")) return webIfcWasmUrl;
  return path;
}

/**
 * Initialize the web-ifc API with the requested thread mode.
 *
 * - `"single"` (default): always single-thread, no special requirements.
 * - `"multi"`: attempt multi-thread if environment supports it.
 *   Falls back to single-thread on failure (with 10s timeout).
 */
export async function ensureApi(threadMode: ThreadMode = "single"): Promise<IfcAPI> {
  // If already initialized with a different mode, reset for re-initialization
  const wantsMT = threadMode === "multi";
  const currentIsMT = api !== undefined && !singleThreaded;
  if (api && wantsMT !== currentIsMT) {
    resetApi();
  }

  if (api) return api;

  if (!initPromise) {
    initPromise = (async () => {
      const { IfcAPI: IfcAPIClass } = await import("web-ifc");

      if (threadMode === "multi" && canAttemptMT()) {
        const blobUrl = createPthreadBlobUrl();
        const restoreWorker = patchWorkerForPthreads(blobUrl);

        try {
          api = new IfcAPIClass();
          const MT_TIMEOUT_MS = 10_000;
          await Promise.race([
            api.Init(locateFile, false),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("MT init timed out")), MT_TIMEOUT_MS),
            ),
          ]);
          singleThreaded = false;
          // eslint-disable-next-line no-console
          console.info("[web-ifc] Initialized in multi-thread mode");
        } catch (mtError) {
          // eslint-disable-next-line no-console
          console.warn("[web-ifc] MT init failed, falling back to single-thread:", mtError);
          api = new IfcAPIClass();
          await api.Init(locateFile, true);
          singleThreaded = true;
          // eslint-disable-next-line no-console
          console.info("[web-ifc] Initialized in single-thread mode (fallback)");
        } finally {
          restoreWorker();
        }
      } else {
        api = new IfcAPIClass();
        await api.Init(locateFile, true);
        singleThreaded = true;
        // eslint-disable-next-line no-console
        console.info("[web-ifc] Initialized in single-thread mode");
      }
    })();
  }

  await initPromise;
  if (!api) throw new Error("web-ifc API가 초기화되지 않았습니다.");
  return api;
}

/** Allow re-initialization with a different thread mode. */
export function resetApi() {
  api = undefined;
  initPromise = null;
  singleThreaded = true;
}

export function getWasmUrl() {
  return singleThreaded ? webIfcWasmUrl : webIfcMtWasmUrl;
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
