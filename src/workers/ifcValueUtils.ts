import type {
  IfcEditableFieldTarget,
  IfcEditableValueType,
  IfcPropertyEntry,
} from "@/types/worker-messages";

export function safeDelete(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "delete" in value &&
    typeof (value as { delete?: unknown }).delete === "function"
  ) {
    (value as { delete: () => void }).delete();
  }
}

export function readIfcText(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null && "value" in value) {
    const nestedValue = (value as { value?: unknown }).value;
    if (typeof nestedValue === "string") {
      return nestedValue;
    }
  }

  return null;
}

export function readIfcNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "object" && value !== null && "value" in value) {
    const nestedValue = (value as { value?: unknown }).value;
    if (typeof nestedValue === "number" && Number.isFinite(nestedValue)) {
      return nestedValue;
    }
  }

  return null;
}

export function formatIfcValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    const preview = value
      .slice(0, 4)
      .map((item) => formatIfcValue(item))
      .join(", ");
    return value.length > 4 ? `[${preview}, ...]` : `[${preview}]`;
  }

  if (typeof value === "object") {
    if (
      "expressID" in value &&
      typeof (value as { expressID?: unknown }).expressID === "number"
    ) {
      return `#${(value as { expressID: number }).expressID}`;
    }

    if ("value" in value) {
      return formatIfcValue((value as { value?: unknown }).value);
    }

    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      4,
    );
    if (entries.length === 0) {
      return "{}";
    }

    return entries
      .map(([key, nestedValue]) => `${key}: ${formatIfcValue(nestedValue)}`)
      .join(", ");
  }

  return String(value);
}

export function inferEditableValueType(value: unknown): IfcEditableValueType {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) ? "integer" : "number";
  }

  if (typeof value === "boolean") {
    return "boolean";
  }

  if (typeof value === "string") {
    return "string";
  }

  if (typeof value === "object" && value !== null && "value" in value) {
    return inferEditableValueType((value as { value?: unknown }).value);
  }

  return "unknown";
}

export function readExpressId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  if ("expressID" in value && typeof (value as { expressID?: unknown }).expressID === "number") {
    return (value as { expressID: number }).expressID;
  }

  if ("value" in value && typeof (value as { value?: unknown }).value === "number") {
    return (value as { value: number }).value;
  }

  return null;
}

export function createEditableEntry(
  key: string,
  value: unknown,
  target?: IfcEditableFieldTarget | null,
): IfcPropertyEntry {
  const valueType = inferEditableValueType(value);
  const editable = Boolean(target) && valueType !== "unknown";

  return {
    key,
    value: formatIfcValue(value),
    editable,
    valueType,
    target: editable && target ? target : undefined,
  };
}
