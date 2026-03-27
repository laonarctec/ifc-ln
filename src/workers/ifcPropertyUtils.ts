import type {
  IfcPropertyEntry,
  IfcPropertySection,
} from "@/types/worker-messages";
import {
  formatIfcValue,
  createEditableEntry,
} from "./ifcValueUtils";

// Re-export everything from sub-modules so existing imports keep working
export {
  safeDelete,
  readIfcText,
  readIfcNumber,
  formatIfcValue,
  inferEditableValueType,
  readExpressId,
  createEditableEntry,
} from "./ifcValueUtils";
export {
  flattenPropertyFields,
  createEntriesFromNamedItems,
  createPropertySection,
  createSectionFromEntries,
  buildPropertySections,
  createAssociationSections,
  createMetadataSections,
  createEmptyPropertyPayload,
} from "./ifcSectionBuilder";

// ---------------------------------------------------------------------------
// Functions that depend on both value utils and section logic stay here
// ---------------------------------------------------------------------------

const RELATION_SKIP_KEYS = new Set([
  "type",
  "Name",
  "Description",
  "GlobalId",
  "expressID",
  "OwnerHistory",
]);

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
