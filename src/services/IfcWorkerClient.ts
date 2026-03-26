import type {
	IfcWorkerRequest,
	IfcWorkerResponse,
	IfcPropertyChange,
	PropertySectionKind,
} from "@/types/worker-messages";

type InitResultPayload = Extract<IfcWorkerResponse, { type: "INIT_RESULT" }>["payload"];
type ModelLoadedPayload = Extract<IfcWorkerResponse, { type: "MODEL_LOADED" }>["payload"];
type RenderCacheReadyPayload = Extract<IfcWorkerResponse, { type: "RENDER_CACHE_READY" }>["payload"];
type RenderChunksPayload = Extract<IfcWorkerResponse, { type: "RENDER_CHUNKS" }>["payload"];
type SpatialStructurePayload = Extract<IfcWorkerResponse, { type: "SPATIAL_STRUCTURE" }>["payload"];
type PropertiesSectionsPayload = Extract<IfcWorkerResponse, { type: "PROPERTIES_SECTIONS" }>["payload"];
type TypeTreePayload = Extract<IfcWorkerResponse, { type: "TYPE_TREE" }>["payload"];

class IfcWorkerClient {
	private worker: Worker | null = null;
	private requestId = 0;
	private pending = new Map<
		number,
		{ resolve: (value: IfcWorkerResponse) => void; reject: (reason?: unknown) => void }
	>();
	private initPromise: Promise<InitResultPayload> | null = null;
	private initResult: InitResultPayload | null = null;

	private ensureWorker() {
		if (this.worker) return this.worker;

		const worker = new Worker(
			new URL("../workers/ifc.worker.ts", import.meta.url),
			{ type: "module" },
		);

		worker.onmessage = (event: MessageEvent<IfcWorkerResponse>) => {
			const response = event.data;
			const pendingRequest = this.pending.get(response.requestId);
			if (!pendingRequest) return;

			if (response.type === "ERROR") {
				this.pending.delete(response.requestId);
				pendingRequest.reject(new Error(response.payload.message));
				return;
			}

			this.pending.delete(response.requestId);
			pendingRequest.resolve(response);
		};

		worker.onerror = (event) => {
			const error = event.error ?? new Error(event.message || "Worker 초기화 오류");
			this.pending.forEach(({ reject }) => reject(error));
			this.pending.clear();
		};

		this.worker = worker;
		return worker;
	}

	private request(message: IfcWorkerRequest, transfer?: Transferable[]) {
		const worker = this.ensureWorker();
		return new Promise<IfcWorkerResponse>((resolve, reject) => {
			this.pending.set(message.requestId, { resolve, reject });
			worker.postMessage(message, transfer ?? []);
		});
	}

	/** Send a typed request and validate the response type. */
	private async typedRequest<R extends IfcWorkerResponse>(
		message: IfcWorkerRequest,
		expectedType: R["type"],
		transfer?: Transferable[],
	): Promise<R["payload"]> {
		const response = await this.request(message, transfer);
		if (response.type !== expectedType) {
			throw new Error(`${message.type} 응답 형식이 올바르지 않습니다. (expected ${expectedType}, got ${response.type})`);
		}
		return (response as R).payload;
	}

	async init() {
		if (this.initResult) return this.initResult;

		if (!this.initPromise) {
			const requestId = ++this.requestId;
			this.initPromise = this.typedRequest<Extract<IfcWorkerResponse, { type: "INIT_RESULT" }>>(
				{ requestId, type: "INIT" },
				"INIT_RESULT",
			).catch((error) => {
				this.initPromise = null;
				throw error;
			});
		}

		const result = await this.initPromise;
		this.initResult = result;
		return result;
	}

	async loadModel(data: ArrayBuffer) {
		const requestId = ++this.requestId;
		return this.typedRequest<Extract<IfcWorkerResponse, { type: "MODEL_LOADED" }>>(
			{ requestId, type: "LOAD_MODEL", payload: { data } }, "MODEL_LOADED", [data],
		);
	}

	async buildRenderCache(modelId: number) {
		const requestId = ++this.requestId;
		return this.typedRequest<Extract<IfcWorkerResponse, { type: "RENDER_CACHE_READY" }>>(
			{ requestId, type: "BUILD_RENDER_CACHE", payload: { modelId } }, "RENDER_CACHE_READY",
		);
	}

