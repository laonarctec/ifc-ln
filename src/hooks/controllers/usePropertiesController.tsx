import { useEffect, useMemo, useState } from "react";
import { FileJson2, Ruler } from "lucide-react";
import { useViewerStore } from "@/stores";
import { useWebIfc } from "@/hooks/useWebIfc";
import { useGeometryMetrics } from "@/hooks/useGeometryMetrics";
import { usePropertiesPanelData } from "@/components/viewer/properties/usePropertiesPanelData";
import { usePropertyMutationActions } from "@/hooks/controllers/usePropertyMutationActions";
import type { TrackedIfcChange } from "@/stores/slices/changesSlice";
import type { PanelSegmentedControlOption } from "@/components/viewer/PanelSegmentedControl";

type InspectorTab = "properties" | "quantities";

export interface PropertiesModelCard {
  modelId: number;
  fileName: string;
  schema: string;
  visible: boolean;
  isActive: boolean;
  changeCount: number;
}

export interface PropertiesController {
  activeTab: InspectorTab;
  setActiveTab: (nextTab: InspectorTab) => void;
  inspectorTabs: readonly PanelSegmentedControlOption<InspectorTab>[];
  currentFileName: string | null;
  currentModelId: number | null;
  currentModelSchema: string | null;
  currentModelMaxExpressId: number | null;
  selectedEntityId: number | null;
  selectedEntityIds: number[];
  hiddenEntityIds: Set<number>;
  properties: ReturnType<typeof usePropertiesPanelData>["properties"];
  propertiesLoading: boolean;
  propertiesError: string | null;
  propertiesLoadingSections: ReturnType<
    typeof usePropertiesPanelData
  >["propertiesLoadingSections"];
  propertyCountLabel: string;
  currentModelChanges: TrackedIfcChange[];
  selectedEntityChangeMap: Map<string, TrackedIfcChange>;
  modelCards: PropertiesModelCard[];
  interactionMode: string;
  measurement: { distance: number | null };
  trackedChanges: TrackedIfcChange[];
  geometryPrimary: ReturnType<typeof useGeometryMetrics>["primary"];
  geometryAggregate: ReturnType<typeof useGeometryMetrics>["aggregate"];
  geometryEntityCount: number;
  handleHideSelectedEntities: () => void;
  handleResetHiddenEntities: () => void;
  handleSetModelVisibility: (modelId: number, visible: boolean) => void;
  handleFocusModel: (modelId: number) => void;
  handleCloseModel: (modelId: number) => Promise<void>;
  propertyActions: ReturnType<typeof usePropertyMutationActions>;
}

const inspectorTabs: readonly PanelSegmentedControlOption<InspectorTab>[] = [
  {
    value: "properties",
    label: "Properties",
    icon: <FileJson2 size={14} strokeWidth={2} />,
    title: "Properties",
  },
  {
    value: "quantities",
    label: "Quantities",
    icon: <Ruler size={14} strokeWidth={2} />,
    title: "Quantities",
  },
] as const;

