import { clsx } from "clsx";
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Eye,
  EyeOff,
  FileJson2,
  Info,
  Layers3,
  PencilLine,
  Ruler,
  Trash2,
  X,
} from "lucide-react";
import { ifcWorkerClient } from "@/services/IfcWorkerClient";
import { useViewerStore } from "@/stores";
import type { TrackedIfcChange } from "@/stores/slices/changesSlice";
import type { LensAction, LensField, LensOperator } from "@/stores/slices/lensSlice";
import type {
  IfcPropertyEntry,
  IfcPropertySection,
  PropertySectionKind,
} from "@/types/worker-messages";
import { addToast } from "@/components/ui/Toast";
import { useGeometryMetrics } from "@/hooks/useGeometryMetrics";
import { useWebIfc } from "@/hooks/useWebIfc";
import { formatMetric } from "@/utils/geometryMetrics";
import { usePropertiesPanelData } from "./properties/usePropertiesPanelData";

type InspectorTab = "properties" | "quantities";

function getChangeKey(entry: IfcPropertyEntry) {
  if (!entry.target) {
    return null;
  }

  return `${entry.target.lineExpressId}:${entry.target.attributeName}`;
}

function EditableEntryRow({
  entry,
  sectionKind,
  sectionTitle,
  change,
  disabled,
  onApply,
  onRevert,
}: {
  entry: IfcPropertyEntry;
  sectionKind: PropertySectionKind;
  sectionTitle: string;
  change: TrackedIfcChange | null;
  disabled: boolean;
  onApply: (entry: IfcPropertyEntry, sectionKind: PropertySectionKind, sectionTitle: string, nextValue: string) => void;
  onRevert: (change: TrackedIfcChange) => void;
}) {
  const [draftValue, setDraftValue] = useState(change?.currentValue ?? entry.value);

  useEffect(() => {
    setDraftValue(change?.currentValue ?? entry.value);
  }, [change?.currentValue, entry.value]);

  const canApply =
    entry.editable &&
    !disabled &&
    draftValue.trim() !== "" &&
    draftValue !== (change?.currentValue ?? entry.value);

  if (!entry.editable || !entry.target) {
    return (
      <div className="prop-row">
        <span className="prop-key">{entry.key}</span>
        <strong className="prop-value">{entry.value}</strong>
      </div>
    );
  }

  return (
    <div className="grid gap-2 p-2.5 border border-border-subtle bg-white/80 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex items-center justify-between gap-2">
        <span className="prop-key">{entry.key}</span>
        <small className="prop-small">
          {entry.valueType ?? "value"}
          {change ? " · changed" : ""}
        </small>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          className="flex-1 min-w-[160px] px-2.5 py-2 border border-border bg-white text-[0.82rem] text-text dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          disabled={disabled}
        />
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-2 border border-border bg-bg text-[0.75rem] font-medium disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900"
          disabled={!canApply}
          onClick={() => onApply(entry, sectionKind, sectionTitle, draftValue)}
        >
          <PencilLine size={13} />
          <span>Apply</span>
        </button>
        {change ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-2 border border-border bg-bg text-[0.75rem] font-medium dark:border-slate-700 dark:bg-slate-900"
            onClick={() => onRevert(change)}
          >
            <X size={13} />
            <span>Revert</span>
          </button>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 text-[0.74rem] text-text-muted dark:text-slate-400">
        <span>Current: {change?.currentValue ?? entry.value}</span>
        {change ? <span>Original: {change.originalValue}</span> : null}
      </div>
    </div>
  );
}

function PropertySectionList({
  title,
  description,
  sections,
  emptyMessage,
  sectionKind,
  changeMap,
  disabled,
  onApplyEntryChange,
  onRevertChange,
}: {
  title: string;
  description: string;
  sections: IfcPropertySection[];
  emptyMessage: string;
  sectionKind: PropertySectionKind;
  changeMap: Map<string, TrackedIfcChange>;
  disabled: boolean;
  onApplyEntryChange: (entry: IfcPropertyEntry, sectionKind: PropertySectionKind, sectionTitle: string, nextValue: string) => void;
  onRevertChange: (change: TrackedIfcChange) => void;
}) {
  if (sections.length === 0) {
    return (
      <div className="prop-list">
        <div className="prop-header">
          <span className="prop-label">{title}</span>
          <small className="prop-small">{description}</small>
        </div>
        <div className="prop-empty">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {sections.map((section) => (
        <div
          key={`${section.title}-${section.expressID ?? "none"}`}
          className="prop-list"
        >
          <div className="prop-header">
            <span className="prop-label">{section.title}</span>
            <small className="prop-small">
              {section.ifcType ?? "IFC"} · {section.entries.length}개 항목
            </small>
          </div>
          <div className="grid gap-2">
            {section.entries.map((entry) => (
              <EditableEntryRow
                key={`${section.title}-${entry.key}`}
                entry={entry}
                sectionKind={sectionKind}
                sectionTitle={section.title}
                change={entry.target ? changeMap.get(getChangeKey(entry) ?? "") ?? null : null}
                disabled={disabled}
                onApply={onApplyEntryChange}
                onRevert={onRevertChange}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LensRulesCard() {
  const loadedModels = useViewerStore((state) => state.loadedModels);
  const lensRules = useViewerStore((state) => state.lensRules);
  const addLensRule = useViewerStore((state) => state.addLensRule);
  const updateLensRule = useViewerStore((state) => state.updateLensRule);
  const toggleLensRule = useViewerStore((state) => state.toggleLensRule);
  const removeLensRule = useViewerStore((state) => state.removeLensRule);
  const clearLensRules = useViewerStore((state) => state.clearLensRules);

  const fieldOptions: Array<{ value: LensField; label: string }> = [
    { value: "ifcType", label: "IfcType" },
    { value: "name", label: "Name" },
    { value: "storey", label: "Storey" },
    { value: "model", label: "Model" },
    { value: "changed", label: "Changed" },
  ];
  const operatorOptions: Array<{ value: LensOperator; label: string }> = [
    { value: "is", label: "is" },
    { value: "contains", label: "contains" },
  ];
  const actionOptions: Array<{ value: LensAction; label: string }> = [
    { value: "color", label: "Color" },
    { value: "hide", label: "Hide" },
  ];

  return (
    <div className="prop-section">
      <div className="flex items-center justify-between gap-2">
        <div>
          <strong className="block text-text text-[0.92rem] dark:text-slate-100">
            Lens
          </strong>
          <small className="text-text-muted text-[0.72rem] dark:text-slate-400">
            규칙 기반 필터/컬러링
          </small>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border bg-bg text-[0.72rem] font-medium dark:border-slate-700 dark:bg-slate-900"
            onClick={() => addLensRule()}
          >
            <Layers3 size={13} />
            <span>Add Rule</span>
          </button>
          {lensRules.length > 0 ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border bg-bg text-[0.72rem] font-medium dark:border-slate-700 dark:bg-slate-900"
              onClick={clearLensRules}
            >
              <Trash2 size={13} />
              <span>Clear</span>
            </button>
          ) : null}
        </div>
      </div>
      {lensRules.length === 0 ? (
        <div className="prop-empty">활성 Lens 규칙이 없습니다.</div>
      ) : (
        <div className="grid gap-2.5">
          {lensRules.map((rule) => (
            <div
              key={rule.id}
              className="grid gap-2 p-2.5 border border-border bg-white/80 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-[0.78rem] text-text dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => toggleLensRule(rule.id)}
                  />
                  <span>{rule.enabled ? "Enabled" : "Disabled"}</span>
                </label>
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-7 h-7 border border-border bg-bg dark:border-slate-700 dark:bg-slate-900"
                  onClick={() => removeLensRule(rule.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <select
                  value={rule.modelId ?? "all"}
                  onChange={(event) =>
                    updateLensRule(rule.id, {
                      modelId:
                        event.target.value === "all"
                          ? null
                          : Number(event.target.value),
                    })
                  }
                  className="px-2.5 py-2 border border-border bg-white text-[0.78rem] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option value="all">All models</option>
                  {loadedModels.map((model) => (
                    <option key={model.modelId} value={model.modelId}>
                      {model.fileName}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.field}
                  onChange={(event) =>
                    updateLensRule(rule.id, {
                      field: event.target.value as LensField,
                      value:
                        event.target.value === "changed"
                          ? "changed"
                          : rule.value,
                    })
                  }
                  className="px-2.5 py-2 border border-border bg-white text-[0.78rem] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  {fieldOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.operator}
                  onChange={(event) =>
                    updateLensRule(rule.id, {
                      operator: event.target.value as LensOperator,
                    })
                  }
                  className="px-2.5 py-2 border border-border bg-white text-[0.78rem] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  {operatorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.action}
                  onChange={(event) =>
                    updateLensRule(rule.id, {
                      action: event.target.value as LensAction,
                    })
                  }
                  className="px-2.5 py-2 border border-border bg-white text-[0.78rem] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  {actionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={rule.value}
                  onChange={(event) =>
                    updateLensRule(rule.id, { value: event.target.value })
                  }
                  className="flex-1 px-2.5 py-2 border border-border bg-white text-[0.78rem] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  disabled={rule.field === "changed"}
                />
                {rule.action === "color" ? (
                  <input
                    type="color"
                    value={rule.color}
                    onChange={(event) =>
                      updateLensRule(rule.id, { color: event.target.value })
                    }
                    className="w-12 h-10 border border-border bg-white dark:border-slate-700 dark:bg-slate-950"
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PropertiesPanel() {
  const [activeTab, setActiveTab] = useState<InspectorTab>("properties");
  const interactionMode = useViewerStore((state) => state.interactionMode);
  const measurement = useViewerStore((state) => state.measurement);
  const trackedChanges = useViewerStore((state) => state.trackedChanges);
  const upsertTrackedChange = useViewerStore((state) => state.upsertTrackedChange);
  const removeTrackedChange = useViewerStore((state) => state.removeTrackedChange);
  const setActiveModelId = useViewerStore((state) => state.setActiveModelId);
  const mergeSelectedProperties = useViewerStore((state) => state.mergeSelectedProperties);
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
  const {
    loadedModels,
    activeModelId,
    setModelVisibility,
    closeModel,
  } = useWebIfc();

  const { primary: geometryPrimary, aggregate: geometryAggregate, entityCount: geometryEntityCount } =
    useGeometryMetrics(selectedEntityId, selectedEntityIds);

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

  const applyEntryChange = async (
    entry: IfcPropertyEntry,
    sectionKind: PropertySectionKind,
    sectionTitle: string,
    nextValue: string,
  ) => {
    if (
      currentModelId === null ||
      selectedEntityId === null ||
      !entry.target ||
      !entry.editable
    ) {
      return;
    }

    try {
      const existingChange =
        selectedEntityChangeMap.get(getChangeKey(entry) ?? "") ?? null;
      const change = {
        entityExpressId: selectedEntityId,
        sectionKind,
        sectionTitle,
        entryKey: entry.key,
        target: entry.target,
        valueType: entry.valueType ?? "string",
        nextValue,
      } as const;
      const result = await ifcWorkerClient.updatePropertyValue(
        currentModelId,
        change,
      );
      mergeSelectedProperties(result.properties);
      upsertTrackedChange({
        modelId: currentModelId,
        ...change,
        originalValue: existingChange?.originalValue ?? entry.value,
        currentValue: nextValue,
        updatedAt: new Date().toISOString(),
      });
      addToast("success", `${entry.key} 값을 갱신했습니다`);
    } catch (error) {
      console.error(error);
      addToast(
        "error",
        `속성 수정 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      );
    }
  };

  const revertChange = async (change: TrackedIfcChange) => {
    try {
      const result = await ifcWorkerClient.updatePropertyValue(change.modelId, {
        entityExpressId: change.entityExpressId,
        sectionKind: change.sectionKind,
        sectionTitle: change.sectionTitle,
        entryKey: change.entryKey,
        target: change.target,
        valueType: change.valueType,
        nextValue: change.originalValue,
      });
      if (change.modelId === currentModelId) {
        mergeSelectedProperties(result.properties);
      }
      removeTrackedChange(change.modelId, change);
      addToast("success", `${change.entryKey} 변경을 되돌렸습니다`);
    } catch (error) {
      console.error(error);
      addToast(
        "error",
        `변경 되돌리기 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      );
    }
  };

  return (
    <aside className="panel panel-right">
      <div className="panel-header">
        <div className="flex items-center justify-between gap-3">
          <span>Properties</span>
          <small className="text-text-muted text-[0.7rem] tracking-normal normal-case dark:text-slate-400">
            {selectedEntityId ?? "No entity"}
          </small>
        </div>
        <div className="inline-flex items-center gap-0 p-0 border border-border rounded-none bg-bg dark:border-slate-600 dark:bg-slate-800">
          <button
            type="button"
            className={clsx("panel-tab", activeTab === "properties" && "panel-tab-active")}
            onClick={() => setActiveTab("properties")}
          >
            <FileJson2 size={14} strokeWidth={2} />
            <span>Properties</span>
          </button>
          <button
            type="button"
            className={clsx("panel-tab", activeTab === "quantities" && "panel-tab-active")}
            onClick={() => setActiveTab("quantities")}
          >
            <Ruler size={14} strokeWidth={2} />
            <span>Quantities</span>
          </button>
        </div>
      </div>
      <div className="flex flex-col min-h-0 overflow-hidden p-3.5 pr-2 text-text-secondary">
        <div className="min-h-0 overflow-auto pr-1.5 grid align-content-start gap-3.5">
          <div className="prop-section">
            <div className="flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center w-7 h-7 border border-border-subtle rounded-full bg-bg text-text-secondary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <Layers3 size={14} strokeWidth={2} />
              </span>
              <div>
                <strong className="block text-text text-[0.92rem] dark:text-slate-100">
                  Models
                </strong>
                <small className="text-text-muted text-[0.72rem] dark:text-slate-400">
                  {loadedModels.length}개 로드됨 · Active {activeModelId ?? "-"}
                </small>
              </div>
            </div>
            {loadedModels.length === 0 ? (
              <div className="prop-empty">로드된 모델이 없습니다.</div>
            ) : (
              <div className="grid gap-2">
                {loadedModels.map((model) => {
                  const modelChangeCount = trackedChanges.filter(
                    (change) => change.modelId === model.modelId,
                  ).length;
                  return (
                    <div
                      key={model.modelId}
                      className={clsx(
                        "grid gap-2 p-2.5 border border-border bg-white/80 dark:border-slate-700 dark:bg-slate-900/40",
                        model.modelId === activeModelId && "border-primary/40 dark:border-blue-500/40",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <strong className="block truncate text-text dark:text-slate-100">
                            {model.fileName}
                          </strong>
                          <small className="text-text-muted text-[0.72rem] dark:text-slate-400">
                            #{model.modelId} · {model.schema} · {modelChangeCount} changes
                          </small>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center w-8 h-8 border border-border bg-bg dark:border-slate-700 dark:bg-slate-900"
                            onClick={() => setModelVisibility(model.modelId, !model.visible)}
                          >
                            {model.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border bg-bg text-[0.72rem] font-medium dark:border-slate-700 dark:bg-slate-900"
                            onClick={() => setActiveModelId(model.modelId)}
                          >
                            {model.modelId === activeModelId ? "Active" : "Focus"}
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center w-8 h-8 border border-border bg-bg dark:border-slate-700 dark:bg-slate-900"
                            onClick={() => void closeModel(model.modelId)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <LensRulesCard />

          <div className="prop-section">
            <div className="flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center w-7 h-7 border border-border-subtle rounded-full bg-bg text-text-secondary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <PencilLine size={14} strokeWidth={2} />
              </span>
              <div>
                <strong className="block text-text text-[0.92rem] dark:text-slate-100">
                  Changes
                </strong>
                <small className="text-text-muted text-[0.72rem] dark:text-slate-400">
                  현재 모델 기준 {currentModelChanges.length}개 추적 중
                </small>
              </div>
            </div>
            {currentModelChanges.length === 0 ? (
              <div className="prop-empty">현재 모델의 변경 추적 항목이 없습니다.</div>
            ) : (
              <div className="grid gap-2">
                {currentModelChanges.map((change) => (
                  <div
                    key={`${change.modelId}:${change.target.lineExpressId}:${change.target.attributeName}`}
                    className="grid gap-1.5 p-2.5 border border-border bg-white/80 dark:border-slate-700 dark:bg-slate-900/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-text text-[0.82rem] dark:text-slate-100">
                        {change.entryKey}
                      </strong>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-2 py-1 border border-border bg-bg text-[0.72rem] font-medium dark:border-slate-700 dark:bg-slate-900"
                        onClick={() => void revertChange(change)}
                      >
                        <X size={12} />
                        <span>Revert</span>
                      </button>
                    </div>
                    <small className="text-text-muted text-[0.72rem] dark:text-slate-400">
                      {change.sectionTitle} · #{change.entityExpressId}
                    </small>
                    <div className="flex items-center justify-between gap-2 text-[0.75rem]">
                      <span>From {change.originalValue}</span>
                      <span>To {change.currentValue}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="prop-section">
            <div className="flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center w-7 h-7 border border-border-subtle rounded-full bg-bg text-text-secondary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <Layers3 size={14} strokeWidth={2} />
              </span>
              <div>
                <strong className="block text-text text-[0.92rem] dark:text-slate-100">
                  Inspector
                </strong>
                <small className="text-text-muted text-[0.72rem] dark:text-slate-400">
                  {selectedEntityIds.length > 1
                    ? `${selectedEntityIds.length}개 선택 중`
                    : "현재 선택된 IFC 엔티티"}
                </small>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 flex-1 min-w-0 border border-slate-300 rounded-[9px] bg-white text-text cursor-pointer px-3 py-2 hover:bg-bg disabled:opacity-45 disabled:cursor-default dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => {
                  if (selectedEntityIds.length > 0) {
                    selectedEntityIds.forEach((id) => hideEntity(id, currentModelId));
                  }
                }}
                disabled={selectedEntityIds.length === 0}
              >
                <EyeOff size={14} strokeWidth={2} />
                <span>
                  {selectedEntityIds.length > 1
                    ? `선택 ${selectedEntityIds.length}개 숨기기`
                    : "선택 숨기기"}
                </span>
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 flex-1 min-w-0 border border-slate-300 rounded-[9px] bg-white text-text cursor-pointer px-3 py-2 hover:bg-bg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                onClick={() => resetHiddenEntities(currentModelId)}
              >
                <Info size={14} strokeWidth={2} />
                <span>숨김 초기화</span>
              </button>
            </div>
          </div>

          <div className="grid gap-2.5 grid-cols-[repeat(2,minmax(0,1fr))]">
            <div className="grid gap-1 p-3 border border-border bg-white/90 dark:border-slate-600 dark:bg-slate-800/82">
              <span className="text-[0.72rem] tracking-[0.06em] uppercase text-text-muted dark:text-slate-400">
                현재 선택
              </span>
              <strong className="text-text text-[0.85rem] dark:text-slate-100">
                {selectedEntityIds.length > 0
                  ? `${selectedEntityIds.length} selected${selectedEntityId !== null ? ` · #${selectedEntityId}` : ""}`
                  : "없음"}
              </strong>
            </div>
            <div className="grid gap-1 p-3 border border-border bg-white/90 dark:border-slate-600 dark:bg-slate-800/82">
              <span className="text-[0.72rem] tracking-[0.06em] uppercase text-text-muted dark:text-slate-400">
                숨김 개수
              </span>
              <strong className="text-text text-[0.85rem] dark:text-slate-100">
                {hiddenEntityIds.size}
              </strong>
            </div>
            <div className="grid gap-1 p-3 border border-border bg-white/90 dark:border-slate-600 dark:bg-slate-800/82">
              <span className="text-[0.72rem] tracking-[0.06em] uppercase text-text-muted dark:text-slate-400">
                모델 스키마
              </span>
              <strong className="text-text text-[0.85rem] dark:text-slate-100">
                {currentModelSchema ?? "-"}
              </strong>
            </div>
            <div className="grid gap-1 p-3 border border-border bg-white/90 dark:border-slate-600 dark:bg-slate-800/82">
              <span className="text-[0.72rem] tracking-[0.06em] uppercase text-text-muted dark:text-slate-400">
                최대 Express ID
              </span>
              <strong className="text-text text-[0.85rem] dark:text-slate-100">
                {currentModelMaxExpressId ?? "-"}
              </strong>
            </div>
          </div>

          <div className="prop-list">
            <div className="prop-header">
              <span className="prop-label">모델 컨텍스트</span>
              <small className="prop-small">{currentFileName ?? "로드된 파일 없음"}</small>
            </div>
            <div className="prop-row"><span className="prop-key">File</span><strong className="prop-value">{currentFileName ?? "-"}</strong></div>
            <div className="prop-row"><span className="prop-key">Model ID</span><strong className="prop-value">{currentModelId ?? "-"}</strong></div>
            <div className="prop-row"><span className="prop-key">Schema</span><strong className="prop-value">{currentModelSchema ?? "-"}</strong></div>
            <div className="prop-row"><span className="prop-key">Max Express ID</span><strong className="prop-value">{currentModelMaxExpressId ?? "-"}</strong></div>
            <div className="prop-row">
              <span className="prop-key">Measure</span>
              <strong className="prop-value">
                {measurement.distance !== null
                  ? `${formatMetric(measurement.distance, "m", 3)}${interactionMode === "measure-distance" ? " · active" : ""}`
                  : interactionMode === "measure-distance"
                    ? "placing"
                    : "-"}
              </strong>
            </div>
          </div>

          <div className="prop-list">
            <div className="prop-header">
              <span className="prop-label">기본 속성</span>
              <small className="prop-small">{propertyCountLabel}</small>
            </div>
            <div className="prop-row"><span className="prop-key">GlobalId</span><strong className="prop-value">{properties.globalId ?? "-"}</strong></div>
            <div className="prop-row"><span className="prop-key">IfcType</span><strong className="prop-value">{properties.ifcType ?? "-"}</strong></div>
            <div className="prop-row"><span className="prop-key">Name</span><strong className="prop-value">{properties.name ?? "-"}</strong></div>
            {activeTab === "properties" ? (
              <div className="grid gap-2">
                {properties.attributes.map((entry) => (
                  <EditableEntryRow
                    key={entry.key}
                    entry={entry}
                    sectionKind="attributes"
                    sectionTitle="Attributes"
                    change={entry.target ? selectedEntityChangeMap.get(getChangeKey(entry) ?? "") ?? null : null}
                    disabled={currentModelId === null || selectedEntityId === null}
                    onApply={applyEntryChange}
                    onRevert={revertChange}
                  />
                ))}
              </div>
            ) : (
              <div className="prop-empty">기본 메타 정보는 속성 탭에서 확인할 수 있습니다.</div>
            )}
          </div>

          {selectedEntityId !== null && (
            <div className="prop-list">
              <div className="prop-header">
                <span className="text-primary text-[0.79rem] font-bold tracking-wide uppercase dark:text-blue-400">
                  <Box size={12} strokeWidth={2} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />
                  Geometry
                </span>
                <small className="prop-small">
                  {geometryPrimary
                    ? `${geometryPrimary.triangleCount.toLocaleString()} triangles · ${geometryPrimary.vertexCount.toLocaleString()} vertices`
                    : "지오메트리 로딩 대기 중"}
                </small>
              </div>
              {geometryPrimary ? (
                <>
                  <div className="prop-row"><span className="prop-key">Bounding Box</span><strong className="prop-value">{geometryPrimary.boundingBox.size.map((v) => v.toFixed(2)).join(" × ")} m</strong></div>
                  <div className="prop-row"><span className="prop-key">Surface Area</span><strong className="prop-value">{formatMetric(geometryPrimary.surfaceArea, "m²")}</strong></div>
                  <div className="prop-row"><span className="prop-key">Volume</span><strong className="prop-value">{formatMetric(geometryPrimary.volume, "m³")}</strong></div>
                  <div className="prop-row"><span className="prop-key">Triangles</span><strong className="prop-value">{geometryPrimary.triangleCount.toLocaleString()}</strong></div>
                </>
              ) : (
                <div className="prop-empty">선택된 엔티티의 메시 데이터가 아직 로드되지 않았습니다.</div>
              )}
              {geometryAggregate && geometryEntityCount > 1 ? (
                <>
                  <div className="prop-header"><span className="prop-label">Multi-Select Summary</span><small className="prop-small">{geometryEntityCount}개 엔티티 합산</small></div>
                  <div className={clsx("prop-row", "bg-primary/5 dark:bg-blue-500/10")}><span className="prop-key">Total Area</span><strong className="prop-value">{formatMetric(geometryAggregate.surfaceArea, "m²")}</strong></div>
                  <div className={clsx("prop-row", "bg-primary/5 dark:bg-blue-500/10")}><span className="prop-key">Total Volume</span><strong className="prop-value">{formatMetric(geometryAggregate.volume, "m³")}</strong></div>
                  <div className={clsx("prop-row", "bg-primary/5 dark:bg-blue-500/10")}><span className="prop-key">Entities</span><strong className="prop-value">{geometryEntityCount}</strong></div>
                </>
              ) : null}
            </div>
          )}

          {activeTab === "properties" ? (
            <>
              <PropertySectionList title="Property Sets" description="IfcPropertySet / 관련 확장 속성" sections={properties.propertySets} emptyMessage={propertiesLoadingSections.includes("propertySets") ? "Property Set을 읽는 중입니다." : "연결된 Property Set이 없습니다."} sectionKind="propertySets" changeMap={selectedEntityChangeMap} disabled={currentModelId === null || selectedEntityId === null} onApplyEntryChange={applyEntryChange} onRevertChange={revertChange} />
              <PropertySectionList title="Type Properties" description="IfcTypeObject 기반 속성" sections={properties.typeProperties} emptyMessage={propertiesLoadingSections.includes("typeProperties") ? "Type 속성을 읽는 중입니다." : "연결된 Type 속성이 없습니다."} sectionKind="typeProperties" changeMap={selectedEntityChangeMap} disabled={true} onApplyEntryChange={applyEntryChange} onRevertChange={revertChange} />
              <PropertySectionList title="Materials" description="IfcMaterial / 재질 연관 정보" sections={properties.materials} emptyMessage={propertiesLoadingSections.includes("materials") ? "재질 정보를 읽는 중입니다." : "연결된 재질 정보가 없습니다."} sectionKind="materials" changeMap={selectedEntityChangeMap} disabled={true} onApplyEntryChange={applyEntryChange} onRevertChange={revertChange} />
              <PropertySectionList title="Documents" description={`IfcRelAssociatesDocument 기반 문서 참조 · ${properties.documents.length} sections${propertiesLoadingSections.includes("documents") ? " · loading" : ""}`} sections={properties.documents} emptyMessage={propertiesLoadingSections.includes("documents") ? "문서 참조를 읽는 중입니다." : "연결된 문서 정보가 없습니다."} sectionKind="documents" changeMap={selectedEntityChangeMap} disabled={true} onApplyEntryChange={applyEntryChange} onRevertChange={revertChange} />
              <PropertySectionList title="Classifications" description={`IfcRelAssociatesClassification 기반 분류 정보 · ${properties.classifications.length} sections${propertiesLoadingSections.includes("classifications") ? " · loading" : ""}`} sections={properties.classifications} emptyMessage={propertiesLoadingSections.includes("classifications") ? "분류 정보를 읽는 중입니다." : "연결된 분류 정보가 없습니다."} sectionKind="classifications" changeMap={selectedEntityChangeMap} disabled={true} onApplyEntryChange={applyEntryChange} onRevertChange={revertChange} />
              <PropertySectionList title="Metadata" description={`설명, 타입, 배치, 표현 메타데이터 · ${properties.metadata.length} sections${propertiesLoadingSections.includes("metadata") ? " · loading" : ""}`} sections={properties.metadata} emptyMessage={propertiesLoadingSections.includes("metadata") ? "메타데이터를 읽는 중입니다." : "추가 메타데이터가 없습니다."} sectionKind="metadata" changeMap={selectedEntityChangeMap} disabled={true} onApplyEntryChange={applyEntryChange} onRevertChange={revertChange} />
              <PropertySectionList title="Relations" description="직접 참조하는 IFC 관계" sections={properties.relations} emptyMessage={propertiesLoadingSections.includes("relations") ? "직접 관계를 읽는 중입니다." : "직접 관계 정보가 없습니다."} sectionKind="relations" changeMap={selectedEntityChangeMap} disabled={true} onApplyEntryChange={applyEntryChange} onRevertChange={revertChange} />
              <PropertySectionList title="Inverse Relations" description="다른 엔티티에서 참조하는 역방향 관계" sections={properties.inverseRelations} emptyMessage={propertiesLoadingSections.includes("inverseRelations") ? "역방향 관계를 읽는 중입니다." : "역방향 관계 정보가 없습니다."} sectionKind="inverseRelations" changeMap={selectedEntityChangeMap} disabled={true} onApplyEntryChange={applyEntryChange} onRevertChange={revertChange} />
            </>
          ) : (
            <PropertySectionList title="Quantities" description="Qto_* 수량 세트" sections={properties.quantitySets} emptyMessage={propertiesLoadingSections.includes("quantitySets") ? "수량 정보를 읽는 중입니다." : "연결된 수량 정보가 없습니다."} sectionKind="quantitySets" changeMap={selectedEntityChangeMap} disabled={currentModelId === null || selectedEntityId === null} onApplyEntryChange={applyEntryChange} onRevertChange={revertChange} />
          )}

          {propertiesError ? (
            <div className="flex items-start gap-2 p-3 border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
              <Info size={14} strokeWidth={2} />
              <p className="m-0 text-[0.8rem] leading-normal">{propertiesError}</p>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 border border-border bg-bg text-text-secondary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
              <Info size={14} strokeWidth={2} />
              <p className="m-0 text-[0.8rem] leading-normal">
                속성 패널은 편집 가능한 scalar 속성만 즉시 수정합니다. 변경 내역은 추적되며 IFC export 시 반영됩니다.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-t-2 border-border bg-slate-50/92 text-text-muted text-xs tracking-wide uppercase dark:border-slate-700 dark:bg-slate-800/92 dark:text-slate-400">
        <span>{selectedEntityIds.length === 0 ? "Inspector idle" : "Inspector ready"}</span>
        <strong className="text-text text-[0.76rem] font-mono dark:text-slate-200">
          {hiddenEntityIds.size} hidden · {trackedChanges.length} changes
        </strong>
      </div>
    </aside>
  );
}