	async loadRenderChunks(modelId: number, chunkIds: number[]) {
		const dedupedChunkIds = [...new Set(chunkIds)].filter((id) => Number.isFinite(id));
		const requestId = ++this.requestId;
		return this.typedRequest<Extract<IfcWorkerResponse, { type: "RENDER_CHUNKS" }>>(
			{ requestId, type: "LOAD_RENDER_CHUNKS", payload: { modelId, chunkIds: dedupedChunkIds } }, "RENDER_CHUNKS",
		);
	}

	async loadEdgeChunks(modelId: number, chunkIds: number[]) {
		const dedupedChunkIds = [...new Set(chunkIds)].filter((id) => Number.isFinite(id));
		const requestId = ++this.requestId;
		return this.typedRequest<Extract<IfcWorkerResponse, { type: "EDGE_CHUNKS" }>>(
			{ requestId, type: "LOAD_EDGE_CHUNKS", payload: { modelId, chunkIds: dedupedChunkIds } }, "EDGE_CHUNKS",
		);
	}

	async releaseRenderChunks(modelId: number, chunkIds: number[]) {
		const dedupedChunkIds = [...new Set(chunkIds)].filter((id) => Number.isFinite(id));
		if (dedupedChunkIds.length === 0) return;
		const requestId = ++this.requestId;
		await this.typedRequest<Extract<IfcWorkerResponse, { type: "RENDER_CHUNKS_RELEASED" }>>(
			{ requestId, type: "RELEASE_RENDER_CHUNKS", payload: { modelId, chunkIds: dedupedChunkIds } }, "RENDER_CHUNKS_RELEASED",
		);
	}

	async closeModel(modelId: number) {
		const requestId = ++this.requestId;
		return this.typedRequest<Extract<IfcWorkerResponse, { type: "MODEL_CLOSED" }>>(
			{ requestId, type: "CLOSE_MODEL", payload: { modelId } }, "MODEL_CLOSED",
		);
	}

	async getSpatialStructure(modelId: number) {
		const requestId = ++this.requestId;
		return this.typedRequest<Extract<IfcWorkerResponse, { type: "SPATIAL_STRUCTURE" }>>(
			{ requestId, type: "GET_SPATIAL_STRUCTURE", payload: { modelId } }, "SPATIAL_STRUCTURE",
		);
	}

	async getPropertiesSections(modelId: number, expressId: number, sections: PropertySectionKind[]) {
		const requestId = ++this.requestId;
		return this.typedRequest<Extract<IfcWorkerResponse, { type: "PROPERTIES_SECTIONS" }>>(
			{ requestId, type: "GET_PROPERTIES_SECTIONS", payload: { modelId, expressId, sections: [...new Set(sections)] } }, "PROPERTIES_SECTIONS",
		);
	}

	async getTypeTree(modelId: number, entityIds: number[]) {
		const requestId = ++this.requestId;
		return this.typedRequest<Extract<IfcWorkerResponse, { type: "TYPE_TREE" }>>(
			{ requestId, type: "GET_TYPE_TREE", payload: { modelId, entityIds } }, "TYPE_TREE",
		);
	}

	async updatePropertyValue(modelId: number, change: IfcPropertyChange) {
		const requestId = ++this.requestId;
		return this.typedRequest<Extract<IfcWorkerResponse, { type: "PROPERTY_VALUE_UPDATED" }>>(
			{ requestId, type: "UPDATE_PROPERTY_VALUE", payload: { modelId, change } },
			"PROPERTY_VALUE_UPDATED",
		);
	}

	async exportModel(modelId: number) {
		const requestId = ++this.requestId;
		const payload = await this.typedRequest<Extract<IfcWorkerResponse, { type: "MODEL_EXPORTED" }>>(
			{ requestId, type: "EXPORT_MODEL", payload: { modelId } },
			"MODEL_EXPORTED",
		);
		return payload;
	}

	async exportIfcb(modelId: number) {
		const requestId = ++this.requestId;
		return this.typedRequest<Extract<IfcWorkerResponse, { type: "IFCB_EXPORTED" }>>(
			{ requestId, type: "EXPORT_IFCB", payload: { modelId } },
			"IFCB_EXPORTED",
		);
	}
}

export const ifcWorkerClient = new IfcWorkerClient();