export function usePropertiesController(): PropertiesController {
  const [activeTab, setActiveTab] = useState<InspectorTab>("properties");
  const interactionMode = useViewerStore((state) => state.interactionMode);
  const measurement = useViewerStore((state) => state.measurement);
  const trackedChanges = useViewerStore((state) => state.trackedChanges);
  const upsertTrackedChange = useViewerStore((state) => state.upsertTrackedChange);
  const removeTrackedChange = useViewerStore((state) => state.removeTrackedChange);
  const setActiveModelId = useViewerStore((state) => state.setActiveModelId);
  const mergeSelectedProperties = useViewerStore(
    (state) => state.mergeSelectedProperties,
  );
  const {
    currentFileName,
    currentModelId,
    currentModelSchema,
    currentModelMaxExpressId,
    selectedEntityId,
    selectedEntityIds,
    hideEntity,
    hiddenEntityIds,
    resetHiddenEntities,
    properties,
    propertiesLoading,
    propertiesError,
    propertiesLoadingSections,
    loadPropertySections,
  } = usePropertiesPanelData();
  const { loadedModels, activeModelId, setModelVisibility, closeModel } = useWebIfc();

  const {
    primary: geometryPrimary,
    aggregate: geometryAggregate,
    entityCount: geometryEntityCount,
  } = useGeometryMetrics(selectedEntityId, selectedEntityIds);

  useEffect(() => {
    if (activeTab === "properties") {
      void loadPropertySections([
        "propertySets",
        "typeProperties",
        "materials",
        "documents",
        "classifications",
        "metadata",
        "relations",
        "inverseRelations",
      ]);
      return;
    }

    void loadPropertySections(["quantitySets"]);
  }, [activeTab, loadPropertySections, selectedEntityId]);

  const currentModelChanges = useMemo(
    () =>
      currentModelId === null
        ? []
        : trackedChanges.filter((change) => change.modelId === currentModelId),
    [currentModelId, trackedChanges],
  );

  const selectedEntityChangeMap = useMemo(() => {
    if (currentModelId === null || selectedEntityId === null) {
      return new Map<string, TrackedIfcChange>();
    }

    return new Map(
      trackedChanges
        .filter(
          (change) =>
            change.modelId === currentModelId &&
            change.entityExpressId === selectedEntityId,
        )
        .map((change) => [
          `${change.target.lineExpressId}:${change.target.attributeName}`,
          change,
        ]),
    );
  }, [currentModelId, selectedEntityId, trackedChanges]);

  const propertyCountLabel = useMemo(() => {
    if (propertiesLoading) return "속성 조회 중";
    const sectionCount =
      properties.attributes.length +
      properties.propertySets.length +
      properties.typeProperties.length +
      properties.materials.length +
      properties.documents.length +
      properties.classifications.length +
      properties.metadata.length +
      properties.relations.length +
      properties.inverseRelations.length;

    return sectionCount > 0 ? `${sectionCount}개 섹션/속성` : "선택 대기 중";
  }, [
    properties.attributes.length,
    properties.classifications.length,
    properties.documents.length,
    properties.inverseRelations.length,
    properties.materials.length,
    properties.metadata.length,
    properties.propertySets.length,
    properties.relations.length,
    properties.typeProperties.length,
    propertiesLoading,
  ]);

  const modelCards = useMemo(
    () =>
      loadedModels.map((model) => ({
        modelId: model.modelId,
        fileName: model.fileName,
        schema: model.schema,
        visible: model.visible,
        isActive: model.modelId === activeModelId,
        changeCount: trackedChanges.filter(
          (change) => change.modelId === model.modelId,
        ).length,
      })),
    [activeModelId, loadedModels, trackedChanges],
  );

  const propertyActions = usePropertyMutationActions({
    currentModelId,
    selectedEntityId,
    selectedEntityChangeMap,
    mergeSelectedProperties,
    upsertTrackedChange,
    removeTrackedChange,
  });

  return {
    activeTab,
    setActiveTab,
    inspectorTabs,
    currentFileName,
    currentModelId,
    currentModelSchema,
    currentModelMaxExpressId,
    selectedEntityId,
    selectedEntityIds,
    hiddenEntityIds,
    properties,
    propertiesLoading,
    propertiesError,
    propertiesLoadingSections,
    propertyCountLabel,
    currentModelChanges,
    selectedEntityChangeMap,
    modelCards,
    interactionMode,
    measurement,
    trackedChanges,
    geometryPrimary,
    geometryAggregate,
    geometryEntityCount,
    handleHideSelectedEntities: () => {
      if (selectedEntityIds.length === 0) return;
      selectedEntityIds.forEach((id) => hideEntity(id, currentModelId));
    },
    handleResetHiddenEntities: () => {
      resetHiddenEntities(currentModelId);
    },
    handleSetModelVisibility: (modelId, visible) => {
      setModelVisibility(modelId, visible);
    },
    handleFocusModel: (modelId) => {
      setActiveModelId(modelId);
    },
    handleCloseModel: async (modelId) => {
      await closeModel(modelId);
    },
    propertyActions,
  };
}
