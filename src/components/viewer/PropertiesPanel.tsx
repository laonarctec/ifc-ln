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

export function PropertiesPanel() {
  const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
  const hideEntity = useViewerStore((state) => state.hideEntity);
  const hiddenEntityIds = useViewerStore((state) => state.hiddenEntityIds);
  const resetHiddenEntities = useViewerStore((state) => state.resetHiddenEntities);
  const { properties, propertiesLoading, propertiesError } = useWebIfc();

  return (
    <aside className="viewer-panel viewer-panel--right">
      <div className="viewer-panel__header viewer-panel__header--stacked">
        <div className="viewer-panel__title-row">
          <span>Properties</span>
          <small>{selectedEntityId ?? 'No entity'}</small>
        </div>
        <div className="viewer-panel__tabs viewer-panel__tabs--properties">
          <button type="button" className="viewer-panel__tab is-active">
            <FileJson2 size={14} strokeWidth={2} />
            <span>Properties</span>
          </button>
          <button type="button" className="viewer-panel__tab" disabled>
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
              <small>
                {propertiesLoading
                  ? '속성 조회 중'
                  : properties.attributes.length > 0
                    ? `${properties.attributes.length}개 속성`
                    : '선택 대기 중'}
              </small>
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
            {properties.attributes.map((attribute) => (
              <div key={attribute.key} className="viewer-property-list__row">
                <span>{attribute.key}</span>
                <strong>{attribute.value}</strong>
              </div>
            ))}
          </div>
          {propertiesError ? (
            <div className="viewer-panel__note viewer-panel__note--error">
              <Info size={14} strokeWidth={2} />
              <p>{propertiesError}</p>
            </div>
          ) : (
            <div className="viewer-panel__note">
              <Info size={14} strokeWidth={2} />
              <p>다음 단계에서 실제 PropertySet, Type, 관계 정보 패널로 확장합니다.</p>
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
