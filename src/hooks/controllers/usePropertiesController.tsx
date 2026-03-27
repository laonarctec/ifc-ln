import { useCallback, useEffect, useMemo, useState } from "react";
import { FileJson2, Ruler, Scissors } from "lucide-react";
import { useViewerStore } from "@/stores";
import { useWebIfc } from "@/hooks/useWebIfc";
import { useGeometryMetrics } from "@/hooks/useGeometryMetrics";
import { usePropertiesPanelData } from "@/components/viewer/properties/usePropertiesPanelData";
import { usePropertyMutationActions } from "@/hooks/controllers/usePropertyMutationActions";
import { getActiveClippingPlane } from "@/stores/slices/clippingStateUtils";
import type { TrackedIfcChange } from "@/stores/slices/changesSlice";
import type { ClippingPlaneObject, ClippingState } from "@/stores/slices/clippingSlice";
import type { RightPanelTab } from "@/stores/slices/uiSlice";
import type { PanelSegmentedControlOption } from "@/components/viewer/PanelSegmentedControl";

type InspectorTab = RightPanelTab;

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
  hasLoadedModel: boolean;
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
  clipping: ClippingState;
  selectedClippingPlane: ClippingPlaneObject | null;
  handleHideSelectedEntities: () => void;
  handleResetHiddenEntities: () => void;
  handleSetModelVisibility: (modelId: number, visible: boolean) => void;
  handleFocusModel: (modelId: number) => void;
  handleCloseModel: (modelId: number) => Promise<void>;
  handleStartCreateClippingPlane: () => void;
  handleCancelCreateClippingPlane: () => void;
  handleSelectClippingPlane: (planeId: string | null) => void;
  handleRenameClippingPlane: (planeId: string, name: string) => void;
  handleToggleClippingPlaneEnabled: (planeId: string) => void;
  handleToggleClippingPlaneLocked: (planeId: string) => void;
  handleFlipClippingPlane: (planeId: string) => void;
  handleDeleteClippingPlane: (planeId: string) => void;
  handleClearClippingPlanes: () => void;
  propertyActions: ReturnType<typeof usePropertyMutationActions>;
}

const baseInspectorTabs: readonly PanelSegmentedControlOption<InspectorTab>[] = [
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
  {
    value: "editor",
    label: "Editor",
    icon: <Scissors size={14} strokeWidth={2} />,
    title: "Editor",
  },
] as const;

const PROPERTY_TAB_SECTIONS = [
  "propertySets",
  "typeProperties",
  "materials",
  "documents",
  "classifications",
  "metadata",
  "relations",
  "inverseRelations",
] as const satisfies ReturnType<
  typeof usePropertiesPanelData
>["properties"]["loadedSections"];

const QUANTITY_TAB_SECTIONS = ["quantitySets"] as const satisfies ReturnType<
  typeof usePropertiesPanelData
>["properties"]["loadedSections"];

