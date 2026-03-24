import { INTEGER, LABEL, REAL } from "web-ifc";
import type { IfcAPI } from "web-ifc";
import type {
  IfcEditableValueType,
  IfcPropertyChange,
  IfcWorkerResponse,
} from "@/types/worker-messages";
import { createPropertyPayload } from "./propertyHandler";
import { ensureApi, postResponse, postWithTransfer } from "../workerContext";

function parseNextValue(valueType: IfcEditableValueType, value: string) {
  if (valueType === "number" || valueType === "integer") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`숫자 값이 필요합니다: ${value}`);
    }
    return valueType === "integer" ? Math.trunc(parsed) : parsed;
  }

  if (valueType === "boolean") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "yes" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "no" || normalized === "0") {
      return false;
    }
    throw new Error(`불린 값이 필요합니다: ${value}`);
  }

  return value;
}

function createTypedValue(
  activeApi: IfcAPI,
  modelId: number,
  existingValue: unknown,
  valueType: IfcEditableValueType,
  parsedValue: string | number | boolean,
) {
  if (
    typeof existingValue === "object" &&
    existingValue !== null &&
    "type" in existingValue &&
    typeof (existingValue as { type?: unknown }).type === "number"
  ) {
    return activeApi.CreateIfcType(
      modelId,
      (existingValue as { type: number }).type,
      parsedValue,
    );
  }

  switch (valueType) {
    case "number":
      return activeApi.CreateIfcType(modelId, REAL, parsedValue);
    case "integer":
      return activeApi.CreateIfcType(modelId, INTEGER, parsedValue);
    case "string":
      return typeof existingValue === "string"
        ? parsedValue
        : activeApi.CreateIfcType(modelId, LABEL, parsedValue);
    case "boolean":
      return parsedValue;
    default:
      return parsedValue;
  }
}

export async function handleUpdatePropertyValue(
  requestId: number,
  modelId: number,
  change: IfcPropertyChange,
) {
  const activeApi = await ensureApi();
  const line = activeApi.GetLine(
    modelId,
    change.target.lineExpressId,
    false,
    false,
  ) as Record<string, unknown> | null;

  if (!line) {
    throw new Error(`IFC line #${change.target.lineExpressId}를 찾을 수 없습니다.`);
  }

  const parsedValue = parseNextValue(change.valueType, change.nextValue);
  const existingValue = line[change.target.attributeName];
  line[change.target.attributeName] = createTypedValue(
    activeApi,
    modelId,
    existingValue,
    change.valueType,
    parsedValue,
  );
  activeApi.WriteLine(modelId, line as never);

  const sections = [...new Set(["attributes", change.sectionKind])] as Array<
    "attributes" | typeof change.sectionKind
  >;
  const properties = await createPropertyPayload(
    activeApi,
    modelId,
    change.entityExpressId,
    sections,
  );

  postResponse({
    requestId,
    type: "PROPERTY_VALUE_UPDATED",
    payload: { properties, sections },
  });
}

export async function handleExportModel(requestId: number, modelId: number) {
  const activeApi = await ensureApi();
  const data = activeApi.SaveModel(modelId);
  const buffer = new Uint8Array(data).slice().buffer;

  postWithTransfer(
    {
      requestId,
      type: "MODEL_EXPORTED",
      payload: { modelId, data: buffer },
    } satisfies IfcWorkerResponse,
    [buffer],
  );
}
