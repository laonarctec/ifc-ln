import { useMemo, useRef, type ChangeEvent } from 'react';
import {
  ChevronDown,
  Compass,
  Focus,
  FolderOpen,
  Home,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RefreshCcw,
  ScanSearch,
  Workflow,
} from 'lucide-react';
import { useWebIfc } from '@/hooks/useWebIfc';
import { useViewportGeometry } from '@/services/viewportGeometryStore';
import { useViewerStore } from '@/stores';
import type { IfcSpatialNode } from '@/types/worker-messages';

function getNodeName(node: IfcSpatialNode) {
  const withNames = node as IfcSpatialNode & {
    name?: string;
    Name?: string | { value?: string };
    longName?: string;
    LongName?: string | { value?: string };
  };

  const candidates = [withNames.name, withNames.longName, withNames.Name, withNames.LongName];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'object' && value !== null && 'value' in value) {
      const namedValue = value.value;
      if (typeof namedValue === 'string' && namedValue.trim().length > 0) {
        return namedValue.trim();
      }
    }
  }

  return null;
}

function collectStoreyOptions(nodes: IfcSpatialNode[], result: Array<{ id: number; label: string }> = []) {
  for (const node of nodes) {
    if (node.type === 'IFCBUILDINGSTOREY') {
      result.push({
        id: node.expressID,
        label: getNodeName(node) ?? `Storey #${node.expressID}`,
      });
    }
    collectStoreyOptions(node.children, result);
  }

  return result;
}

