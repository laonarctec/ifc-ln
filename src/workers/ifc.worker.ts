/// <reference lib="webworker" />

import { IfcAPI } from 'web-ifc';
import webIfcWasmUrl from 'web-ifc/web-ifc.wasm?url';
import type {
  IfcElementProperties,
  IfcWorkerRequest,
  IfcWorkerResponse,
  TransferableMeshData,
} from '@/types/worker-messages';

const workerScope = self as unknown as Worker;

let api: IfcAPI | undefined;
let initPromise: Promise<void> | null = null;
const openModelIds = new Set<number>();

async function ensureApi(): Promise<IfcAPI> {
  if (api) {
    return api;
  }

  if (!initPromise) {
    api = new IfcAPI();
    initPromise = api.Init(
      (path) => {
        if (path.endsWith('web-ifc.wasm')) {
          return webIfcWasmUrl;
        }
        return path;
      },
      true
    );
  }

  await initPromise;
  if (!api) {
    throw new Error('web-ifc API가 초기화되지 않았습니다.');
  }

  return api;
}

function postResponse(message: IfcWorkerResponse) {
  workerScope.postMessage(message);
}

function safeDelete(value: unknown) {
  if (
    typeof value === 'object' &&
    value !== null &&
    'delete' in value &&
    typeof (value as { delete?: unknown }).delete === 'function'
  ) {
    (value as { delete: () => void }).delete();
  }
}

function readIfcText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null && 'value' in value) {
    const nestedValue = (value as { value?: unknown }).value;
    if (typeof nestedValue === 'string') {
      return nestedValue;
    }
  }

  return null;
}

function formatIfcValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const preview = value.slice(0, 4).map((item) => formatIfcValue(item)).join(', ');
    return value.length > 4 ? `[${preview}, ...]` : `[${preview}]`;
  }

  if (typeof value === 'object') {
    if ('expressID' in value && typeof (value as { expressID?: unknown }).expressID === 'number') {
      return `#${(value as { expressID: number }).expressID}`;
    }

    if ('value' in value) {
      return formatIfcValue((value as { value?: unknown }).value);
    }

    const entries = Object.entries(value as Record<string, unknown>).slice(0, 4);
    if (entries.length === 0) {
      return '{}';
    }

    return entries
      .map(([key, nestedValue]) => `${key}: ${formatIfcValue(nestedValue)}`)
      .join(', ');
  }

  return String(value);
}

function createPropertyPayload(
  activeApi: IfcAPI,
  modelId: number,
  expressId: number
): IfcElementProperties {
  const line = activeApi.GetLine(modelId, expressId, false, false) as Record<string, unknown> | null;
  const typeCode = activeApi.GetLineType(modelId, expressId);
  const ifcType = activeApi.GetNameFromTypeCode(typeCode) ?? null;

  if (!line) {
    return {
      expressID: expressId,
      globalId: null,
      ifcType,
      name: null,
      attributes: [],
    };
  }

  const attributes = Object.entries(line)
    .filter(([key]) => !['type', 'GlobalId', 'Name'].includes(key))
    .map(([key, value]) => ({
      key,
      value: formatIfcValue(value),
    }));

  return {
    expressID: expressId,
    globalId: readIfcText(line.GlobalId) ?? null,
    ifcType,
    name: readIfcText(line.Name) ?? null,
    attributes,
  };
}

workerScope.onmessage = async (event: MessageEvent<IfcWorkerRequest>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'INIT': {
        await ensureApi();
        postResponse({
          requestId: message.requestId,
          type: 'INIT_RESULT',
          payload: {
            status: 'ready',
            wasmPath: webIfcWasmUrl,
            singleThreaded: true,
          },
        });
        break;
      }

      case 'LOAD_MODEL': {
        const activeApi = await ensureApi();
        const modelId = activeApi.OpenModel(new Uint8Array(message.payload.data));

        if (modelId < 0) {
          throw new Error('IFC 모델을 열지 못했습니다.');
        }

        openModelIds.add(modelId);

        postResponse({
          requestId: message.requestId,
          type: 'MODEL_LOADED',
          payload: {
            modelId,
            schema: activeApi.GetModelSchema(modelId),
            maxExpressId: activeApi.GetMaxExpressID(modelId),
          },
        });
        break;
      }

      case 'CLOSE_MODEL': {
        const activeApi = await ensureApi();
        activeApi.CloseModel(message.payload.modelId);
        openModelIds.delete(message.payload.modelId);

        postResponse({
          requestId: message.requestId,
          type: 'MODEL_CLOSED',
          payload: {
            modelId: message.payload.modelId,
          },
        });
        break;
      }

      case 'STREAM_MESHES': {
        const activeApi = await ensureApi();
        const meshes: TransferableMeshData[] = [];
        const transferables: Transferable[] = [];
        let vertexCount = 0;
        let indexCount = 0;

        activeApi.StreamAllMeshes(message.payload.modelId, (flatMesh) => {
          const typeCode = activeApi.GetLineType(message.payload.modelId, flatMesh.expressID);
          const ifcType = activeApi.GetNameFromTypeCode(typeCode);

          for (let i = 0; i < flatMesh.geometries.size(); i += 1) {
            const placedGeometry = flatMesh.geometries.get(i);
            const geometry = activeApi.GetGeometry(message.payload.modelId, placedGeometry.geometryExpressID);
            const rawVertices = activeApi.GetVertexArray(
              geometry.GetVertexData(),
              geometry.GetVertexDataSize()
            );
            const rawIndices = activeApi.GetIndexArray(
              geometry.GetIndexData(),
              geometry.GetIndexDataSize()
            );

            const vertices = new Float32Array(rawVertices);
            const indices = new Uint32Array(rawIndices);

            vertexCount += vertices.length;
            indexCount += indices.length;

            transferables.push(vertices.buffer, indices.buffer);
            meshes.push({
              expressId: flatMesh.expressID,
              geometryExpressId: placedGeometry.geometryExpressID,
              ifcType,
              vertices,
              indices,
              color: [
                placedGeometry.color.x,
                placedGeometry.color.y,
                placedGeometry.color.z,
                placedGeometry.color.w,
              ],
              transform: [...placedGeometry.flatTransformation],
            });

            safeDelete(geometry);
          }

          safeDelete(flatMesh);
        });

        workerScope.postMessage(
          {
            requestId: message.requestId,
            type: 'MESHES_STREAMED',
            payload: {
              meshes,
              meshCount: meshes.length,
              vertexCount,
              indexCount,
            },
          } satisfies IfcWorkerResponse,
          transferables
        );
        break;
      }

      case 'GET_SPATIAL_STRUCTURE': {
        const activeApi = await ensureApi();
        const tree = await activeApi.properties.getSpatialStructure(message.payload.modelId, false);

        postResponse({
          requestId: message.requestId,
          type: 'SPATIAL_STRUCTURE',
          payload: {
            tree,
          },
        });
        break;
      }

      case 'GET_PROPERTIES': {
        const activeApi = await ensureApi();
        const properties = createPropertyPayload(
          activeApi,
          message.payload.modelId,
          message.payload.expressId
        );

        postResponse({
          requestId: message.requestId,
          type: 'PROPERTIES',
          payload: {
            properties,
          },
        });
        break;
      }
    }
  } catch (error) {
    postResponse({
      requestId: message.requestId,
      type: 'ERROR',
      payload: {
        message: error instanceof Error ? error.message : '알 수 없는 web-ifc worker 오류',
      },
    });
  }
};

export {};
