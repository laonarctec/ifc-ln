import type { IfcAPI } from "web-ifc";
import type {
  IfcEditableFieldTarget,
  IfcEditableValueType,
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

function createEditableEntry(
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

const IGNORED_PROPERTY_KEYS = new Set([
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

const RELATION_SKIP_KEYS = new Set([
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

function getPropertyItemValue(
  property: Record<string, unknown>,
): { attributeName: string; value: unknown } | null {
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
      return {
        attributeName: key,
        value: property[key],
      };
    }
  }

  const dynamicValue = Object.entries(property).find(
    ([key, value]) =>
      key.endsWith("Value") &&
      !["Unit", "Formula"].includes(key) &&
      value !== undefined &&
      value !== null,
  );

  if (!dynamicValue) {
    return null;
  }

  return {
    attributeName: dynamicValue[0],
    value: dynamicValue[1],
  };
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
    const expressId =
      typeof record.expressID === "number" ? record.expressID : null;

    if (directValue !== null) {
      return [
        createEditableEntry(key, directValue.value, expressId === null ? null : {
          lineExpressId: expressId,
          attributeName: directValue.attributeName,
        }),
      ];
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

export function createSectionFromEntries({
  expressID = null,
  title,
  ifcType = null,
  entries,
}: {
  expressID?: number | null;
  title: string;
  ifcType?: string | null;
  entries: IfcPropertyEntry[];
}): IfcPropertySection | null {
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

export function createEditableAttributeEntries(
  source: Record<string, unknown>,
  expressId: number,
) {
  return Object.entries(source)
    .filter(([key, value]) =>
      !["type", "GlobalId"].includes(key) &&
      value !== undefined &&
      value !== null &&
      !Array.isArray(value) &&
      !isIfcReferenceLike(value),
    )
    .map(([key, value]) =>
      createEditableEntry(key, value, {
        lineExpressId: expressId,
        attributeName: key,
      }),
    );
}

function isIfcReferenceLike(value: unknown): boolean {
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

function normalizeArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export async function createAssociationSections(
  activeApi: Pick<IfcAPI, "GetLine">,
  modelId: number,
  expressId: number,
  relationType: string,
  relatingKey: string,
  fallbackPrefix: string,
): Promise<IfcPropertySection[]> {
  const associationSource = activeApi.GetLine(
    modelId,
    expressId,
    false,
    true,
    "HasAssociations",
  ) as Record<string, unknown> | null;

  const associations = normalizeArray(associationSource?.HasAssociations);
  const sections: IfcPropertySection[] = [];
  const seenIds = new Set<number>();

  for (const associationRef of associations) {
    const relationId = readExpressId(associationRef);
    if (relationId === null) {
      continue;
    }

    const relation = activeApi.GetLine(modelId, relationId, false, false) as Record<string, unknown> | null;
    if (!relation || relation.type !== relationType) {
      continue;
    }

    const relatedRefs = normalizeArray(relation[relatingKey]);
    for (const relatedRef of relatedRefs) {
      const relatedId = readExpressId(relatedRef);
      if (relatedId === null || seenIds.has(relatedId)) {
        continue;
      }

      const relatedLine = activeApi.GetLine(modelId, relatedId, true, false);
      const section = createPropertySection(
        relatedLine,
        `${fallbackPrefix} ${sections.length + 1}`,
      );
      if (!section) {
        continue;
      }

      sections.push(section);
      seenIds.add(relatedId);
    }
  }

  return sections;
}

function createMetadataEntries(
  record: Record<string, unknown>,
  keys: string[],
): IfcPropertyEntry[] {
  return keys.flatMap((key) => {
    const value = record[key];
    if (value === undefined || value === null) {
      return [];
    }

    return [{ key, value: formatIfcValue(value) }];
  });
}

export function createMetadataSections(
  record: Record<string, unknown> | null | undefined,
): IfcPropertySection[] {
  if (!record) {
    return [];
  }

  const expressID = typeof record.expressID === "number" ? record.expressID : null;
  const ifcType = typeof record.type === "string" ? record.type : null;
  const sections: IfcPropertySection[] = [];

  const summaryEntries = createMetadataEntries(record, [
    "Description",
    "ObjectType",
    "PredefinedType",
    "Tag",
    "LongName",
    "CompositionType",
    "Phase",
  ]);
  const summarySection = createSectionFromEntries({
    expressID,
    title: "Entity Metadata",
    ifcType,
    entries: summaryEntries,
  });
  if (summarySection) {
    sections.push(summarySection);
  }

  const referenceEntries = createMetadataEntries(record, [
    "OwnerHistory",
    "ObjectPlacement",
    "Representation",
    "RepresentationMaps",
    "LayerAssignments",
    "StyledByItem",
  ]);
  const referenceSection = createSectionFromEntries({
    expressID,
    title: "Placement & Representation",
    ifcType,
    entries: referenceEntries,
  });
  if (referenceSection) {
    sections.push(referenceSection);
  }

  return sections;
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
    documents: [],
    classifications: [],
    metadata: [],
    relations: [],
    inverseRelations: [],
  };
}
