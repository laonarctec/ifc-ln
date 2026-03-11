import { useMemo, useState } from 'react';
import {
  Crosshair,
  EyeOff,
  FileJson2,
  Info,
  Ruler,
  Tags,
} from 'lucide-react';
import { useWebIfc } from '@/hooks/useWebIfc';
import { useViewerStore } from '@/stores';
import type { IfcPropertySection } from '@/types/worker-messages';

type InspectorTab = 'properties' | 'quantities';

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
        <div key={`${section.title}-${section.expressID ?? 'none'}`} className="viewer-property-list">
          <div className="viewer-property-list__header">
            <span>{section.title}</span>
            <small>
              {section.ifcType ?? 'IFC'} · {section.entries.length}개 항목
            </small>
          </div>
          {section.entries.map((entry) => (
            <div key={`${section.title}-${entry.key}`} className="viewer-property-list__row">
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
  const [activeTab, setActiveTab] = useState<InspectorTab>('properties');
  const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
  const hideEntity = useViewerStore((state) => state.hideEntity);
  const hiddenEntityIds = useViewerStore((state) => state.hiddenEntityIds);
  const resetHiddenEntities = useViewerStore((state) => state.resetHiddenEntities);
  const { properties, propertiesLoading, propertiesError } = useWebIfc();
  const propertyCountLabel = useMemo(() => {
    if (propertiesLoading) {
      return '속성 조회 중';
    }

    const sectionCount =
      properties.attributes.length +
      properties.propertySets.length +
      properties.typeProperties.length +
      properties.materials.length;

    return sectionCount > 0 ? `${sectionCount}개 섹션/속성` : '선택 대기 중';
  }, [
    properties.attributes.length,
    properties.materials.length,
    properties.propertySets.length,
    properties.typeProperties.length,
    propertiesLoading,
  ]);

  return (
    <aside className="viewer-panel viewer-panel--right">
      <div className="viewer-panel__header viewer-panel__header--stacked">
        <div className="viewer-panel__title-row">
          <span>Properties</span>
          <small>{selectedEntityId ?? 'No entity'}</small>
        </div>
        <div className="viewer-panel__tabs viewer-panel__tabs--properties">
          <button
            type="button"
            className={`viewer-panel__tab ${activeTab === 'properties' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('properties')}
          >
            <FileJson2 size={14} strokeWidth={2} />
            <span>Properties</span>
          </button>
          <button
            type="button"
            className={`viewer-panel__tab ${activeTab === 'quantities' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('quantities')}
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
                <strong>{selectedEntityId ?? 'No selection'}</strong>
                <small>현재 선택된 IFC 엔티티</small>
              </div>
            </div>
            <div className="viewer-panel__actions viewer-panel__actions--stacked">
              <button
                type="button"
                onClick={() => {
                  if (selectedEntityId !== null) {
                    hideEntity(selectedEntityId);
                  }
                }}
                disabled={selectedEntityId === null}
              >
                <EyeOff size={14} strokeWidth={2} />
                <span>선택 숨기기</span>
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
              <strong>{selectedEntityId ?? '없음'}</strong>
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
              <strong>{properties.globalId ?? '-'}</strong>
            </div>
            <div className="viewer-property-list__row">
              <span>IfcType</span>
              <strong>{properties.ifcType ?? '-'}</strong>
            </div>
            <div className="viewer-property-list__row">
              <span>Name</span>
              <strong>{properties.name ?? '-'}</strong>
            </div>
            {activeTab === 'properties' ? (
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
          {activeTab === 'properties' ? (
            <>
              <PropertySectionList
                title="Property Sets"
                description="IfcPropertySet / 관련 확장 속성"
                sections={properties.propertySets}
                emptyMessage="연결된 Property Set이 없습니다."
              />
              <PropertySectionList
                title="Type Properties"
                description="IfcTypeObject 기반 속성"
                sections={properties.typeProperties}
                emptyMessage="연결된 Type 속성이 없습니다."
              />
              <PropertySectionList
                title="Materials"
                description="IfcMaterial / 재질 연관 정보"
                sections={properties.materials}
                emptyMessage="연결된 재질 정보가 없습니다."
              />
            </>
          ) : (
            <PropertySectionList
              title="Quantities"
              description="Qto_* 수량 세트"
              sections={properties.quantitySets}
              emptyMessage="연결된 수량 정보가 없습니다."
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
                {activeTab === 'properties'
                  ? '기본 속성, Property Set, Type, Material 정보를 실제 IFC 데이터에서 읽어옵니다.'
                  : '수량 정보는 Qto_* 세트를 기준으로 분리해서 보여줍니다.'}
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="viewer-panel__footer">
        <span>{selectedEntityId === null ? 'Inspector idle' : 'Inspector ready'}</span>
        <strong>{hiddenEntityIds.size} hidden</strong>
      </div>
    </aside>
  );
}
