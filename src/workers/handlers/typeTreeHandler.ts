import type { IfcAPI } from "web-ifc";
import type { IfcTypeTreeGroup, IfcTypeTreeInstance, IfcTypeTreeFamily } from "@/types/worker-messages";
import { readIfcText } from "../ifcPropertyUtils";
import { ensureApi, postResponse } from "../workerContext";

async function createTypeTreePayload(
  activeApi: IfcAPI,
  modelId: number,
  entityIds: number[],
): Promise<IfcTypeTreeGroup[]> {
  const uniqueEntityIds = [...new Set(entityIds)].filter((v) => Number.isFinite(v) && v > 0);
  const groupMap = new Map<string, Map<string, IfcTypeTreeFamily>>();

  for (const expressId of uniqueEntityIds) {
    const line = activeApi.GetLine(modelId, expressId, false, false) as Record<string, unknown> | null;
    const entityTypeCode = activeApi.GetLineType(modelId, expressId);
    const entityIfcType = activeApi.GetNameFromTypeCode(entityTypeCode) ?? "Unknown";
    const entityName = readIfcText(line?.Name) ?? null;
    const instance: IfcTypeTreeInstance = { expressID: expressId, ifcType: entityIfcType, name: entityName };

    const typeResults = await activeApi.properties
      .getTypeProperties(modelId, expressId, true)
      .catch(() => [] as unknown[]);

    if (typeResults.length === 0) {
      const groupLabel = entityIfcType;
      const familyKey = `${groupLabel}-untyped`;
      if (!groupMap.has(groupLabel)) groupMap.set(groupLabel, new Map());
      const familyMap = groupMap.get(groupLabel)!;
      if (!familyMap.has(familyKey)) {
        familyMap.set(familyKey, {
          typeExpressID: null, typeClassName: groupLabel, typeName: "Untyped",
          entityIds: [], children: [], isUntyped: true,
        });
      }
      const family = familyMap.get(familyKey)!;
      if (!family.entityIds.includes(expressId)) {
        family.entityIds.push(expressId);
        family.children.push(instance);
      }
      continue;
    }

    for (const item of typeResults) {
      if (typeof item !== "object" || item === null) continue;
      const record = item as Record<string, unknown>;
      const typeExpressID = typeof record.expressID === "number" ? record.expressID : null;
      const typeClassName = typeof record.type === "string" ? record.type : entityIfcType;
      const typeName = readIfcText(record.Name) ?? (typeExpressID !== null ? `#${typeExpressID}` : "Unnamed Type");
      const familyKey = `${typeClassName}-${typeExpressID ?? typeName}`;

      if (!groupMap.has(typeClassName)) groupMap.set(typeClassName, new Map());
      const familyMap = groupMap.get(typeClassName)!;
      if (!familyMap.has(familyKey)) {
        familyMap.set(familyKey, { typeExpressID, typeClassName, typeName, entityIds: [], children: [] });
      }
      const family = familyMap.get(familyKey)!;
      if (!family.entityIds.includes(expressId)) {
        family.entityIds.push(expressId);
        family.children.push(instance);
      }
    }
  }

  return [...groupMap.entries()]
    .map(([typeClassName, familyMap]) => {
      const families = [...familyMap.values()]
        .map((f) => ({
          ...f,
          entityIds: [...f.entityIds].sort((a, b) => a - b),
          children: [...f.children].sort((a, b) =>
            (a.name ?? `${a.ifcType} #${a.expressID}`).localeCompare(b.name ?? `${b.ifcType} #${b.expressID}`),
          ),
        }))
        .sort((a, b) => a.typeName.localeCompare(b.typeName));
      return {
        typeClassName,
        entityIds: families.flatMap((f) => f.entityIds),
        families,
      } satisfies IfcTypeTreeGroup;
    })
    .sort((a, b) => a.typeClassName.localeCompare(b.typeClassName));
}

export async function handleGetTypeTree(requestId: number, modelId: number, entityIds: number[]) {
  const activeApi = await ensureApi();
  const groups = await createTypeTreePayload(activeApi, modelId, entityIds);
  postResponse({ requestId, type: "TYPE_TREE", payload: { groups } });
}