export function MainToolbar() {
  const leftPanelCollapsed = useViewerStore((state) => state.leftPanelCollapsed);
  const rightPanelCollapsed = useViewerStore((state) => state.rightPanelCollapsed);
  const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
  const toggleLeftPanel = useViewerStore((state) => state.toggleLeftPanel);
  const toggleRightPanel = useViewerStore((state) => state.toggleRightPanel);
  const isolateEntity = useViewerStore((state) => state.isolateEntity);
  const resetHiddenEntities = useViewerStore((state) => state.resetHiddenEntities);
  const runViewportCommand = useViewerStore((state) => state.runViewportCommand);
  const setActiveStoreyFilter = useViewerStore((state) => state.setActiveStoreyFilter);
  const {
    loadFile,
    resetSession,
    loading,
    initEngine,
    engineState,
    currentFileName,
    spatialTree,
    activeStoreyFilter,
  } = useWebIfc();
  const { meshes } = useViewportGeometry();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const entityIds = useMemo(() => [...new Set(meshes.map((mesh) => mesh.expressId))], [meshes]);
  const storeyOptions = useMemo(() => collectStoreyOptions(spatialTree), [spatialTree]);
  const hasRenderableGeometry = entityIds.length > 0;

  const handleOpenFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      await loadFile(file);
    } catch (error) {
      console.error(error);
    } finally {
      event.target.value = '';
    }
  };

  return (
    <header className="viewer-toolbar">
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifc,.ifcz"
        className="viewer-hidden-input"
        onChange={(event) => {
          void handleFileChange(event);
        }}
      />
      <div className="viewer-toolbar__brand">
        <span className="viewer-toolbar__badge">ifc-e</span>
        <div className="viewer-toolbar__brand-copy">
          <strong>IFC Viewer</strong>
          <small>{currentFileName ?? 'No model loaded'}</small>
        </div>
      </div>
      <div className="viewer-toolbar__actions">
        <div className="viewer-toolbar__group">
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={toggleLeftPanel}
            title="좌측 패널 토글"
            aria-label="좌측 패널 토글"
            data-tooltip="좌측 패널 토글"
          >
            {leftPanelCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            <span>Hierarchy</span>
          </button>
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={toggleRightPanel}
            title="우측 패널 토글"
            aria-label="우측 패널 토글"
            data-tooltip="우측 패널 토글"
          >
            {rightPanelCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
            <span>Properties</span>
          </button>
        </div>
        <div className="viewer-toolbar__group">
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={() => void initEngine()}
            disabled={engineState === 'initializing' || engineState === 'ready'}
            title="엔진 초기화"
            aria-label="엔진 초기화"
            data-tooltip="엔진 초기화"
          >
            <Workflow size={16} />
            <span>
              {engineState === 'ready'
                ? 'Engine Ready'
                : engineState === 'initializing'
                  ? 'Initializing'
                  : 'Init Engine'}
            </span>
          </button>
          <button
            type="button"
            className="viewer-toolbar__icon-button viewer-toolbar__icon-button--primary"
            onClick={handleOpenFile}
            disabled={loading || engineState !== 'ready'}
            title="IFC 파일 열기"
            aria-label="IFC 파일 열기"
            data-tooltip="IFC 파일 열기"
          >
            <FolderOpen size={16} />
            <span>{loading ? 'Loading...' : 'Open IFC'}</span>
          </button>
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={() => void resetSession()}
            title="세션 초기화"
            aria-label="세션 초기화"
            data-tooltip="세션 초기화"
          >
            <RefreshCcw size={16} />
            <span>Reset</span>
          </button>
        </div>
        <div className="viewer-toolbar__group">
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={() => runViewportCommand('fit-selected')}
            disabled={!hasRenderableGeometry || selectedEntityId === null}
            title="선택 객체에 맞춰 보기"
            aria-label="선택 객체에 맞춰 보기"
            data-tooltip="선택 객체에 맞춰 보기"
          >
            <Focus size={16} />
            <span>Fit Selected</span>
          </button>
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={() => runViewportCommand('home')}
            disabled={!hasRenderableGeometry}
            title="전체 모델 보기"
            aria-label="전체 모델 보기"
            data-tooltip="전체 모델 보기"
          >
            <Home size={16} />
            <span>Home</span>
          </button>
          <details className="viewer-toolbar__dropdown">
            <summary
              className="viewer-toolbar__icon-button viewer-toolbar__icon-button--summary"
              title="카메라 보기"
              aria-label="카메라 보기"
              data-tooltip="카메라 보기"
            >
              <Compass size={16} />
              <span>View</span>
              <ChevronDown size={14} />
            </summary>
            <div className="viewer-toolbar__menu">
              <button type="button" onClick={() => runViewportCommand('view-front')} disabled={!hasRenderableGeometry}>
                <span>Front</span>
              </button>
              <button type="button" onClick={() => runViewportCommand('view-right')} disabled={!hasRenderableGeometry}>
                <span>Right</span>
              </button>
              <button type="button" onClick={() => runViewportCommand('view-top')} disabled={!hasRenderableGeometry}>
                <span>Top</span>
              </button>
              <button type="button" onClick={() => runViewportCommand('view-iso')} disabled={!hasRenderableGeometry}>
                <span>Iso</span>
              </button>
            </div>
          </details>
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={() => {
              if (selectedEntityId !== null) {
                isolateEntity(selectedEntityId, entityIds);
              }
            }}
            disabled={!hasRenderableGeometry || selectedEntityId === null}
            title="선택 객체만 보기"
            aria-label="선택 객체만 보기"
            data-tooltip="선택 객체만 보기"
          >
            <Layers size={16} />
            <span>Isolate</span>
          </button>
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={resetHiddenEntities}
            disabled={!hasRenderableGeometry}
            title="전체 다시 보기"
            aria-label="전체 다시 보기"
            data-tooltip="전체 다시 보기"
          >
            <RefreshCcw size={16} />
            <span>Show All</span>
          </button>
        </div>
        <div className="viewer-toolbar__group viewer-toolbar__group--filters">
          <label className="viewer-toolbar__filter">
            <span>Storey</span>
            <select
              value={activeStoreyFilter ?? ''}
              onChange={(event) =>
                setActiveStoreyFilter(event.target.value ? Number(event.target.value) : null)
              }
              disabled={storeyOptions.length === 0}
            >
              <option value="">All storeys</option>
              {storeyOptions.map((storey) => (
                <option key={storey.id} value={storey.id}>
                  {storey.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="viewer-toolbar__group viewer-toolbar__group--status">
          <span className={`viewer-toolbar__status-chip viewer-toolbar__status-chip--${engineState}`}>
            <ScanSearch size={14} />
            {engineState}
          </span>
        </div>
      </div>
    </header>
  );
}
