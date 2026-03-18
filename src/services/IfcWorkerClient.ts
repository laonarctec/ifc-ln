import type {
	IfcWorkerRequest,
	IfcWorkerResponse,
	PropertySectionKind,
} from "@/types/worker-messages";

type InitResultPayload = Extract<
	IfcWorkerResponse,
	{ type: "INIT_RESULT" }
>["payload"];
type ModelLoadedPayload = Extract<
	IfcWorkerResponse,
	{ type: "MODEL_LOADED" }
>["payload"];
type RenderCacheReadyPayload = Extract<
	IfcWorkerResponse,
	{ type: "RENDER_CACHE_READY" }
>["payload"];
type RenderChunksPayload = Extract<
	IfcWorkerResponse,
	{ type: "RENDER_CHUNKS" }
>["payload"];
type SpatialStructurePayload = Extract<
	IfcWorkerResponse,
	{ type: "SPATIAL_STRUCTURE" }
>["payload"];
type PropertiesSectionsPayload = Extract<
	IfcWorkerResponse,
	{ type: "PROPERTIES_SECTIONS" }
>["payload"];
type TypeTreePayload = Extract<
	IfcWorkerResponse,
	{ type: "TYPE_TREE" }
>["payload"];

class IfcWorkerClient {
	private worker: Worker | null = null;
	private requestId = 0;
	private pending = new Map<
		number,
		{
			resolve: (value: IfcWorkerResponse) => void;
			reject: (reason?: unknown) => void;
		}
	>();
	private initPromise: Promise<InitResultPayload> | null = null;
	private initResult: InitResultPayload | null = null;

	private ensureWorker() {
		if (this.worker) {
			return this.worker;
		}

		const worker = new Worker(
			new URL("../workers/ifc.worker.ts", import.meta.url),
			{
				type: "module",
			},
		);

		worker.onmessage = (event: MessageEvent<IfcWorkerResponse>) => {
			const response = event.data;
			const pendingRequest = this.pending.get(response.requestId);
			if (!pendingRequest) {
				return;
			}

			if (response.type === "ERROR") {
				this.pending.delete(response.requestId);
				pendingRequest.reject(new Error(response.payload.message));
				return;
			}

			this.pending.delete(response.requestId);
			pendingRequest.resolve(response);
		};

		worker.onerror = (event) => {
			const error =
				event.error ?? new Error(event.message || "Worker 초기화 오류");
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

	async init() {
		if (this.initResult) {
			return this.initResult;
		}

		if (!this.initPromise) {
			const requestId = ++this.requestId;
			this.initPromise = this.request({ requestId, type: "INIT" }).then(
				(response) => {
					if (response.type !== "INIT_RESULT") {
						throw new Error("INIT 응답 형식이 올바르지 않습니다.");
					}

					this.initResult = response.payload;
					return response.payload;
				},
			);
		}

		return this.initPromise;
	}

	async loadModel(data: ArrayBuffer) {
		const requestId = ++this.requestId;
		const response = await this.request(
			{
				requestId,
				type: "LOAD_MODEL",
				payload: { data },
			},
			[data],
		);

		if (response.type !== "MODEL_LOADED") {
			throw new Error("LOAD_MODEL 응답 형식이 올바르지 않습니다.");
		}

		return response.payload satisfies ModelLoadedPayload;
	}

	async buildRenderCache(modelId: number) {
		const requestId = ++this.requestId;
		const response = await this.request({
			requestId,
			type: "BUILD_RENDER_CACHE",
			payload: { modelId },
		});

		if (response.type !== "RENDER_CACHE_READY") {
			throw new Error(
				"BUILD_RENDER_CACHE 응답 형식이 올바르지 않습니다.",
			);
		}

		return response.payload satisfies RenderCacheReadyPayload;
	}

	async loadRenderChunks(modelId: number, chunkIds: number[]) {
		const dedupedChunkIds = [...new Set(chunkIds)].filter((chunkId) =>
			Number.isFinite(chunkId),
		);
		const requestId = ++this.requestId;
		const response = await this.request({
			requestId,
			type: "LOAD_RENDER_CHUNKS",
			payload: { modelId, chunkIds: dedupedChunkIds },
		});

		if (response.type !== "RENDER_CHUNKS") {
			throw new Error(
				"LOAD_RENDER_CHUNKS 응답 형식이 올바르지 않습니다.",
			);
		}

		return response.payload satisfies RenderChunksPayload;
	}

	async releaseRenderChunks(modelId: number, chunkIds: number[]) {
		const dedupedChunkIds = [...new Set(chunkIds)].filter((chunkId) =>
			Number.isFinite(chunkId),
		);
		if (dedupedChunkIds.length === 0) {
			return;
		}

		const requestId = ++this.requestId;
		const response = await this.request({
			requestId,
			type: "RELEASE_RENDER_CHUNKS",
			payload: { modelId, chunkIds: dedupedChunkIds },
		});

		if (response.type !== "RENDER_CHUNKS_RELEASED") {
			throw new Error(
				"RELEASE_RENDER_CHUNKS 응답 형식이 올바르지 않습니다.",
			);
		}
	}

	async closeModel(modelId: number) {
		const requestId = ++this.requestId;
		const response = await this.request({
			requestId,
			type: "CLOSE_MODEL",
			payload: { modelId },
		});

		if (response.type !== "MODEL_CLOSED") {
			throw new Error("CLOSE_MODEL 응답 형식이 올바르지 않습니다.");
		}

		return response.payload;
	}

	async getSpatialStructure(modelId: number) {
		const requestId = ++this.requestId;
		const response = await this.request({
			requestId,
			type: "GET_SPATIAL_STRUCTURE",
			payload: { modelId },
		});

		if (response.type !== "SPATIAL_STRUCTURE") {
			throw new Error(
				"GET_SPATIAL_STRUCTURE 응답 형식이 올바르지 않습니다.",
			);
		}

		return response.payload satisfies SpatialStructurePayload;
	}

	async getPropertiesSections(
		modelId: number,
		expressId: number,
		sections: PropertySectionKind[],
	) {
		const requestId = ++this.requestId;
		const response = await this.request({
			requestId,
			type: "GET_PROPERTIES_SECTIONS",
			payload: { modelId, expressId, sections: [...new Set(sections)] },
		});

		if (response.type !== "PROPERTIES_SECTIONS") {
			throw new Error(
				"GET_PROPERTIES_SECTIONS 응답 형식이 올바르지 않습니다.",
			);
		}

		return response.payload satisfies PropertiesSectionsPayload;
	}

	async getTypeTree(modelId: number, entityIds: number[]) {
		const requestId = ++this.requestId;
		const response = await this.request({
			requestId,
			type: "GET_TYPE_TREE",
			payload: { modelId, entityIds },
		});

		if (response.type !== "TYPE_TREE") {
			throw new Error("GET_TYPE_TREE 응답 형식이 올바르지 않습니다.");
		}

		return response.payload satisfies TypeTreePayload;
	}
}

export const ifcWorkerClient = new IfcWorkerClient();
