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
      type: 'STREAM_MESHES';
      payload: {
        modelId: number;
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
      type: 'GET_PROPERTIES';
      payload: {
        modelId: number;
        expressId: number;
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
  attributes: IfcPropertyEntry[];
  propertySets: IfcPropertySection[];
  quantitySets: IfcPropertySection[];
  typeProperties: IfcPropertySection[];
  materials: IfcPropertySection[];
  relations: IfcPropertySection[];
  inverseRelations: IfcPropertySection[];
}

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
      type: 'MESHES_CHUNK';
      payload: {
        meshes: TransferableMeshData[];
        chunkIndex: number;
        accumulatedMeshCount: number;
        accumulatedVertexCount: number;
        accumulatedIndexCount: number;
      };
    }
  | {
      requestId: number;
      type: 'MESHES_STREAMED';
      payload: {
        meshCount: number;
        vertexCount: number;
        indexCount: number;
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
      type: 'PROPERTIES';
      payload: {
        properties: IfcElementProperties;
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
