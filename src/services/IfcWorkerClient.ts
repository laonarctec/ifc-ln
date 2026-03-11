import type { IfcWorkerRequest, IfcWorkerResponse } from '@/types/worker-messages';

type InitResultPayload = Extract<IfcWorkerResponse, { type: 'INIT_RESULT' }>['payload'];
type ModelLoadedPayload = Extract<IfcWorkerResponse, { type: 'MODEL_LOADED' }>['payload'];
type MeshesChunkPayload = Extract<IfcWorkerResponse, { type: 'MESHES_CHUNK' }>['payload'];
type MeshesStreamedPayload = Extract<IfcWorkerResponse, { type: 'MESHES_STREAMED' }>['payload'];
type SpatialStructurePayload = Extract<IfcWorkerResponse, { type: 'SPATIAL_STRUCTURE' }>['payload'];
type PropertiesPayload = Extract<IfcWorkerResponse, { type: 'PROPERTIES' }>['payload'];
type TypeTreePayload = Extract<IfcWorkerResponse, { type: 'TYPE_TREE' }>['payload'];

class IfcWorkerClient {
  private worker: Worker | null = null;
  private requestId = 0;
  private pending = new Map<
    number,
    {
      resolve: (value: IfcWorkerResponse) => void;
      reject: (reason?: unknown) => void;
      onChunk?: (payload: MeshesChunkPayload) => void;
    }
  >();
  private initPromise: Promise<InitResultPayload> | null = null;
  private initResult: InitResultPayload | null = null;

  private ensureWorker() {
    if (this.worker) {
      return this.worker;
    }

    const worker = new Worker(new URL('../workers/ifc.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent<IfcWorkerResponse>) => {
      const response = event.data;
      const pendingRequest = this.pending.get(response.requestId);
      if (!pendingRequest) {
        return;
      }

      if (response.type === 'ERROR') {
        this.pending.delete(response.requestId);
        pendingRequest.reject(new Error(response.payload.message));
        return;
      }

      if (response.type === 'MESHES_CHUNK') {
        pendingRequest.onChunk?.(response.payload);
        return;
      }

      this.pending.delete(response.requestId);
      pendingRequest.resolve(response);
    };

    worker.onerror = (event) => {
      const error = event.error ?? new Error(event.message || 'Worker 초기화 오류');
      this.pending.forEach(({ reject }) => reject(error));
      this.pending.clear();
    };

    this.worker = worker;
    return worker;
  }

  private request(
    message: IfcWorkerRequest,
    transfer?: Transferable[],
    options?: {
      onChunk?: (payload: MeshesChunkPayload) => void;
    }
  ) {
    const worker = this.ensureWorker();

    return new Promise<IfcWorkerResponse>((resolve, reject) => {
      this.pending.set(message.requestId, { resolve, reject, onChunk: options?.onChunk });
      worker.postMessage(message, transfer ?? []);
    });
  }

  async init() {
    if (this.initResult) {
      return this.initResult;
    }

    if (!this.initPromise) {
      const requestId = ++this.requestId;
      this.initPromise = this.request({ requestId, type: 'INIT' }).then((response) => {
        if (response.type !== 'INIT_RESULT') {
          throw new Error('INIT 응답 형식이 올바르지 않습니다.');
        }

        this.initResult = response.payload;
        return response.payload;
      });
    }

    return this.initPromise;
  }

  async loadModel(data: ArrayBuffer) {
    const requestId = ++this.requestId;
    const response = await this.request(
      {
        requestId,
        type: 'LOAD_MODEL',
        payload: { data },
      },
      [data]
    );

    if (response.type !== 'MODEL_LOADED') {
      throw new Error('LOAD_MODEL 응답 형식이 올바르지 않습니다.');
    }

    return response.payload satisfies ModelLoadedPayload;
  }

  async closeModel(modelId: number) {
    const requestId = ++this.requestId;
    const response = await this.request({
      requestId,
      type: 'CLOSE_MODEL',
      payload: { modelId },
    });

    if (response.type !== 'MODEL_CLOSED') {
      throw new Error('CLOSE_MODEL 응답 형식이 올바르지 않습니다.');
    }

    return response.payload;
  }

  async streamMeshes(
    modelId: number,
    onChunk?: (payload: MeshesChunkPayload) => void
  ) {
    const requestId = ++this.requestId;
    const response = await this.request(
      {
        requestId,
        type: 'STREAM_MESHES',
        payload: { modelId },
      },
      undefined,
      { onChunk }
    );

    if (response.type !== 'MESHES_STREAMED') {
      throw new Error('STREAM_MESHES 응답 형식이 올바르지 않습니다.');
    }

    return response.payload satisfies MeshesStreamedPayload;
  }

  async getSpatialStructure(modelId: number) {
    const requestId = ++this.requestId;
    const response = await this.request({
      requestId,
      type: 'GET_SPATIAL_STRUCTURE',
      payload: { modelId },
    });

    if (response.type !== 'SPATIAL_STRUCTURE') {
      throw new Error('GET_SPATIAL_STRUCTURE 응답 형식이 올바르지 않습니다.');
    }

    return response.payload satisfies SpatialStructurePayload;
  }

  async getProperties(modelId: number, expressId: number) {
    const requestId = ++this.requestId;
    const response = await this.request({
      requestId,
      type: 'GET_PROPERTIES',
      payload: { modelId, expressId },
    });

    if (response.type !== 'PROPERTIES') {
      throw new Error('GET_PROPERTIES 응답 형식이 올바르지 않습니다.');
    }

    return response.payload satisfies PropertiesPayload;
  }

  async getTypeTree(modelId: number, entityIds: number[]) {
    const requestId = ++this.requestId;
    const response = await this.request({
      requestId,
      type: 'GET_TYPE_TREE',
      payload: { modelId, entityIds },
    });

    if (response.type !== 'TYPE_TREE') {
      throw new Error('GET_TYPE_TREE 응답 형식이 올바르지 않습니다.');
    }

    return response.payload satisfies TypeTreePayload;
  }
}

export const ifcWorkerClient = new IfcWorkerClient();