export function usePropertiesController(): PropertiesController {
  const rightPanelTab = useViewerStore((state) => state.rightPanelTab);
  const setRightPanelTab = useViewerStore((state) => state.setRightPanelTab);
  const interactionMode = useViewerStore((state) => state.interactionMode);
  const measurement = useViewerStore((state) => state.measurement);
  const trackedChanges = useViewerStore((state) => state.trackedChanges);
  const upsertTrackedChange = useViewerStore((state) => state.upsertTrackedChange);
  const removeTrackedChange = useViewerStore((state) => state.removeTrackedChange);
  const setActiveModelId = useViewerStore((state) => state.setActiveModelId);
  const mergeSelectedProperties = useViewerStore(
    (state) => state.mergeSelectedProperties,
  );
  const clipping = useViewerStore((state) => state.clipping);
  const startCreateClippingPlane = useViewerStore(
    (state) => state.startCreateClippingPlane,
  );
  const cancelClippingDraft = useViewerStore((state) => state.cancelClippingDraft);
  const selectClippingPlane = useViewerStore((state) => state.selectClippingPlane);
  const renameClippingPlane = useViewerStore((state) => state.renameClippingPlane);
  const toggleClippingPlaneEnabled = useViewerStore(
    (state) => state.toggleClippingPlaneEnabled,
  );
  const toggleClippingPlaneLocked = useViewerStore(
    (state) => state.toggleClippingPlaneLocked,
  );
  const flipClippingPlane = useViewerStore((state) => state.flipClippingPlane);
  const deleteClippingPlane = useViewerStore((state) => state.deleteClippingPlane);
  const clearClippingPlanes = useViewerStore((state) => state.clearClippingPlanes);
  const [optimisticTab, setOptimisticTab] = useState<InspectorTab | null>(null);
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
  const hasLoadedModel = loadedModels.length > 0;
  const activeTab = optimisticTab ?? rightPanelTab;

  const {
    primary: geometryPrimary,
    aggregate: geometryAggregate,
    entityCount: geometryEntityCount,
  } = useGeometryMetrics(selectedEntityId, selectedEntityIds);

  const inspectorTabs = useMemo(
    () =>
      baseInspectorTabs.map((tab) =>
        tab.value === "editor"
          ? {
              ...tab,
              disabled: !hasLoadedModel,
              title: !hasLoadedModel ? "IFC 파일을 연 뒤 사용할 수 있습니다" : tab.title,
            }
          : tab,
      ),
    [hasLoadedModel],
  );

  const setActiveTab = useCallback(
    (nextTab: InspectorTab) => {
      if (nextTab === "editor" && !hasLoadedModel) {
        return;
      }
      setOptimisticTab(nextTab);
      setRightPanelTab(nextTab);
    },
    [hasLoadedModel, setRightPanelTab],
  );

  useEffect(() => {
    setOptimisticTab(null);
  }, [rightPanelTab]);

  useEffect(() => {
    if (!hasLoadedModel && rightPanelTab === "editor") {
      setOptimisticTab("properties");
      setRightPanelTab("properties");
    }
  }, [hasLoadedModel, rightPanelTab, setRightPanelTab]);

  useEffect(() => {
    if (!hasLoadedModel && clipping.mode === "creating") {
      cancelClippingDraft();
    }
  }, [cancelClippingDraft, clipping.mode, hasLoadedModel]);

  useEffect(() => {
    if (hasLoadedModel && clipping.mode === "creating" && rightPanelTab !== "editor") {
      setOptimisticTab("editor");
      setRightPanelTab("editor");
    }
  }, [clipping.mode, hasLoadedModel, rightPanelTab, setRightPanelTab]);

  useEffect(() => {
    if (activeTab === "properties") {
      void loadPropertySections([...PROPERTY_TAB_SECTIONS]);
      return;
    }

    if (activeTab === "quantities") {
      void loadPropertySections([...QUANTITY_TAB_SECTIONS]);
    }
  }, [activeTab, loadPropertySections, selectedEntityId]);

  const trackedChangesByModel = useMemo(() => {
    const changesByModel = new Map<number, TrackedIfcChange[]>();
    trackedChanges.forEach((change) => {
      const changes = changesByModel.get(change.modelId);
      if (changes) {
        changes.push(change);
        return;
      }
      changesByModel.set(change.modelId, [change]);
    });
    return changesByModel;
  }, [trackedChanges]);

  const currentModelChanges = useMemo(
    () => (currentModelId === null ? [] : trackedChangesByModel.get(currentModelId) ?? []),
    [currentModelId, trackedChangesByModel],
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
        changeCount: trackedChangesByModel.get(model.modelId)?.length ?? 0,
      })),
    [activeModelId, loadedModels, trackedChangesByModel],
  );

  const propertyActions = usePropertyMutationActions({
    currentModelId,
    selectedEntityId,
    selectedEntityChangeMap,
    mergeSelectedProperties,
    upsertTrackedChange,
    removeTrackedChange,
  });

  const selectedClippingPlane = useMemo(
    () => getActiveClippingPlane(clipping),
    [clipping],
  );

  const runWhenModelLoaded = (action: () => void) => {
    if (!hasLoadedModel) {
      return;
    }
    action();
  };

  return {
    activeTab,
    setActiveTab,
    inspectorTabs,
    hasLoadedModel,
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
    clipping,
    selectedClippingPlane,
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
    handleStartCreateClippingPlane: () => {
      runWhenModelLoaded(() => {
        setOptimisticTab("editor");
        setRightPanelTab("editor");
        startCreateClippingPlane();
      });
    },
    handleCancelCreateClippingPlane: () => {
      runWhenModelLoaded(cancelClippingDraft);
    },
    handleSelectClippingPlane: (planeId) => {
      runWhenModelLoaded(() => selectClippingPlane(planeId));
    },
    handleRenameClippingPlane: (planeId, name) => {
      runWhenModelLoaded(() => renameClippingPlane(planeId, name));
    },
    handleToggleClippingPlaneEnabled: (planeId) => {
      runWhenModelLoaded(() => toggleClippingPlaneEnabled(planeId));
    },
    handleToggleClippingPlaneLocked: (planeId) => {
      runWhenModelLoaded(() => toggleClippingPlaneLocked(planeId));
    },
    handleFlipClippingPlane: (planeId) => {
      runWhenModelLoaded(() => flipClippingPlane(planeId));
    },
    handleDeleteClippingPlane: (planeId) => {
      runWhenModelLoaded(() => deleteClippingPlane(planeId));
    },
    handleClearClippingPlanes: () => {
      runWhenModelLoaded(clearClippingPlanes);
    },
    propertyActions,
  };
}
