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
      <div className="viewer-property-list">
        <div className="viewer-property-list__header">
          <span>{title}</span>
          <small>{description}</small>
        </div>
        <div className="viewer-property-list__empty">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="viewer-property-sections">
      {sections.map((section) => (
        <div
          key={`${section.title}-${section.expressID ?? "none"}`}
          className="viewer-property-list"
        >
          <div className="viewer-property-list__header">
            <span>{section.title}</span>
            <small>
              {section.ifcType ?? "IFC"} · {section.entries.length}개 항목
            </small>
          </div>
          {section.entries.map((entry) => (
            <div
              key={`${section.title}-${entry.key}`}
              className="viewer-property-list__row"
            >
              <span>{entry.key}</span>
              <strong>{entry.value}</strong>
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
        "relations",
        "inverseRelations",
      ]);
      return;
    }

    void loadPropertySections(["quantitySets"]);
  }, [activeTab, loadPropertySections, selectedEntityId]);

  const propertyCountLabel = useMemo(() => {
    if (propertiesLoading) {
      return "속성 조회 중";
    }

    const sectionCount =
      properties.attributes.length +
      properties.propertySets.length +
      properties.typeProperties.length +
      properties.materials.length +
      properties.relations.length +
      properties.inverseRelations.length;

    return sectionCount > 0 ? `${sectionCount}개 섹션/속성` : "선택 대기 중";
  }, [
    properties.attributes.length,
    properties.inverseRelations.length,
    properties.materials.length,
    properties.propertySets.length,
    properties.relations.length,
    properties.typeProperties.length,
    propertiesLoading,
  ]);

  return (
    <aside className="viewer-panel viewer-panel--right">
      <div className="viewer-panel__header viewer-panel__header--stacked">
        <div className="viewer-panel__title-row">
          <span>Properties</span>
          <small>{selectedEntityId ?? "No entity"}</small>
        </div>
        <div className="viewer-panel__tabs viewer-panel__tabs--properties">
          <button
            type="button"
            className={`viewer-panel__tab ${activeTab === "properties" ? "is-active" : ""}`}
            onClick={() => setActiveTab("properties")}
          >
            <FileJson2 size={14} strokeWidth={2} />
            <span>Properties</span>
          </button>
          <button
            type="button"
            className={`viewer-panel__tab ${activeTab === "quantities" ? "is-active" : ""}`}
            onClick={() => setActiveTab("quantities")}
          >
            <Ruler size={14} strokeWidth={2} />
            <span>Quantities</span>
          </button>
          <button type="button" className="viewer-panel__tab" disabled>
            <Tags size={14} strokeWidth={2} />
            <span>bSDD</span>
          </button>
        </div>
      </div>
      <div className="viewer-panel__body viewer-panel__body--inspector">
        <div className="viewer-panel__scroll">
          <div className="viewer-inspector-card">
            <div className="viewer-inspector-card__header">
              <span className="viewer-inspector-card__icon">
                <Crosshair size={14} strokeWidth={2} />
              </span>
              <div>
                <strong>{selectedEntityId ?? "No selection"}</strong>
                <small>
                  {selectedEntityIds.length > 1
                    ? `${selectedEntityIds.length}개 선택 중 · primary entity`
                    : "현재 선택된 IFC 엔티티"}
                </small>
              </div>
            </div>
            <div className="viewer-panel__actions viewer-panel__actions--stacked">
              <button
                type="button"
                onClick={() => {
                  if (selectedEntityIds.length > 0) {
                    selectedEntityIds.forEach((entityId) =>
                      hideEntity(entityId),
                    );
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
              <button type="button" onClick={resetHiddenEntities}>
                <Info size={14} strokeWidth={2} />
                <span>숨김 초기화</span>
              </button>
            </div>
          </div>
          <div className="viewer-panel__meta-grid">
            <div className="viewer-panel__meta viewer-panel__meta--card">
              <span>현재 선택</span>
              <strong>
                {selectedEntityIds.length > 0
                  ? `${selectedEntityIds.length} selected${selectedEntityId !== null ? ` · #${selectedEntityId}` : ""}`
                  : "없음"}
              </strong>
            </div>
            <div className="viewer-panel__meta viewer-panel__meta--card">
              <span>숨김 개수</span>
              <strong>{hiddenEntityIds.size}</strong>
            </div>
          </div>
          <div className="viewer-property-list">
            <div className="viewer-property-list__header">
              <span>기본 속성</span>
              <small>{propertyCountLabel}</small>
            </div>
            <div className="viewer-property-list__row">
              <span>GlobalId</span>
              <strong>{properties.globalId ?? "-"}</strong>
            </div>
            <div className="viewer-property-list__row">
              <span>IfcType</span>
              <strong>{properties.ifcType ?? "-"}</strong>
            </div>
            <div className="viewer-property-list__row">
              <span>Name</span>
              <strong>{properties.name ?? "-"}</strong>
            </div>
            {activeTab === "properties" ? (
              properties.attributes.map((attribute) => (
                <div key={attribute.key} className="viewer-property-list__row">
                  <span>{attribute.key}</span>
                  <strong>{attribute.value}</strong>
                </div>
              ))
            ) : (
              <div className="viewer-property-list__empty">
                기본 메타 정보는 속성 탭에서 확인할 수 있습니다.
              </div>
            )}
          </div>
          {selectedEntityId !== null && (
            <div className="viewer-property-list">
              <div className="viewer-property-list__header viewer-property-list__header--geometry">
                <span>
                  <Box size={12} strokeWidth={2} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />
                  Geometry
                </span>
                <small>
                  {geometryPrimary
                    ? `${geometryPrimary.triangleCount.toLocaleString()} triangles · ${geometryPrimary.vertexCount.toLocaleString()} vertices`
                    : "지오메트리 로딩 대기 중"}
                </small>
              </div>
              {geometryPrimary ? (
                <>
                  <div className="viewer-property-list__row">
                    <span>Bounding Box</span>
                    <strong>
                      {geometryPrimary.boundingBox.size
                        .map((v) => v.toFixed(2))
                        .join(" × ")}{" "}
                      m
                    </strong>
                  </div>
                  <div className="viewer-property-list__row">
                    <span>Surface Area</span>
                    <strong>{formatMetric(geometryPrimary.surfaceArea, "m²")}</strong>
                  </div>
                  <div className="viewer-property-list__row">
                    <span>Volume</span>
                    <strong>{formatMetric(geometryPrimary.volume, "m³")}</strong>
                  </div>
                  <div className="viewer-property-list__row">
                    <span>Triangles</span>
                    <strong>{geometryPrimary.triangleCount.toLocaleString()}</strong>
                  </div>
                </>
              ) : (
                <div className="viewer-property-list__empty">
                  선택된 엔티티의 메시 데이터가 아직 로드되지 않았습니다.
                </div>
              )}
              {geometryAggregate && geometryEntityCount > 1 && (
                <>
                  <div className="viewer-property-list__header">
                    <span>Multi-Select Summary</span>
                    <small>{geometryEntityCount}개 엔티티 합산</small>
                  </div>
                  <div className="viewer-property-list__row viewer-property-list__row--highlight">
                    <span>Total Area</span>
                    <strong>{formatMetric(geometryAggregate.surfaceArea, "m²")}</strong>
                  </div>
                  <div className="viewer-property-list__row viewer-property-list__row--highlight">
                    <span>Total Volume</span>
                    <strong>{formatMetric(geometryAggregate.volume, "m³")}</strong>
                  </div>
                  <div className="viewer-property-list__row viewer-property-list__row--highlight">
                    <span>Entities</span>
                    <strong>{geometryEntityCount}</strong>
                  </div>
                </>
              )}
            </div>
          )}
          {activeTab === "properties" ? (
            <>
              <PropertySectionList
                title="Property Sets"
                description="IfcPropertySet / 관련 확장 속성"
                sections={properties.propertySets}
                emptyMessage={
                  propertiesLoadingSections.includes("propertySets")
                    ? "Property Set을 읽는 중입니다."
                    : "연결된 Property Set이 없습니다."
                }
              />
              <PropertySectionList
                title="Type Properties"
                description="IfcTypeObject 기반 속성"
                sections={properties.typeProperties}
                emptyMessage={
                  propertiesLoadingSections.includes("typeProperties")
                    ? "Type 속성을 읽는 중입니다."
                    : "연결된 Type 속성이 없습니다."
                }
              />
              <PropertySectionList
                title="Materials"
                description="IfcMaterial / 재질 연관 정보"
                sections={properties.materials}
                emptyMessage={
                  propertiesLoadingSections.includes("materials")
                    ? "재질 정보를 읽는 중입니다."
                    : "연결된 재질 정보가 없습니다."
                }
              />
              <PropertySectionList
                title="Relations"
                description="직접 참조하는 IFC 관계"
                sections={properties.relations}
                emptyMessage={
                  propertiesLoadingSections.includes("relations")
                    ? "직접 관계를 읽는 중입니다."
                    : "직접 관계 정보가 없습니다."
                }
              />
              <PropertySectionList
                title="Inverse Relations"
                description="다른 엔티티에서 참조하는 역방향 관계"
                sections={properties.inverseRelations}
                emptyMessage={
                  propertiesLoadingSections.includes("inverseRelations")
                    ? "역방향 관계를 읽는 중입니다."
                    : "역방향 관계 정보가 없습니다."
                }
              />
            </>
          ) : (
            <PropertySectionList
              title="Quantities"
              description="Qto_* 수량 세트"
              sections={properties.quantitySets}
              emptyMessage={
                propertiesLoadingSections.includes("quantitySets")
                  ? "수량 정보를 읽는 중입니다."
                  : "연결된 수량 정보가 없습니다."
              }
            />
          )}
          {propertiesError ? (
            <div className="viewer-panel__note viewer-panel__note--error">
              <Info size={14} strokeWidth={2} />
              <p>{propertiesError}</p>
            </div>
          ) : (
            <div className="viewer-panel__note">
              <Info size={14} strokeWidth={2} />
              <p>
                {activeTab === "properties"
                  ? "기본 속성, Property Set, Type, Material, Relation 정보를 실제 IFC 데이터에서 읽어옵니다."
                  : "수량 정보는 Qto_* 세트를 기준으로 분리해서 보여줍니다."}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="viewer-panel__footer">
        <span>
          {selectedEntityIds.length === 0
            ? "Inspector idle"
            : "Inspector ready"}
        </span>
        <strong>{hiddenEntityIds.size} hidden</strong>
      </div>
    </aside>
  );
}
