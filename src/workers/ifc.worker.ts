/// <reference lib="webworker" />

import type { IfcWorkerRequest } from "@/types/worker-messages";
import { ensureApi, postResponse, getWasmUrl } from "./workerContext";
import {
  handleLoadModel,
  handleBuildRenderCache,
  handleLoadRenderChunks,
  handleReleaseRenderChunks,
  handleCloseModel,
} from "./handlers/geometryHandler";
import { handleGetSpatialStructure } from "./handlers/spatialHandler";
import { handleGetPropertiesSections } from "./handlers/propertyHandler";
import { handleGetTypeTree } from "./handlers/typeTreeHandler";

const workerScope = self as unknown as Worker;

workerScope.onmessage = async (event: MessageEvent<IfcWorkerRequest>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case "INIT": {
        await ensureApi();
        postResponse({
          requestId: message.requestId,
          type: "INIT_RESULT",
          payload: { status: "ready", wasmPath: getWasmUrl(), singleThreaded: true },
        });
        break;
      }

      case "LOAD_MODEL":
        await handleLoadModel(message.requestId, message.payload.data);
        break;

      case "BUILD_RENDER_CACHE":
        await handleBuildRenderCache(message.requestId, message.payload.modelId);
        break;

      case "LOAD_RENDER_CHUNKS":
        handleLoadRenderChunks(message.requestId, message.payload.modelId, message.payload.chunkIds);
        break;

      case "RELEASE_RENDER_CHUNKS":
        handleReleaseRenderChunks(message.requestId, message.payload.modelId, message.payload.chunkIds);
        break;

      case "CLOSE_MODEL":
        await handleCloseModel(message.requestId, message.payload.modelId);
        break;

      case "GET_SPATIAL_STRUCTURE":
        await handleGetSpatialStructure(message.requestId, message.payload.modelId);
        break;

      case "GET_PROPERTIES_SECTIONS":
        await handleGetPropertiesSections(
          message.requestId, message.payload.modelId,
          message.payload.expressId, message.payload.sections,
        );
        break;

      case "GET_TYPE_TREE":
        await handleGetTypeTree(message.requestId, message.payload.modelId, message.payload.entityIds);
        break;
    }
  } catch (error) {
    postResponse({
      requestId: message.requestId,
      type: "ERROR",
      payload: { message: error instanceof Error ? error.message : "알 수 없는 web-ifc worker 오류" },
    });
  }
};

export {};
