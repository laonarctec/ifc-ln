import { IFCRELCONTAINEDINSPATIALSTRUCTURE } from "web-ifc";
import type { IfcSpatialElement } from "@/types/worker-messages";
import { enrichSpatialNode, getLengthUnitFactor } from "../ifcGeometryUtils";
import { safeDelete, readIfcText } from "../ifcPropertyUtils";
import { ensureApi, spatialTrees, postResponse } from "../workerContext";

function collectStoreyDataForSpatial(activeApi: import("web-ifc").IfcAPI, modelId: number) {
  const storeyElements = new Map<number, IfcSpatialElement[]>();
  const relationIds = activeApi.GetLineIDsWithType(modelId, IFCRELCONTAINEDINSPATIALSTRUCTURE, true);

  for (let index = 0; index < relationIds.size(); index += 1) {
    const relationId = relationIds.get(index);
    const relation = activeApi.GetLine(modelId, relationId, false, false) as Record<string, unknown> | null;
    const relatingStructure = relation?.RelatingStructure as { expressID?: unknown } | undefined;
    const storeyId = typeof relatingStructure?.expressID === "number" ? relatingStructure.expressID : null;
    if (storeyId === null) continue;

    const relatedElements = Array.isArray(relation?.RelatedElements) ? relation.RelatedElements : [];
    if (!storeyElements.has(storeyId)) storeyElements.set(storeyId, []);
    const bucket = storeyElements.get(storeyId)!;
    const seen = new Set(bucket.map((item) => item.expressID));

    for (const item of relatedElements) {
      const expressId =
        typeof item === "object" && item !== null && "expressID" in item && typeof (item as { expressID?: unknown }).expressID === "number"
          ? (item as { expressID: number }).expressID
          : null;
      if (expressId === null || seen.has(expressId)) continue;
      seen.add(expressId);

      const line = activeApi.GetLine(modelId, expressId, false, false) as Record<string, unknown> | null;
      const typeCode = activeApi.GetLineType(modelId, expressId);
      bucket.push({
        expressID: expressId,
        ifcType: activeApi.GetNameFromTypeCode(typeCode) ?? "Unknown",
        name: readIfcText(line?.Name) ?? null,
      });
    }

    bucket.sort((a, b) => (a.name ?? `${a.ifcType} #${a.expressID}`).localeCompare(b.name ?? `${b.ifcType} #${b.expressID}`));
  }

  safeDelete(relationIds);
  return { storeyElements };
}

export async function handleGetSpatialStructure(requestId: number, modelId: number) {
  const activeApi = await ensureApi();
  if (!spatialTrees.has(modelId)) {
    const { storeyElements } = collectStoreyDataForSpatial(activeApi, modelId);
    const rawTree = (await activeApi.properties.getSpatialStructure(modelId, false)) as unknown as Record<string, unknown>;
    const unitFactor = getLengthUnitFactor(activeApi, modelId);
    spatialTrees.set(modelId, enrichSpatialNode(rawTree, storeyElements, activeApi, modelId, unitFactor));
  }

  postResponse({
    requestId, type: "SPATIAL_STRUCTURE",
    payload: { tree: spatialTrees.get(modelId)! },
  });
}
