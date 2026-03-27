export interface ModelEntityRef {
  modelId: number;
  expressId: number;
}

export type ModelEntityKey = `${number}:${number}`;

export function createModelEntityKey(modelId: number, expressId: number): ModelEntityKey {
  return `${modelId}:${expressId}`;
}

export function parseModelEntityKey(key: string): ModelEntityRef | null {
  const [modelIdRaw, expressIdRaw] = key.split(":");
  const modelId = Number(modelIdRaw);
  const expressId = Number(expressIdRaw);

  if (!Number.isFinite(modelId) || !Number.isFinite(expressId)) {
    return null;
  }

  return { modelId, expressId };
}

export function isSameModelEntityRef(
  left: ModelEntityRef | null | undefined,
  right: ModelEntityRef | null | undefined,
) {
  if (!left || !right) {
    return left === right;
  }

  return left.modelId === right.modelId && left.expressId === right.expressId;
}
