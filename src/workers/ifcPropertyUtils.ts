import type {
  IfcElementProperties,
  IfcPropertyEntry,
  IfcPropertySection,
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

export const IGNORED_PROPERTY_KEYS = new Set([
  "type",
  "Name",
  "Description",
  "GlobalId",
  "expressID",
  "HasProperties",
  "Quantities",
  "OwnerHistory",
  "HasAssignments",
  "HasAssociations",
  "ObjectPlacement",
  "Representation",
  "RepresentationMaps",
  "StyledByItem",
  "LayerAssignments",
]);

export const RELATION_SKIP_KEYS = new Set([
  "type",
  "Name",
  "Description",
  "GlobalId",
  "expressID",
  "OwnerHistory",
]);

export function flattenPropertyFields(
  value: unknown,
  prefix = "",
  depth = 0,
  entries: IfcPropertyEntry[] = [],
): IfcPropertyEntry[] {
  if (value === null || value === undefined || depth > 2) {
    return entries;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    if (prefix) {
      entries.push({ key: prefix, value: formatIfcValue(value) });
    }
    return entries;
  }

  for (const [key, nestedValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (
      IGNORED_PROPERTY_KEYS.has(key) ||
      nestedValue === undefined ||
      nestedValue === null
    ) {
      continue;
    }

    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (
      typeof nestedValue === "string" ||
      typeof nestedValue === "number" ||
      typeof nestedValue === "boolean" ||
      Array.isArray(nestedValue)
    ) {
      entries.push({ key: nextKey, value: formatIfcValue(nestedValue) });
      continue;
    }

    if (
      typeof nestedValue === "object" &&
      nestedValue !== null &&
      ("value" in nestedValue || "expressID" in nestedValue)
    ) {
      entries.push({ key: nextKey, value: formatIfcValue(nestedValue) });
      continue;
    }

    flattenPropertyFields(nestedValue, nextKey, depth + 1, entries);
  }

  return entries;
}

export function getPropertyItemValue(
  property: Record<string, unknown>,
): unknown {
  const priorityKeys = [
    "NominalValue",
    "NominalValues",
    "ListValues",
    "EnumerationValues",
    "LengthValue",
    "AreaValue",
    "VolumeValue",
    "CountValue",
    "WeightValue",
    "TimeValue",
    "RadiusValue",
    "AngleValue",
    "TemperatureValue",
  ];

  for (const key of priorityKeys) {
    if (
      key in property &&
      property[key] !== undefined &&
      property[key] !== null
    ) {
      return property[key];
    }
  }

  const dynamicValue = Object.entries(property).find(
    ([key, value]) =>
      key.endsWith("Value") &&
      !["Unit", "Formula"].includes(key) &&
      value !== undefined &&
      value !== null,
  );

  return dynamicValue?.[1];
}

export function createEntriesFromNamedItems(
  items: unknown[],
): IfcPropertyEntry[] {
  return items.flatMap((item, index) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const key =
      readIfcText(record.Name) ?? `${record.type ?? "Item"} ${index + 1}`;
    const directValue = getPropertyItemValue(record);

    if (directValue !== undefined) {
      return [{ key, value: formatIfcValue(directValue) }];
    }

    const nestedEntries = flattenPropertyFields(record, key);
    if (nestedEntries.length > 0) {
      return nestedEntries;
    }

    return [{ key, value: record.type ? String(record.type) : "-" }];
  });
}

export function createPropertySection(
  entity: unknown,
  fallbackTitle: string,
): IfcPropertySection | null {
  if (typeof entity !== "object" || entity === null) {
    return null;
  }

  const record = entity as Record<string, unknown>;
  const title = readIfcText(record.Name) ?? fallbackTitle;
  const ifcType = typeof record.type === "string" ? record.type : null;
  const expressID =
    typeof record.expressID === "number" ? record.expressID : null;

  let entries: IfcPropertyEntry[] = [];

  if (Array.isArray(record.HasProperties)) {
    entries = createEntriesFromNamedItems(record.HasProperties);
  } else if (Array.isArray(record.Quantities)) {
    entries = createEntriesFromNamedItems(record.Quantities);
  } else {
    entries = flattenPropertyFields(record);
  }

  if (entries.length === 0) {
    return null;
  }

  return {
    expressID,
    title,
    ifcType,
    entries,
  };
}

export function isIfcReferenceLike(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some((item) => isIfcReferenceLike(item));
  }

  if (typeof value !== "object") {
    return false;
  }

  return (
    "expressID" in value ||
    ("value" in value &&
      typeof (value as { value?: unknown }).value === "number")
  );
}

export function createRelationSection(
  source: Record<string, unknown> | null | undefined,
  title: string,
  inverseKeys = new Set<string>(),
): IfcPropertySection | null {
  if (!source) {
    return null;
  }

  const entries: IfcPropertyEntry[] = [];

  for (const [key, value] of Object.entries(source)) {
    if (RELATION_SKIP_KEYS.has(key)) {
      continue;
    }

    if (inverseKeys.size > 0 && !inverseKeys.has(key)) {
      continue;
    }

    if (!isIfcReferenceLike(value)) {
      continue;
    }

    entries.push({
      key,
      value: formatIfcValue(value),
    });
  }

  if (entries.length === 0) {
    return null;
  }

  return {
    expressID: typeof source.expressID === "number" ? source.expressID : null,
    title,
    ifcType: typeof source.type === "string" ? source.type : null,
    entries,
  };
}

export function buildPropertySections(
  items: unknown[],
  fallbackPrefix: string,
) {
  const propertySets: IfcPropertySection[] = [];
  const quantitySets: IfcPropertySection[] = [];

  items.forEach((item, index) => {
    const section = createPropertySection(
      item,
      `${fallbackPrefix} ${index + 1}`,
    );
    if (!section) {
      return;
    }

    const isQuantitySet =
      section.title.startsWith("Qto_") ||
      (typeof item === "object" &&
        item !== null &&
        Array.isArray((item as Record<string, unknown>).Quantities));

    if (isQuantitySet) {
      quantitySets.push(section);
    } else {
      propertySets.push(section);
    }
  });

  return { propertySets, quantitySets };
}

export function createEmptyPropertyPayload(
  expressId: number,
  ifcType: string | null,
): IfcElementProperties {
  return {
    expressID: expressId,
    globalId: null,
    ifcType,
    name: null,
    loadedSections: [],
    attributes: [],
    propertySets: [],
    quantitySets: [],
    typeProperties: [],
    materials: [],
    relations: [],
    inverseRelations: [],
  };
}
