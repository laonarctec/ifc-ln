import type { IfcAPI } from "web-ifc";
import type {
  IfcElementProperties,
  IfcPropertySection,
  PropertySectionKind,
} from "@/types/worker-messages";
import {
  readIfcText,
  buildPropertySections,
  createPropertySection,
  createRelationSection,
  createAssociationSections,
  createMetadataSections,
  createEmptyPropertyPayload,
  createEditableAttributeEntries,
} from "../ifcPropertyUtils";
import { ensureApi, postResponse } from "../workerContext";

export async function createPropertyPayload(
  activeApi: IfcAPI,
  modelId: number,
  expressId: number,
  sections: PropertySectionKind[],
): Promise<IfcElementProperties> {
  const line = activeApi.GetLine(modelId, expressId, false, false) as Record<string, unknown> | null;
  const typeCode = activeApi.GetLineType(modelId, expressId);
  const ifcType = activeApi.GetNameFromTypeCode(typeCode) ?? null;
  const payload = createEmptyPropertyPayload(expressId, ifcType);

  if (!line) {
    payload.loadedSections = [...new Set(sections)];
    return payload;
  }

  payload.globalId = readIfcText(line.GlobalId) ?? null;
  payload.name = readIfcText(line.Name) ?? null;

  if (sections.includes("attributes")) {
    payload.attributes = createEditableAttributeEntries(line, expressId);
  }

  if (sections.includes("propertySets") || sections.includes("quantitySets")) {
    const propertySetResults = await activeApi.properties
      .getPropertySets(modelId, expressId, true, true)
      .catch(() => [] as unknown[]);
    const { propertySets, quantitySets } = buildPropertySections(propertySetResults, "Property Set");
    if (sections.includes("propertySets")) payload.propertySets = propertySets;
    if (sections.includes("quantitySets")) payload.quantitySets = quantitySets;
  }

  if (sections.includes("typeProperties")) {
    const typePropertyResults = await activeApi.properties
      .getTypeProperties(modelId, expressId, true)
      .catch(() => [] as unknown[]);
    payload.typeProperties = typePropertyResults
      .map((item, index) => createPropertySection(item, `Type ${index + 1}`))
      .filter((s): s is IfcPropertySection => s !== null);
  }

  if (sections.includes("materials")) {
    const materialResults = await activeApi.properties
      .getMaterialsProperties(modelId, expressId, true, true)
      .catch(() => [] as unknown[]);
    payload.materials = materialResults
      .map((item, index) => createPropertySection(item, `Material ${index + 1}`))
      .filter((s): s is IfcPropertySection => s !== null);
  }

  if (sections.includes("documents")) {
    payload.documents = await createAssociationSections(
      activeApi,
      modelId,
      expressId,
      "IfcRelAssociatesDocument",
      "RelatingDocument",
      "Document",
    );
  }

  if (sections.includes("classifications")) {
    payload.classifications = await createAssociationSections(
      activeApi,
      modelId,
      expressId,
      "IfcRelAssociatesClassification",
      "RelatingClassification",
      "Classification",
    );
  }

  if (sections.includes("metadata")) {
    const metadataLine = (await activeApi.properties
      .getItemProperties(modelId, expressId, true, false)
      .catch(() => line)) as Record<string, unknown> | null;
    payload.metadata = createMetadataSections(metadataLine);
  }

  if (sections.includes("relations") || sections.includes("inverseRelations")) {
    const inverseLine = (await activeApi.properties
      .getItemProperties(modelId, expressId, false, true)
      .catch(() => null)) as Record<string, unknown> | null;
    const inverseKeys = new Set(
      inverseLine ? Object.keys(inverseLine).filter((key) => !(key in line)) : [],
    );
    if (sections.includes("relations")) {
      payload.relations = [createRelationSection(line, "Direct Relations")]
        .filter((s): s is IfcPropertySection => s !== null);
    }
    if (sections.includes("inverseRelations")) {
      payload.inverseRelations = [createRelationSection(inverseLine, "Inverse Relations", inverseKeys)]
        .filter((s): s is IfcPropertySection => s !== null);
    }
  }

  payload.loadedSections = [...new Set(sections)];
  return payload;
}

export async function handleGetPropertiesSections(
  requestId: number,
  modelId: number,
  expressId: number,
  sections: PropertySectionKind[],
) {
  const activeApi = await ensureApi();
  const properties = await createPropertyPayload(activeApi, modelId, expressId, sections);
  postResponse({
    requestId, type: "PROPERTIES_SECTIONS",
    payload: { properties, sections },
  });
}
