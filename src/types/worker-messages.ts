export type IfcWorkerRequest =
  | {
    requestId: number;
    type: 'INIT';
  }
  | {
    requestId: number;
    type: 'LOAD_MODEL';
    payload: {
      data: ArrayBuffer;
    };
  }
  | {
    requestId: number;
    type: 'CLOSE_MODEL';
    payload: {
      modelId: number;
    };
  }
  | {
    requestId: number;
    type: 'BUILD_RENDER_CACHE';
    payload: {
      modelId: number;
    };
  }
  | {
    requestId: number;
    type: 'LOAD_RENDER_CHUNKS';
    payload: {
      modelId: number;
      chunkIds: number[];
    };
  }
  | {
    requestId: number;
    type: 'RELEASE_RENDER_CHUNKS';
    payload: {
      modelId: number;
      chunkIds: number[];
    };
  }
  | {
    requestId: number;
    type: 'GET_SPATIAL_STRUCTURE';
    payload: {
      modelId: number;
    };
  }
  | {
    requestId: number;
    type: 'GET_PROPERTIES_SECTIONS';
    payload: {
      modelId: number;
      expressId: number;
      sections: PropertySectionKind[];
    };
  }
  | {
    requestId: number;
    type: 'GET_TYPE_TREE';
    payload: {
      modelId: number;
      entityIds: number[];
    };
  };

export interface IfcSpatialNode {
  expressID: number;
  type: string;
  name?: string | null;
  elevation?: number | null;
  elements?: IfcSpatialElement[];
  children: IfcSpatialNode[];
}

export interface IfcSpatialElement {
  expressID: number;
  ifcType: string;
  name: string | null;
}

export interface IfcPropertyEntry {
  key: string;
  value: string;
}

export interface IfcPropertySection {
  expressID: number | null;
  title: string;
  ifcType: string | null;
  entries: IfcPropertyEntry[];
}

export interface IfcElementProperties {
  expressID: number | null;
  globalId: string | null;
  ifcType: string | null;
  name: string | null;
  loadedSections: PropertySectionKind[];
  attributes: IfcPropertyEntry[];
  propertySets: IfcPropertySection[];
  quantitySets: IfcPropertySection[];
  typeProperties: IfcPropertySection[];
  materials: IfcPropertySection[];
  relations: IfcPropertySection[];
  inverseRelations: IfcPropertySection[];
}

export type PropertySectionKind =
  | 'attributes'
  | 'propertySets'
  | 'quantitySets'
  | 'typeProperties'
  | 'materials'
  | 'relations'
  | 'inverseRelations';

export interface IfcTypeTreeInstance {
  expressID: number;
  ifcType: string;
  name: string | null;
}

export interface IfcTypeTreeFamily {
  typeExpressID: number | null;
  typeClassName: string;
  typeName: string;
  entityIds: number[];
  children: IfcTypeTreeInstance[];
  isUntyped?: boolean;
}

export interface IfcTypeTreeGroup {
  typeClassName: string;
  entityIds: number[];
  families: IfcTypeTreeFamily[];
}

export interface TransferableMeshData {
  expressId: number;
  geometryExpressId: number;
  ifcType: string;
  vertices: Float32Array;
  indices: Uint32Array;
  color: [number, number, number, number];
  transform: number[];
}

export interface RenderChunkMeta {
  chunkId: number;
  storeyId: number | null;
  entityIds: number[];
  ifcTypes: string[];
  meshCount: number;
  vertexCount: number;
  indexCount: number;
  bounds: [number, number, number, number, number, number];
}

export interface RenderManifest {
  modelId: number;
  meshCount: number;
  vertexCount: number;
  indexCount: number;
  chunkCount: number;
  modelBounds: [number, number, number, number, number, number];
  initialChunkIds: number[];
  chunks: RenderChunkMeta[];
}

export interface TransferableEdgeData {
  geometryExpressId: number;
  edgePositions: Float32Array;  // [x0,y0,z0, x1,y1,z1, ...]
  edgeCount: number;
}

export interface RenderChunkPayload {
  chunkId: number;
  meshes: TransferableMeshData[];
  edges: TransferableEdgeData[];
}

export type IfcWorkerResponse =
  | {
    requestId: number;
    type: 'INIT_RESULT';
    payload: {
      status: 'ready';
      wasmPath: string;
      singleThreaded: boolean;
    };
  }
  | {
    requestId: number;
    type: 'MODEL_LOADED';
    payload: {
      modelId: number;
      schema: string;
      maxExpressId: number;
    };
  }
  | {
    requestId: number;
    type: 'MODEL_CLOSED';
    payload: {
      modelId: number;
    };
  }
  | {
    requestId: number;
    type: 'RENDER_CACHE_READY';
    payload: {
      manifest: RenderManifest;
      cacheHit: boolean;
    };
  }
  | {
    requestId: number;
    type: 'RENDER_CHUNKS';
    payload: {
      modelId: number;
      chunks: RenderChunkPayload[];
    };
  }
  | {
    requestId: number;
    type: 'RENDER_CHUNKS_RELEASED';
    payload: {
      modelId: number;
      releasedChunkIds: number[];
    };
  }
  | {
    requestId: number;
    type: 'SPATIAL_STRUCTURE';
    payload: {
      tree: IfcSpatialNode;
    };
  }
  | {
    requestId: number;
    type: 'PROPERTIES_SECTIONS';
    payload: {
      properties: IfcElementProperties;
      sections: PropertySectionKind[];
    };
  }
  | {
    requestId: number;
    type: 'TYPE_TREE';
    payload: {
      groups: IfcTypeTreeGroup[];
    };
  }
  | {
    requestId: number;
    type: 'ERROR';
    payload: {
      message: string;
    };
  };
