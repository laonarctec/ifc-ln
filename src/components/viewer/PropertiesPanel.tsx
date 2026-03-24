import { clsx } from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Box, Crosshair, EyeOff, FileJson2, Info, Ruler, Tags } from "lucide-react";
import type { IfcPropertySection } from "@/types/worker-messages";
import { usePropertiesPanelData } from "./properties/usePropertiesPanelData";
import { useGeometryMetrics } from "@/hooks/useGeometryMetrics";
import { formatMetric } from "@/utils/geometryMetrics";

type InspectorTab = "properties" | "quantities";

function PropertySectionList({
  title,
  description,
  sections,
  emptyMessage,
}: {
  title: string;
  description: string;
  sections: IfcPropertySection[];
  emptyMessage: string;
}) {
  if (sections.length === 0) {
    return (
      <div className={"prop-list"}>
        <div className={"prop-header"}>
          <span className={"prop-label"}>{title}</span>
          <small className={"prop-small"}>{description}</small>
        </div>
        <div className={"prop-empty"}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {sections.map((section) => (
        <div key={`${section.title}-${section.expressID ?? "none"}`} className={"prop-list"}>
          <div className={"prop-header"}>
            <span className={"prop-label"}>{section.title}</span>
            <small className={"prop-small"}>
              {section.ifcType ?? "IFC"} · {section.entries.length}개 항목
            </small>
          </div>
          {section.entries.map((entry) => (
            <div key={`${section.title}-${entry.key}`} className={"prop-row"}>
              <span className={"prop-key"}>{entry.key}</span>
              <strong className={"prop-value"}>{entry.value}</strong>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function PropertiesPanel() {
  const [activeTab, setActiveTab] = useState<InspectorTab>("properties");
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

  const propertyCountLabel = useMemo(() => {
    if (propertiesLoading) return "속성 조회 중";
    const sectionCount =
      properties.attributes.length + properties.propertySets.length + properties.typeProperties.length +
      properties.materials.length + properties.documents.length + properties.classifications.length +
      properties.metadata.length + properties.relations.length + properties.inverseRelations.length;
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

  return (
    <aside className="panel panel-right">
      <div className="panel-header">
        <div className="flex items-center justify-between gap-3">
          <span>Properties</span>
          <small className="text-text-muted text-[0.7rem] tracking-normal normal-case dark:text-slate-400">{selectedEntityId ?? "No entity"}</small>
        </div>
        <div className="inline-flex items-center gap-0 p-0 border border-border rounded-none bg-bg dark:border-slate-600 dark:bg-slate-800">
          <button type="button" className={clsx('panel-tab', activeTab === 'properties' && 'panel-tab-active')} onClick={() => setActiveTab("properties")}>
            <FileJson2 size={14} strokeWidth={2} /><span>Properties</span>
          </button>
          <button type="button" className={clsx('panel-tab', activeTab === 'quantities' && 'panel-tab-active')} onClick={() => setActiveTab("quantities")}>
            <Ruler size={14} strokeWidth={2} /><span>Quantities</span>
          </button>
          <button type="button" className="panel-tab" disabled>
            <Tags size={14} strokeWidth={2} /><span>bSDD</span>
          </button>
        </div>
      </div>
      <div className="flex flex-col min-h-0 overflow-hidden p-3.5 pr-2 text-text-secondary">
        <div className="min-h-0 overflow-auto pr-1.5 grid align-content-start gap-3.5">
          {/* Inspector card */}
          <div className="prop-section">
            <div className="flex items-start gap-2.5">
              <span className="inline-flex items-center justify-center w-7 h-7 border border-border-subtle rounded-full bg-bg text-text-secondary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <Crosshair size={14} strokeWidth={2} />
              </span>
              <div>
                <strong className="block text-text text-[0.92rem] dark:text-slate-100">{selectedEntityId ?? "No selection"}</strong>
                <small className="text-text-muted text-[0.72rem] dark:text-slate-400">
                  {selectedEntityIds.length > 1 ? `${selectedEntityIds.length}개 선택 중 · primary entity` : "현재 선택된 IFC 엔티티"}
                </small>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button type="button" className="inline-flex items-center justify-center gap-2 flex-1 min-w-0 border border-slate-300 rounded-[9px] bg-white text-text cursor-pointer px-3 py-2 hover:bg-bg disabled:opacity-45 disabled:cursor-default dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700" onClick={() => { if (selectedEntityIds.length > 0) selectedEntityIds.forEach((id) => hideEntity(id)); }} disabled={selectedEntityIds.length === 0}>
                <EyeOff size={14} strokeWidth={2} />
                <span>{selectedEntityIds.length > 1 ? `선택 ${selectedEntityIds.length}개 숨기기` : "선택 숨기기"}</span>
              </button>
              <button type="button" className="inline-flex items-center justify-center gap-2 flex-1 min-w-0 border border-slate-300 rounded-[9px] bg-white text-text cursor-pointer px-3 py-2 hover:bg-bg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700" onClick={resetHiddenEntities}>
                <Info size={14} strokeWidth={2} /><span>숨김 초기화</span>
              </button>
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid gap-2.5 grid-cols-[repeat(2,minmax(0,1fr))]">
            <div className="grid gap-1 p-3 border border-border bg-white/90 dark:border-slate-600 dark:bg-slate-800/82">
              <span className="text-[0.72rem] tracking-[0.06em] uppercase text-text-muted dark:text-slate-400">현재 선택</span>
              <strong className="text-text text-[0.85rem] dark:text-slate-100">{selectedEntityIds.length > 0 ? `${selectedEntityIds.length} selected${selectedEntityId !== null ? ` · #${selectedEntityId}` : ""}` : "없음"}</strong>
            </div>
            <div className="grid gap-1 p-3 border border-border bg-white/90 dark:border-slate-600 dark:bg-slate-800/82">
              <span className="text-[0.72rem] tracking-[0.06em] uppercase text-text-muted dark:text-slate-400">숨김 개수</span>
              <strong className="text-text text-[0.85rem] dark:text-slate-100">{hiddenEntityIds.size}</strong>
            </div>
            <div className="grid gap-1 p-3 border border-border bg-white/90 dark:border-slate-600 dark:bg-slate-800/82">
              <span className="text-[0.72rem] tracking-[0.06em] uppercase text-text-muted dark:text-slate-400">모델 스키마</span>
              <strong className="text-text text-[0.85rem] dark:text-slate-100">{currentModelSchema ?? "-"}</strong>
            </div>
            <div className="grid gap-1 p-3 border border-border bg-white/90 dark:border-slate-600 dark:bg-slate-800/82">
              <span className="text-[0.72rem] tracking-[0.06em] uppercase text-text-muted dark:text-slate-400">최대 Express ID</span>
              <strong className="text-text text-[0.85rem] dark:text-slate-100">{currentModelMaxExpressId ?? "-"}</strong>
            </div>
          </div>

          <div className={"prop-list"}>
            <div className={"prop-header"}>
              <span className={"prop-label"}>모델 컨텍스트</span>
              <small className={"prop-small"}>{currentFileName ?? "로드된 파일 없음"}</small>
            </div>
            <div className={"prop-row"}><span className={"prop-key"}>File</span><strong className={"prop-value"}>{currentFileName ?? "-"}</strong></div>
            <div className={"prop-row"}><span className={"prop-key"}>Model ID</span><strong className={"prop-value"}>{currentModelId ?? "-"}</strong></div>
            <div className={"prop-row"}><span className={"prop-key"}>Schema</span><strong className={"prop-value"}>{currentModelSchema ?? "-"}</strong></div>
            <div className={"prop-row"}><span className={"prop-key"}>Max Express ID</span><strong className={"prop-value"}>{currentModelMaxExpressId ?? "-"}</strong></div>
          </div>

          {/* Basic properties */}
          <div className={"prop-list"}>
            <div className={"prop-header"}>
              <span className={"prop-label"}>기본 속성</span>
              <small className={"prop-small"}>{propertyCountLabel}</small>
            </div>
            <div className={"prop-row"}><span className={"prop-key"}>GlobalId</span><strong className={"prop-value"}>{properties.globalId ?? "-"}</strong></div>
            <div className={"prop-row"}><span className={"prop-key"}>IfcType</span><strong className={"prop-value"}>{properties.ifcType ?? "-"}</strong></div>
            <div className={"prop-row"}><span className={"prop-key"}>Name</span><strong className={"prop-value"}>{properties.name ?? "-"}</strong></div>
            {activeTab === "properties" ? (
              properties.attributes.map((attr) => (
                <div key={attr.key} className={"prop-row"}><span className={"prop-key"}>{attr.key}</span><strong className={"prop-value"}>{attr.value}</strong></div>
              ))
            ) : (
              <div className={"prop-empty"}>기본 메타 정보는 속성 탭에서 확인할 수 있습니다.</div>
            )}
          </div>

          {/* Geometry section */}
          {selectedEntityId !== null && (
            <div className={"prop-list"}>
              <div className={"prop-header"}>
                <span className="text-primary text-[0.79rem] font-bold tracking-wide uppercase dark:text-blue-400">
                  <Box size={12} strokeWidth={2} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />
                  Geometry
                </span>
                <small className={"prop-small"}>
                  {geometryPrimary
                    ? `${geometryPrimary.triangleCount.toLocaleString()} triangles · ${geometryPrimary.vertexCount.toLocaleString()} vertices`
                    : "지오메트리 로딩 대기 중"}
                </small>
              </div>
              {geometryPrimary ? (
                <>
                  <div className={"prop-row"}><span className={"prop-key"}>Bounding Box</span><strong className={"prop-value"}>{geometryPrimary.boundingBox.size.map((v) => v.toFixed(2)).join(" × ")} m</strong></div>
                  <div className={"prop-row"}><span className={"prop-key"}>Surface Area</span><strong className={"prop-value"}>{formatMetric(geometryPrimary.surfaceArea, "m²")}</strong></div>
                  <div className={"prop-row"}><span className={"prop-key"}>Volume</span><strong className={"prop-value"}>{formatMetric(geometryPrimary.volume, "m³")}</strong></div>
                  <div className={"prop-row"}><span className={"prop-key"}>Triangles</span><strong className={"prop-value"}>{geometryPrimary.triangleCount.toLocaleString()}</strong></div>
                </>
              ) : (
                <div className={"prop-empty"}>선택된 엔티티의 메시 데이터가 아직 로드되지 않았습니다.</div>
              )}
              {geometryAggregate && geometryEntityCount > 1 && (
                <>
                  <div className={"prop-header"}><span className={"prop-label"}>Multi-Select Summary</span><small className={"prop-small"}>{geometryEntityCount}개 엔티티 합산</small></div>
                  <div className={clsx("prop-row", "bg-primary/5 dark:bg-blue-500/10")}><span className={"prop-key"}>Total Area</span><strong className={"prop-value"}>{formatMetric(geometryAggregate.surfaceArea, "m²")}</strong></div>
                  <div className={clsx("prop-row", "bg-primary/5 dark:bg-blue-500/10")}><span className={"prop-key"}>Total Volume</span><strong className={"prop-value"}>{formatMetric(geometryAggregate.volume, "m³")}</strong></div>
                  <div className={clsx("prop-row", "bg-primary/5 dark:bg-blue-500/10")}><span className={"prop-key"}>Entities</span><strong className={"prop-value"}>{geometryEntityCount}</strong></div>
                </>
              )}
            </div>
          )}

          {/* Property sections */}
          {activeTab === "properties" ? (
            <>
              <PropertySectionList title="Property Sets" description="IfcPropertySet / 관련 확장 속성" sections={properties.propertySets} emptyMessage={propertiesLoadingSections.includes("propertySets") ? "Property Set을 읽는 중입니다." : "연결된 Property Set이 없습니다."} />
              <PropertySectionList title="Type Properties" description="IfcTypeObject 기반 속성" sections={properties.typeProperties} emptyMessage={propertiesLoadingSections.includes("typeProperties") ? "Type 속성을 읽는 중입니다." : "연결된 Type 속성이 없습니다."} />
              <PropertySectionList title="Materials" description="IfcMaterial / 재질 연관 정보" sections={properties.materials} emptyMessage={propertiesLoadingSections.includes("materials") ? "재질 정보를 읽는 중입니다." : "연결된 재질 정보가 없습니다."} />
              <PropertySectionList title="Documents" description="IfcRelAssociatesDocument 기반 문서 참조" sections={properties.documents} emptyMessage={propertiesLoadingSections.includes("documents") ? "문서 참조를 읽는 중입니다." : "연결된 문서 정보가 없습니다."} />
              <PropertySectionList title="Classifications" description="IfcRelAssociatesClassification 기반 분류 정보" sections={properties.classifications} emptyMessage={propertiesLoadingSections.includes("classifications") ? "분류 정보를 읽는 중입니다." : "연결된 분류 정보가 없습니다."} />
              <PropertySectionList title="Metadata" description="설명, 타입, 배치, 표현 메타데이터" sections={properties.metadata} emptyMessage={propertiesLoadingSections.includes("metadata") ? "메타데이터를 읽는 중입니다." : "추가 메타데이터가 없습니다."} />
              <PropertySectionList title="Relations" description="직접 참조하는 IFC 관계" sections={properties.relations} emptyMessage={propertiesLoadingSections.includes("relations") ? "직접 관계를 읽는 중입니다." : "직접 관계 정보가 없습니다."} />
              <PropertySectionList title="Inverse Relations" description="다른 엔티티에서 참조하는 역방향 관계" sections={properties.inverseRelations} emptyMessage={propertiesLoadingSections.includes("inverseRelations") ? "역방향 관계를 읽는 중입니다." : "역방향 관계 정보가 없습니다."} />
            </>
          ) : (
            <PropertySectionList title="Quantities" description="Qto_* 수량 세트" sections={properties.quantitySets} emptyMessage={propertiesLoadingSections.includes("quantitySets") ? "수량 정보를 읽는 중입니다." : "연결된 수량 정보가 없습니다."} />
          )}

          {/* Note */}
          {propertiesError ? (
            <div className="flex items-start gap-2 p-3 border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
              <Info size={14} strokeWidth={2} /><p className="m-0 text-[0.8rem] leading-normal">{propertiesError}</p>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 border border-border bg-bg text-text-secondary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
              <Info size={14} strokeWidth={2} />
              <p className="m-0 text-[0.8rem] leading-normal">{activeTab === "properties" ? "기본 속성, Property Set, Type, Material, Document, Classification, Metadata, Relation 정보를 실제 IFC 데이터에서 읽어옵니다." : "수량 정보는 Qto_* 세트를 기준으로 분리해서 보여줍니다."}</p>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-t-2 border-border bg-slate-50/92 text-text-muted text-xs tracking-wide uppercase dark:border-slate-700 dark:bg-slate-800/92 dark:text-slate-400">
        <span>{selectedEntityIds.length === 0 ? "Inspector idle" : "Inspector ready"}</span>
        <strong className="text-text text-[0.76rem] font-mono dark:text-slate-200">{hiddenEntityIds.size} hidden</strong>
      </div>
    </aside>
  );
}
