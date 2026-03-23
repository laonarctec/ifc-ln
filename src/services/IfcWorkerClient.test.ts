import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Worker ─────────────────────────────────────────

let lastWorkerInstance: MockWorkerInstance;

class MockWorkerInstance {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  respond(data: Record<string, unknown>) {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  emitError(message: string) {
    this.onerror?.(new ErrorEvent("error", { message }));
  }
}

vi.stubGlobal("Worker", function MockWorker() {
  lastWorkerInstance = new MockWorkerInstance();
  return lastWorkerInstance;
});

// Import the module after Worker is stubbed.
// We need the class, not the singleton — so we extract initPromise-related
// behavior by creating fresh instances.
const mod = await import("./IfcWorkerClient");

// The module exports a singleton `ifcWorkerClient`. We'll test with it
// after resetting its private state.
function resetClient() {
  const client = mod.ifcWorkerClient as unknown as {
    worker: unknown;
    requestId: number;
    pending: Map<number, unknown>;
    initPromise: unknown;
    initResult: unknown;
  };
  client.worker = null;
  client.requestId = 0;
  client.pending.clear();
  client.initPromise = null;
  client.initResult = null;
}

// ── Tests ───────────────────────────────────────────────

describe("IfcWorkerClient", () => {
  beforeEach(() => {
    resetClient();
  });

  it("init succeeds and caches result", async () => {
    const initPromise = mod.ifcWorkerClient.init();

    expect(lastWorkerInstance.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "INIT" }),
      [],
    );

    const requestId =
      lastWorkerInstance.postMessage.mock.calls[0][0].requestId;
    lastWorkerInstance.respond({
      requestId,
      type: "INIT_RESULT",
      payload: { status: "ready", version: "0.0.77" },
    });

    const result = await initPromise;
    expect(result).toEqual({ status: "ready", version: "0.0.77" });

    // Second call returns cached result without another postMessage
    lastWorkerInstance.postMessage.mockClear();
    const cachedResult = await mod.ifcWorkerClient.init();
    expect(cachedResult).toEqual(result);
    expect(lastWorkerInstance.postMessage).not.toHaveBeenCalled();
  });

  it("init failure clears cached promise so retry is possible", async () => {
    const firstAttempt = mod.ifcWorkerClient.init();

    const requestId =
      lastWorkerInstance.postMessage.mock.calls[0][0].requestId;
    lastWorkerInstance.respond({
      requestId,
      type: "ERROR",
      payload: { message: "WASM load failed" },
    });

    await expect(firstAttempt).rejects.toThrow("WASM load failed");

    // Retry should send a new INIT message
    lastWorkerInstance.postMessage.mockClear();
    const secondAttempt = mod.ifcWorkerClient.init();
    expect(lastWorkerInstance.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "INIT" }),
      [],
    );

    const newRequestId =
      lastWorkerInstance.postMessage.mock.calls[0][0].requestId;
    lastWorkerInstance.respond({
      requestId: newRequestId,
      type: "INIT_RESULT",
      payload: { status: "ready", version: "0.0.77" },
    });

    const result = await secondAttempt;
    expect(result).toEqual({ status: "ready", version: "0.0.77" });
  });

  it("worker onerror rejects all pending requests", async () => {
    const initPromise = mod.ifcWorkerClient.init();

    lastWorkerInstance.emitError("Worker crashed");

    await expect(initPromise).rejects.toThrow("Worker crashed");
  });
});
