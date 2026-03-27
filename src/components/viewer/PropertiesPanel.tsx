import { useState } from "react";
import { clsx } from "clsx";
import {
  Box,
  Eye,
  EyeOff,
  FlipVertical2,
  Info,
  Layers3,
  Lock,
  PencilLine,
  Plus,
  Scissors,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconActionButton } from "@/components/ui/IconActionButton";
import { PanelCard } from "@/components/ui/PanelCard";
import { StatCard } from "@/components/ui/StatCard";
import { usePropertiesController } from "@/hooks/controllers/usePropertiesController";
import type { PropertySectionKind } from "@/types/worker-messages";
import { formatMetric } from "@/utils/geometryMetrics";
import { PanelSegmentedControl } from "./PanelSegmentedControl";
import { EditableEntryRow } from "./properties/EditableEntryRow";
import { LensRulesCard } from "./properties/LensRulesCard";
import { getChangeKey } from "./properties/propertyChangeUtils";
import { PropertySectionList } from "./properties/PropertySectionList";

interface PropertySectionConfig {
  title: string;
  description: string;
  sectionKind: PropertySectionKind;
  sections: Parameters<typeof PropertySectionList>[0]["sections"];
  emptyMessage: string;
  disabled: boolean;
}

export function PropertiesPanel() {
  const ctrl = usePropertiesController();
  const [editingPlaneId, setEditingPlaneId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const selectedPlane = ctrl.selectedClippingPlane;
  const clippingUnavailable = !ctrl.hasLoadedModel;
  const headerMeta =
    ctrl.activeTab === "editor"
      ? clippingUnavailable
        ? "No IFC"
        : ctrl.clipping.mode === "creating"
        ? "Clipping draft"
        : selectedPlane?.name ?? `${ctrl.clipping.planes.length} planes`
      : ctrl.selectedEntityId ?? "No entity";
  const clippingMessage =
    clippingUnavailable
      ? "IFC 파일을 연 뒤 클리핑 평면을 사용할 수 있습니다."
      : ctrl.clipping.mode === "creating"
      ? ctrl.clipping.draft
        ? "두 번째 점을 지정해 클리핑 평면 크기를 확정하세요."
        : "모델 표면을 클릭해 첫 번째 점을 지정하세요."
      : selectedPlane
        ? `${selectedPlane.name} · ${selectedPlane.width.toFixed(2)} x ${selectedPlane.height.toFixed(2)}`
        : ctrl.clipping.planes.length > 0
          ? `${ctrl.clipping.planes.length}개의 클리핑 평면이 활성 상태입니다.`
          : "새 클리핑 평면을 만들어 Rhino 스타일 단면을 배치합니다.";
  const canEditSelectedEntity =
    ctrl.currentModelId !== null && ctrl.selectedEntityId !== null;
  const propertySections: PropertySectionConfig[] = [
    {
      title: "Property Sets",
      description: "IfcPropertySet / 관련 확장 속성",
      sections: ctrl.properties.propertySets,
      emptyMessage: ctrl.propertiesLoadingSections.includes("propertySets")
        ? "Property Set을 읽는 중입니다."
        : "연결된 Property Set이 없습니다.",
      sectionKind: "propertySets",
      disabled: !canEditSelectedEntity,
    },
    {
      title: "Type Properties",
      description: "IfcTypeObject 기반 속성",
      sections: ctrl.properties.typeProperties,
      emptyMessage: ctrl.propertiesLoadingSections.includes("typeProperties")
        ? "Type 속성을 읽는 중입니다."
        : "연결된 Type 속성이 없습니다.",
      sectionKind: "typeProperties",
      disabled: true,
    },
    {
      title: "Materials",
      description: "IfcMaterial / 재질 연관 정보",
      sections: ctrl.properties.materials,
      emptyMessage: ctrl.propertiesLoadingSections.includes("materials")
        ? "재질 정보를 읽는 중입니다."
        : "연결된 재질 정보가 없습니다.",
      sectionKind: "materials",
      disabled: true,
    },
    {
      title: "Documents",
      description: `IfcRelAssociatesDocument 기반 문서 참조 · ${ctrl.properties.documents.length} sections${
        ctrl.propertiesLoadingSections.includes("documents") ? " · loading" : ""
      }`,
      sections: ctrl.properties.documents,
      emptyMessage: ctrl.propertiesLoadingSections.includes("documents")
        ? "문서 참조를 읽는 중입니다."
        : "연결된 문서 정보가 없습니다.",
      sectionKind: "documents",
      disabled: true,
    },
    {
      title: "Classifications",
      description: `IfcRelAssociatesClassification 기반 분류 정보 · ${ctrl.properties.classifications.length} sections${
        ctrl.propertiesLoadingSections.includes("classifications")
          ? " · loading"
          : ""
      }`,
      sections: ctrl.properties.classifications,
      emptyMessage: ctrl.propertiesLoadingSections.includes("classifications")
        ? "분류 정보를 읽는 중입니다."
        : "연결된 분류 정보가 없습니다.",
      sectionKind: "classifications",
      disabled: true,
    },
    {
      title: "Metadata",
      description: `설명, 타입, 배치, 표현 메타데이터 · ${ctrl.properties.metadata.length} sections${
        ctrl.propertiesLoadingSections.includes("metadata") ? " · loading" : ""
      }`,
      sections: ctrl.properties.metadata,
      emptyMessage: ctrl.propertiesLoadingSections.includes("metadata")
        ? "메타데이터를 읽는 중입니다."
        : "추가 메타데이터가 없습니다.",
      sectionKind: "metadata",
      disabled: true,
    },
    {
      title: "Relations",
      description: "직접 참조하는 IFC 관계",
      sections: ctrl.properties.relations,
      emptyMessage: ctrl.propertiesLoadingSections.includes("relations")
        ? "직접 관계를 읽는 중입니다."
        : "직접 관계 정보가 없습니다.",
      sectionKind: "relations",
      disabled: true,
    },
    {
      title: "Inverse Relations",
      description: "다른 엔티티에서 참조하는 역방향 관계",
      sections: ctrl.properties.inverseRelations,
      emptyMessage: ctrl.propertiesLoadingSections.includes("inverseRelations")
        ? "역방향 관계를 읽는 중입니다."
        : "역방향 관계 정보가 없습니다.",
      sectionKind: "inverseRelations",
      disabled: true,
    },
  ];
  const quantitySections: PropertySectionConfig[] = [
    {
      title: "Quantities",
      description: "Qto_* 수량 세트",
      sections: ctrl.properties.quantitySets,
      emptyMessage: ctrl.propertiesLoadingSections.includes("quantitySets")
        ? "수량 정보를 읽는 중입니다."
        : "연결된 수량 정보가 없습니다.",
      sectionKind: "quantitySets",
      disabled: !canEditSelectedEntity,
    },
  ];

  const startRenamePlane = (planeId: string, name: string) => {
    setEditingPlaneId(planeId);
    setEditingName(name);
  };

  const commitRenamePlane = (planeId: string) => {
    ctrl.handleRenameClippingPlane(planeId, editingName);
    setEditingPlaneId(null);
  };

  return (
    <aside className="panel panel-right">
      <div className="panel-header">
        <div className="flex items-center justify-between gap-3">
          <span>{ctrl.activeTab === "editor" ? "Editor" : "Properties"}</span>
          <small className="text-text-muted text-[0.7rem] normal-case tracking-normal dark:text-slate-400">
            {headerMeta}
          </small>
        </div>
        <PanelSegmentedControl
          ariaLabel="Inspector tab"
          value={ctrl.activeTab}
          onChange={ctrl.setActiveTab}
          options={ctrl.inspectorTabs}
        />
      </div>

      {ctrl.activeTab === "editor" ? (
        <>
          <div className="flex min-h-0 flex-col overflow-hidden p-3.5 pr-2 text-text-secondary">
            <div className="grid min-h-0 gap-3.5 overflow-auto pr-1.5 align-content-start">
              <PanelCard
                title="Clipping Editor"
                description={clippingMessage}
              >
                <div className="flex flex-wrap gap-2">
                  <IconActionButton
                    icon={<Plus size={14} />}
                    label={
                      ctrl.clipping.mode === "creating"
                        ? "클리핑 생성 중"
                        : "새 클리핑 평면"
                    }
                    onClick={ctrl.handleStartCreateClippingPlane}
                    disabled={clippingUnavailable || ctrl.clipping.mode === "creating"}
                  >
                    {ctrl.clipping.mode === "creating" ? "Creating" : "New Plane"}
                  </IconActionButton>
                  {ctrl.clipping.mode === "creating" ? (
                    <IconActionButton
                      icon={<X size={14} />}
                      label="생성 취소"
                      onClick={ctrl.handleCancelCreateClippingPlane}
                    >
                      Cancel
                    </IconActionButton>
                  ) : null}
                  {ctrl.clipping.planes.length > 0 ? (
                    <IconActionButton
                      icon={<Trash2 size={14} />}
                      label="전체 삭제"
                      variant="danger"
                      onClick={ctrl.handleClearClippingPlanes}
                      disabled={clippingUnavailable}
                    >
                      Delete All
                    </IconActionButton>
                  ) : null}
                </div>
              </PanelCard>

              <PanelCard
                title="Planes"
                description={`${ctrl.clipping.planes.length}개 plane`}
              >
                {ctrl.clipping.planes.length === 0 ? (
                  <EmptyState
                    icon={<Scissors size={16} strokeWidth={2} />}
                    description="클리핑 평면이 없습니다."
                  />
                ) : (
                  <div className="grid gap-2">
                    {ctrl.clipping.planes.map((plane) => (
                      <div
                        key={plane.id}
                        className={`grid gap-2 rounded-lg border px-3 py-2.5 ${
                          plane.selected
                            ? "border-blue-500/45 bg-blue-50/70 dark:border-blue-500/55 dark:bg-slate-800"
                            : "border-border-subtle bg-white/92 dark:border-slate-700 dark:bg-slate-900/82"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-500/30 bg-white/95 text-[0.68rem] font-bold text-blue-700 dark:bg-slate-900 dark:text-blue-300"
                            onClick={() => ctrl.handleSelectClippingPlane(plane.id)}
                            title="클리핑 평면 선택"
                            disabled={clippingUnavailable}
                          >
                            {plane.selected ? "A" : ""}
                          </button>
                          <div className="min-w-0 flex-1">
                            {editingPlaneId === plane.id ? (
                              <input
                                autoFocus
                                value={editingName}
                                onChange={(event) => setEditingName(event.target.value)}
                                onBlur={() => commitRenamePlane(plane.id)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    commitRenamePlane(plane.id);
                                  }
                                  if (event.key === "Escape") {
                                    setEditingPlaneId(null);
                                  }
                                }}
                                className="w-full rounded border border-border px-2 py-1 text-[0.78rem] font-semibold text-text dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                              />
                            ) : (
                              <button
                                type="button"
                                className="block max-w-full truncate text-left text-[0.82rem] font-semibold text-text dark:text-slate-100"
                                onClick={() => ctrl.handleSelectClippingPlane(plane.id)}
                                onDoubleClick={() => {
                                  if (clippingUnavailable) {
                                    return;
                                  }
                                  startRenamePlane(plane.id, plane.name);
                                }}
                                disabled={clippingUnavailable}
                              >
                                {plane.name}
                              </button>
                            )}
                            <small className="block text-[0.68rem] text-text-muted dark:text-slate-400">
                              {plane.width.toFixed(2)} x {plane.height.toFixed(2)} ·{" "}
                              {plane.locked ? "Locked" : "Editable"}
                            </small>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            className="btn-scope"
                            onClick={() => ctrl.handleToggleClippingPlaneEnabled(plane.id)}
                            disabled={clippingUnavailable}
                          >
                            {plane.enabled ? (
                              <Eye size={12} strokeWidth={2} />
                            ) : (
                              <EyeOff size={12} strokeWidth={2} />
                            )}
                            <span>{plane.enabled ? "Visible" : "Hidden"}</span>
                          </button>
                          <button
                            type="button"
                            className="btn-scope"
                            onClick={() => ctrl.handleToggleClippingPlaneLocked(plane.id)}
                            disabled={clippingUnavailable}
                          >
                            {plane.locked ? (
                              <Lock size={12} strokeWidth={2} />
                            ) : (
                              <Unlock size={12} strokeWidth={2} />
                            )}
                            <span>{plane.locked ? "Locked" : "Unlocked"}</span>
                          </button>
                          <button
                            type="button"
                            className="btn-scope"
                            onClick={() => ctrl.handleFlipClippingPlane(plane.id)}
                            disabled={clippingUnavailable || plane.locked}
                          >
                            <FlipVertical2 size={12} strokeWidth={2} />
                            <span>Flip</span>
                          </button>
                          <button
                            type="button"
                            className="btn-scope"
                            onClick={() => startRenamePlane(plane.id, plane.name)}
                            disabled={clippingUnavailable}
                          >
                            <PencilLine size={12} strokeWidth={2} />
                            <span>Rename</span>
                          </button>
                          <button
                            type="button"
                            className="btn-scope"
                            onClick={() => ctrl.handleDeleteClippingPlane(plane.id)}
                            disabled={clippingUnavailable}
                          >
                            <Trash2 size={12} strokeWidth={2} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </PanelCard>

              {selectedPlane ? (
                <PanelCard
                  title="Selected Plane"
                  description={`${selectedPlane.enabled ? "Enabled" : "Disabled"} · ${selectedPlane.locked ? "Locked" : "Unlocked"}`}
                >
                  <div className="flex flex-wrap gap-2">
                    <IconActionButton
                      icon={
                        selectedPlane.enabled ? (
                          <Eye size={14} />
                        ) : (
                          <EyeOff size={14} />
                        )
                      }
                      label={selectedPlane.enabled ? "평면 숨기기" : "평면 보이기"}
                      onClick={() =>
                        ctrl.handleToggleClippingPlaneEnabled(selectedPlane.id)
                      }
                      disabled={clippingUnavailable}
                    >
                      {selectedPlane.enabled ? "Hide Plane" : "Show Plane"}
                    </IconActionButton>
                    <IconActionButton
                      icon={
                        selectedPlane.locked ? (
                          <Lock size={14} />
                        ) : (
                          <Unlock size={14} />
                        )
                      }
                      label={
                        selectedPlane.locked ? "평면 잠금 해제" : "평면 잠금"
                      }
                      onClick={() =>
                        ctrl.handleToggleClippingPlaneLocked(selectedPlane.id)
                      }
                      disabled={clippingUnavailable}
                    >
                      {selectedPlane.locked ? "Unlock" : "Lock"}
                    </IconActionButton>
                    <IconActionButton
                      icon={<FlipVertical2 size={14} />}
                      label="절단 방향 반전"
                      onClick={() => ctrl.handleFlipClippingPlane(selectedPlane.id)}
                      disabled={clippingUnavailable || selectedPlane.locked}
                    >
                      Flip Direction
                    </IconActionButton>
                    <IconActionButton
                      icon={<Trash2 size={14} />}
                      label="선택된 평면 삭제"
                      variant="danger"
                      onClick={() => ctrl.handleDeleteClippingPlane(selectedPlane.id)}
                      disabled={clippingUnavailable}
                    >
                      Delete Selected
                    </IconActionButton>
                  </div>

                  <div className="prop-list">
                    <div className="prop-row">
                      <span className="prop-key">Size</span>
                      <strong className="prop-value">
                        {selectedPlane.width.toFixed(2)} x{" "}
                        {selectedPlane.height.toFixed(2)}
                      </strong>
                    </div>
                    <div className="prop-row">
                      <span className="prop-key">Origin</span>
                      <strong className="prop-value">
                        {selectedPlane.origin
                          .map((value) => value.toFixed(2))
                          .join(", ")}
                      </strong>
                    </div>
                    <div className="prop-row">
                      <span className="prop-key">Normal</span>
                      <strong className="prop-value">
                        {selectedPlane.normal
                          .map((value) => value.toFixed(2))
                          .join(", ")}
                      </strong>
                    </div>
                  </div>
                </PanelCard>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t-2 border-border bg-slate-50/92 px-3.5 py-2.5 text-xs uppercase tracking-wide text-text-muted dark:border-slate-700 dark:bg-slate-800/92 dark:text-slate-400">
            <span>
              {ctrl.clipping.mode === "creating" ? "Clipping create" : "Clipping editor"}
            </span>
            <strong className="text-text text-[0.76rem] font-mono dark:text-slate-200">
              {ctrl.clipping.planes.length} planes · {selectedPlane ? "selected" : "idle"}
            </strong>
          </div>
        </>
      ) : (
        <>
          <div className="flex min-h-0 flex-col overflow-hidden p-3.5 pr-2 text-text-secondary">
            <div className="grid min-h-0 gap-3.5 overflow-auto pr-1.5 align-content-start">
          <PanelCard
            title="Models"
            description={`${ctrl.modelCards.length}개 로드됨 · Active ${
              ctrl.modelCards.find((model) => model.isActive)?.modelId ?? "-"
            }`}
          >
            {ctrl.modelCards.length === 0 ? (
              <EmptyState description="로드된 모델이 없습니다." />
            ) : (
              <div className="grid gap-2">
                {ctrl.modelCards.map((model) => (
                  <PanelCard
                    key={model.modelId}
                    variant={model.isActive ? "accent" : "soft"}
                    className="gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <strong className="block truncate text-text">
                          {model.fileName}
                        </strong>
                        <small className="text-text-muted text-[0.72rem]">
                          #{model.modelId} · {model.schema} · {model.changeCount} changes
                        </small>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <IconActionButton
                          icon={model.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                          label={model.visible ? "모델 숨기기" : "모델 표시"}
                          iconOnly
                          onClick={() =>
                            ctrl.handleSetModelVisibility(model.modelId, !model.visible)
                          }
                        />
                        <IconActionButton
                          icon={<Layers3 size={14} />}
                          label={model.isActive ? "Active" : "Focus"}
                          onClick={() => ctrl.handleFocusModel(model.modelId)}
                        >
                          {model.isActive ? "Active" : "Focus"}
                        </IconActionButton>
                        <IconActionButton
                          icon={<Trash2 size={14} />}
                          label="모델 닫기"
                          iconOnly
                          variant="danger"
                          onClick={() => {
                            void ctrl.handleCloseModel(model.modelId);
                          }}
                        />
                      </div>
                    </div>
                  </PanelCard>
                ))}
              </div>
            )}
          </PanelCard>

          <LensRulesCard />

          <PanelCard
            title="Changes"
            description={`현재 모델 기준 ${ctrl.currentModelChanges.length}개 추적 중`}
          >
            {ctrl.currentModelChanges.length === 0 ? (
              <EmptyState description="현재 모델의 변경 추적 항목이 없습니다." />
            ) : (
              <div className="grid gap-2">
                {ctrl.currentModelChanges.map((change) => (
                  <PanelCard
                    key={`${change.modelId}:${change.target.lineExpressId}:${change.target.attributeName}`}
                    variant="soft"
                    className="gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-[0.82rem] text-text">
                        {change.entryKey}
                      </strong>
                      <IconActionButton
                        icon={<X size={12} />}
                        label="Revert"
                        onClick={() => {
                          void ctrl.propertyActions.revertChange(change);
                        }}
                      >
                        Revert
                      </IconActionButton>
                    </div>
                    <small className="text-text-muted text-[0.72rem]">
                      {change.sectionTitle} · #{change.entityExpressId}
                    </small>
                    <div className="flex items-center justify-between gap-2 text-[0.75rem]">
                      <span>From {change.originalValue}</span>
                      <span>To {change.currentValue}</span>
                    </div>
                  </PanelCard>
                ))}
              </div>
            )}
          </PanelCard>

          <PanelCard
            title="Inspector"
            description={
              ctrl.selectedEntityIds.length > 1
                ? `${ctrl.selectedEntityIds.length}개 선택 중`
                : "현재 선택된 IFC 엔티티"
            }
          >
            <div className="flex flex-wrap gap-2.5">
              <IconActionButton
                icon={<EyeOff size={14} strokeWidth={2} />}
                label={
                  ctrl.selectedEntityIds.length > 1
                    ? `선택 ${ctrl.selectedEntityIds.length}개 숨기기`
                    : "선택 숨기기"
                }
                className="min-w-0 flex-1 justify-center"
                onClick={ctrl.handleHideSelectedEntities}
                disabled={ctrl.selectedEntityIds.length === 0}
              >
                {ctrl.selectedEntityIds.length > 1
                  ? `선택 ${ctrl.selectedEntityIds.length}개 숨기기`
                  : "선택 숨기기"}
              </IconActionButton>
              <IconActionButton
                icon={<Info size={14} strokeWidth={2} />}
                label="숨김 초기화"
                className="min-w-0 flex-1 justify-center"
                onClick={ctrl.handleResetHiddenEntities}
              >
                숨김 초기화
              </IconActionButton>
            </div>
          </PanelCard>

          <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2.5">
            <StatCard
              label="현재 선택"
              value={
                ctrl.selectedEntityIds.length > 0
                  ? `${ctrl.selectedEntityIds.length} selected${
                      ctrl.selectedEntityId !== null
                        ? ` · #${ctrl.selectedEntityId}`
                        : ""
                    }`
                  : "없음"
              }
            />
            <StatCard label="숨김 개수" value={ctrl.hiddenEntityIds.size} />
            <StatCard label="모델 스키마" value={ctrl.currentModelSchema ?? "-"} />
            <StatCard
              label="최대 Express ID"
              value={ctrl.currentModelMaxExpressId ?? "-"}
            />
          </div>

          <div className="prop-list">
            <div className="prop-header">
              <span className="prop-label">모델 컨텍스트</span>
              <small className="prop-small">
                {ctrl.currentFileName ?? "로드된 파일 없음"}
              </small>
            </div>
            <div className="prop-row">
              <span className="prop-key">File</span>
              <strong className="prop-value">{ctrl.currentFileName ?? "-"}</strong>
            </div>
            <div className="prop-row">
              <span className="prop-key">Model ID</span>
              <strong className="prop-value">{ctrl.currentModelId ?? "-"}</strong>
            </div>
            <div className="prop-row">
              <span className="prop-key">Schema</span>
              <strong className="prop-value">{ctrl.currentModelSchema ?? "-"}</strong>
            </div>
            <div className="prop-row">
              <span className="prop-key">Max Express ID</span>
              <strong className="prop-value">
                {ctrl.currentModelMaxExpressId ?? "-"}
              </strong>
            </div>
            <div className="prop-row">
              <span className="prop-key">Measure</span>
              <strong className="prop-value">
                {ctrl.measurement.distance !== null
                  ? `${formatMetric(ctrl.measurement.distance, "m", 3)}${
                      ctrl.interactionMode === "measure-distance"
                        ? " · active"
                        : ""
                    }`
                  : ctrl.interactionMode === "measure-distance"
                    ? "placing"
                    : "-"}
              </strong>
            </div>
          </div>

          <div className="prop-list">
            <div className="prop-header">
              <span className="prop-label">기본 속성</span>
              <small className="prop-small">{ctrl.propertyCountLabel}</small>
            </div>
            <div className="prop-row">
              <span className="prop-key">GlobalId</span>
              <strong className="prop-value">{ctrl.properties.globalId ?? "-"}</strong>
            </div>
            <div className="prop-row">
              <span className="prop-key">IfcType</span>
              <strong className="prop-value">{ctrl.properties.ifcType ?? "-"}</strong>
            </div>
            <div className="prop-row">
              <span className="prop-key">Name</span>
              <strong className="prop-value">{ctrl.properties.name ?? "-"}</strong>
            </div>
            {ctrl.activeTab === "properties" ? (
              <div className="grid gap-2">
                {ctrl.properties.attributes.map((entry) => (
                  <EditableEntryRow
                    key={entry.key}
                    entry={entry}
                    sectionKind="attributes"
                    sectionTitle="Attributes"
                    change={
                      entry.target
                        ? ctrl.selectedEntityChangeMap.get(getChangeKey(entry) ?? "") ??
                          null
                        : null
                    }
                    disabled={!canEditSelectedEntity}
                    onApply={ctrl.propertyActions.applyEntryChange}
                    onRevert={ctrl.propertyActions.revertChange}
                  />
                ))}
              </div>
            ) : (
              <div className="prop-empty">
                기본 메타 정보는 속성 탭에서 확인할 수 있습니다.
              </div>
            )}
          </div>

          {ctrl.selectedEntityId !== null ? (
            <div className="prop-list">
              <div className="prop-header">
                <span className="text-primary text-[0.79rem] font-bold tracking-wide uppercase dark:text-blue-400">
                  <Box
                    size={12}
                    strokeWidth={2}
                    style={{
                      display: "inline",
                      verticalAlign: "-1px",
                      marginRight: 4,
                    }}
                  />
                  Geometry
                </span>
                <small className="prop-small">
                  {ctrl.geometryPrimary
                    ? `${ctrl.geometryPrimary.triangleCount.toLocaleString()} triangles · ${ctrl.geometryPrimary.vertexCount.toLocaleString()} vertices`
                    : "지오메트리 로딩 대기 중"}
                </small>
              </div>
              {ctrl.geometryPrimary ? (
                <>
                  <div className="prop-row">
                    <span className="prop-key">Bounding Box</span>
                    <strong className="prop-value">
                      {ctrl.geometryPrimary.boundingBox.size
                        .map((value) => value.toFixed(2))
                        .join(" × ")}{" "}
                      m
                    </strong>
                  </div>
                  <div className="prop-row">
                    <span className="prop-key">Surface Area</span>
                    <strong className="prop-value">
                      {formatMetric(ctrl.geometryPrimary.surfaceArea, "m²")}
                    </strong>
                  </div>
                  <div className="prop-row">
                    <span className="prop-key">Volume</span>
                    <strong className="prop-value">
                      {formatMetric(ctrl.geometryPrimary.volume, "m³")}
                    </strong>
                  </div>
                  <div className="prop-row">
                    <span className="prop-key">Triangles</span>
                    <strong className="prop-value">
                      {ctrl.geometryPrimary.triangleCount.toLocaleString()}
                    </strong>
                  </div>
                </>
              ) : (
                <div className="prop-empty">
                  선택된 엔티티의 메시 데이터가 아직 로드되지 않았습니다.
                </div>
              )}
              {ctrl.geometryAggregate && ctrl.geometryEntityCount > 1 ? (
                <>
                  <div className="prop-header">
                    <span className="prop-label">Multi-Select Summary</span>
                    <small className="prop-small">
                      {ctrl.geometryEntityCount}개 엔티티 합산
                    </small>
                  </div>
                  <div className={clsx("prop-row", "bg-primary/5 dark:bg-blue-500/10")}>
                    <span className="prop-key">Total Area</span>
                    <strong className="prop-value">
                      {formatMetric(ctrl.geometryAggregate.surfaceArea, "m²")}
                    </strong>
                  </div>
                  <div className={clsx("prop-row", "bg-primary/5 dark:bg-blue-500/10")}>
                    <span className="prop-key">Total Volume</span>
                    <strong className="prop-value">
                      {formatMetric(ctrl.geometryAggregate.volume, "m³")}
                    </strong>
                  </div>
                  <div className={clsx("prop-row", "bg-primary/5 dark:bg-blue-500/10")}>
                    <span className="prop-key">Entities</span>
                    <strong className="prop-value">{ctrl.geometryEntityCount}</strong>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {(ctrl.activeTab === "properties" ? propertySections : quantitySections).map(
            (section) => (
              <PropertySectionList
                key={section.title}
                title={section.title}
                description={section.description}
                sections={section.sections}
                emptyMessage={section.emptyMessage}
                sectionKind={section.sectionKind}
                changeMap={ctrl.selectedEntityChangeMap}
                disabled={section.disabled}
                onApplyEntryChange={ctrl.propertyActions.applyEntryChange}
                onRevertChange={ctrl.propertyActions.revertChange}
              />
            ),
          )}

          {ctrl.propertiesError ? (
            <PanelCard
              variant="soft"
              className="gap-2 border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400"
            >
              <div className="flex items-start gap-2">
                <Info size={14} strokeWidth={2} />
                <p className="m-0 text-[0.8rem] leading-normal">{ctrl.propertiesError}</p>
              </div>
            </PanelCard>
          ) : (
            <PanelCard variant="soft" className="gap-2">
              <div className="flex items-start gap-2 text-[0.8rem] leading-normal">
                <Info size={14} strokeWidth={2} />
                <p className="m-0">
                  속성 패널은 편집 가능한 scalar 속성만 즉시 수정합니다. 변경
                  내역은 추적되며 IFC export 시 반영됩니다.
                </p>
              </div>
            </PanelCard>
          )}
        </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t-2 border-border bg-slate-50/92 px-3.5 py-2.5 text-xs uppercase tracking-wide text-text-muted dark:border-slate-700 dark:bg-slate-800/92 dark:text-slate-400">
            <span>
              {ctrl.selectedEntityIds.length === 0 ? "Inspector idle" : "Inspector ready"}
            </span>
            <strong className="text-text text-[0.76rem] font-mono dark:text-slate-200">
              {ctrl.hiddenEntityIds.size} hidden · {ctrl.trackedChanges.length} changes
            </strong>
          </div>
        </>
      )}
    </aside>
  );
}
