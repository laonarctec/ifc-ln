import { useCallback, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Box,
  Building2,
  Camera,
  Check,
  ChevronDown,
  Compass,
  Download,
  Eye,
  EyeOff,
  FileJson,
  Focus,
  FolderOpen,
  Home,
  Info,
  Keyboard,
  Layers,
  Maximize2,
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
import { addToast } from '@/components/ui/Toast';
import { captureViewportScreenshot } from '@/utils/screenshot';
import { exportSpatialTreeJSON } from '@/utils/exportUtils';
import type { IfcSpatialNode } from '@/types/worker-messages';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import { ThemeSwitch } from './ThemeSwitch';

function collectStoreys(nodes: IfcSpatialNode[]): { expressID: number; name: string; elevation: number | null }[] {
  const result: { expressID: number; name: string; elevation: number | null }[] = [];
  for (const node of nodes) {
    if (node.type === 'IFCBUILDINGSTOREY') {
      result.push({
        expressID: node.expressID,
        name: node.name ?? `Storey #${node.expressID}`,
        elevation: node.elevation ?? null,
      });
    }
    result.push(...collectStoreys(node.children));
  }
  return result;
}

export function MainToolbar() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const leftPanelCollapsed = useViewerStore((state) => state.leftPanelCollapsed);
  const rightPanelCollapsed = useViewerStore((state) => state.rightPanelCollapsed);
  const selectedEntityIds = useViewerStore((state) => state.selectedEntityIds);
  const viewportProjectionMode = useViewerStore((state) => state.viewportProjectionMode);
  const hoverTooltipsEnabled = useViewerStore((state) => state.hoverTooltipsEnabled);
  const typeVisibility = useViewerStore((state) => state.typeVisibility);
  const toggleLeftPanel = useViewerStore((state) => state.toggleLeftPanel);
  const toggleRightPanel = useViewerStore((state) => state.toggleRightPanel);
  const toggleViewportProjectionMode = useViewerStore((state) => state.toggleViewportProjectionMode);
  const toggleHoverTooltips = useViewerStore((state) => state.toggleHoverTooltips);
  const toggleTypeVisibility = useViewerStore((state) => state.toggleTypeVisibility);
  const isolateEntities = useViewerStore((state) => state.isolateEntities);
  const hideEntity = useViewerStore((state) => state.hideEntity);
  const resetHiddenEntities = useViewerStore((state) => state.resetHiddenEntities);
  const clearSelection = useViewerStore((state) => state.clearSelection);
  const runViewportCommand = useViewerStore((state) => state.runViewportCommand);
  const setActiveStoreyFilter = useViewerStore((state) => state.setActiveStoreyFilter);
  const isLoading = useViewerStore((state) => state.isLoading);
  const loadingProgress = useViewerStore((state) => state.loadingProgress);
  const progressLabel = useViewerStore((state) => state.progressLabel);
  const {
    loadFile,
    resetSession,
    loading,
    initEngine,
    engineState,
    currentFileName,
    spatialTree,
  } = useWebIfc();
  const { manifest } = useViewportGeometry();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const entityIds = useMemo(
    () => [...new Set(manifest?.chunks.flatMap((chunk) => chunk.entityIds) ?? [])],
    [manifest]
  );
  const hasRenderableGeometry = entityIds.length > 0;

  const storeys = useMemo(() => collectStoreys(spatialTree), [spatialTree]);

  const typeGeometryExists = useMemo(() => {
    const result = { spaces: false, openings: false, site: false };
    for (const node of spatialTree) {
      checkTypeGeometry(node, result);
      if (result.spaces && result.openings && result.site) break;
    }
    return result;
  }, [spatialTree]);

  const handleOpenFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await loadFile(file);
      addToast('success', `${file.name} 로딩 완료`);
    } catch (error) {
      console.error(error);
      addToast('error', `파일 로딩 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      event.target.value = '';
    }
  };

  const handleHideSelection = useCallback(() => {
    const ids = useViewerStore.getState().selectedEntityIds;
    if (ids.length === 0) return;
    for (const id of ids) hideEntity(id);
    clearSelection();
  }, [hideEntity, clearSelection]);

  const handleScreenshot = useCallback(() => {
    const viewport = document.querySelector('.viewer-viewport__canvas');
    if (viewport) {
      const result = captureViewportScreenshot(viewport as HTMLElement);
      if (result) {
        addToast('success', '스크린샷이 저장되었습니다');
      } else {
        addToast('error', '캡처할 뷰포트가 없습니다');
      }
    }
  }, []);

  const handleExportJSON = useCallback(() => {
    if (spatialTree.length === 0) return;
    exportSpatialTreeJSON(spatialTree, `${currentFileName ?? 'model'}-spatial.json`);
    addToast('success', 'JSON 파일이 저장되었습니다');
  }, [spatialTree, currentFileName]);

  return (
    <header className="viewer-toolbar">
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifc,.ifcz"
        className="viewer-hidden-input"
        onChange={(event) => { void handleFileChange(event); }}
      />
      <div className="viewer-toolbar__brand">
        <span className="viewer-toolbar__badge">ifc-e</span>
        <div className="viewer-toolbar__brand-copy">
          <strong>IFC Viewer</strong>
          <small>{currentFileName ?? 'No model loaded'}</small>
        </div>
      </div>
      <div className="viewer-toolbar__actions">
        {/* Panel toggles */}
        <div className="viewer-toolbar__group">
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={toggleLeftPanel}
            data-tooltip="좌측 패널 토글"
          >
            {leftPanelCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            <span>Hierarchy</span>
          </button>
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={toggleRightPanel}
            data-tooltip="우측 패널 토글"
          >
            {rightPanelCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
            <span>Properties</span>
          </button>
        </div>

        <span className="viewer-toolbar__separator" />

        {/* Engine & File */}
        <div className="viewer-toolbar__group">
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={() => void initEngine()}
            disabled={engineState === 'initializing' || engineState === 'ready'}
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
            data-tooltip="IFC 파일 열기"
          >
            <FolderOpen size={16} />
            <span>{loading ? 'Loading...' : 'Open IFC'}</span>
          </button>
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={() => void resetSession()}
            data-tooltip="세션 초기화"
          >
            <RefreshCcw size={16} />
            <span>Reset</span>
          </button>
        </div>

        <span className="viewer-toolbar__separator" />

        {/* Visibility & Isolation */}
        <div className="viewer-toolbar__group">
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={() => {
              if (selectedEntityIds.length > 0) {
                isolateEntities(selectedEntityIds, entityIds);
              }
            }}
            disabled={!hasRenderableGeometry || selectedEntityIds.length === 0}
            data-tooltip="Isolate (I)"
          >
            <Layers size={16} />
            <span>Isolate</span>
          </button>
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={handleHideSelection}
            disabled={!hasRenderableGeometry || selectedEntityIds.length === 0}
            data-tooltip="Hide Selection (H)"
          >
            <EyeOff size={16} />
            <span>Hide</span>
          </button>
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={resetHiddenEntities}
            disabled={!hasRenderableGeometry}
            data-tooltip="Show All (S)"
          >
            <Eye size={16} />
            <span>Show All</span>
          </button>
        </div>

        <span className="viewer-toolbar__separator" />

        {/* Camera & View */}
        <div className="viewer-toolbar__group">
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={() => runViewportCommand('fit-selected')}
            disabled={!hasRenderableGeometry || selectedEntityIds.length === 0}
            data-tooltip="Fit Selected (F)"
          >
            <Focus size={16} />
            <span>Fit Sel</span>
          </button>
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={() => runViewportCommand('fit-all')}
            disabled={!hasRenderableGeometry}
            data-tooltip="Fit All (Z)"
          >
            <Maximize2 size={16} />
            <span>Fit All</span>
          </button>
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={() => runViewportCommand('home')}
            disabled={!hasRenderableGeometry}
            data-tooltip="Home (0)"
          >
            <Home size={16} />
            <span>Home</span>
          </button>
          <button
            type="button"
            className={`viewer-toolbar__icon-button viewer-toolbar__icon-button--toggle${
              viewportProjectionMode === 'orthographic' ? ' is-active' : ''
            }`}
            onClick={toggleViewportProjectionMode}
            disabled={!hasRenderableGeometry}
            data-tooltip={
              viewportProjectionMode === 'perspective'
                ? 'Orthographic 전환'
                : 'Perspective 전환'
            }
          >
            <Box size={16} />
            <span>{viewportProjectionMode === 'perspective' ? 'Persp' : 'Ortho'}</span>
          </button>
          <button
            type="button"
            className={`viewer-toolbar__icon-button viewer-toolbar__icon-button--toggle${
              hoverTooltipsEnabled ? ' is-active' : ''
            }`}
            onClick={toggleHoverTooltips}
            data-tooltip={hoverTooltipsEnabled ? 'Hover Tooltips Off' : 'Hover Tooltips On'}
          >
            <Info size={16} />
          </button>

          {/* Preset Views */}
          <details className="viewer-toolbar__dropdown">
            <summary
              className="viewer-toolbar__icon-button viewer-toolbar__icon-button--summary"
              data-tooltip="Preset Views"
            >
              <Compass size={16} />
              <span>View</span>
              <ChevronDown size={14} />
            </summary>
            <div className="viewer-toolbar__menu">
              <button type="button" onClick={() => runViewportCommand('view-iso')} disabled={!hasRenderableGeometry}>
                <span>Isometric</span>
                <span className="viewer-toolbar__menu-shortcut">H</span>
              </button>
              <hr className="viewer-toolbar__menu-divider" />
              <button type="button" onClick={() => runViewportCommand('view-top')} disabled={!hasRenderableGeometry}>
                <span>Top</span>
                <span className="viewer-toolbar__menu-shortcut">7</span>
              </button>
              <button type="button" onClick={() => runViewportCommand('view-bottom')} disabled={!hasRenderableGeometry}>
                <span>Bottom</span>
                <span className="viewer-toolbar__menu-shortcut">2</span>
              </button>
              <button type="button" onClick={() => runViewportCommand('view-front')} disabled={!hasRenderableGeometry}>
                <span>Front</span>
                <span className="viewer-toolbar__menu-shortcut">1</span>
              </button>
              <button type="button" onClick={() => runViewportCommand('view-back')} disabled={!hasRenderableGeometry}>
                <span>Back</span>
                <span className="viewer-toolbar__menu-shortcut">4</span>
              </button>
              <button type="button" onClick={() => runViewportCommand('view-left')} disabled={!hasRenderableGeometry}>
                <span>Left</span>
                <span className="viewer-toolbar__menu-shortcut">5</span>
              </button>
              <button type="button" onClick={() => runViewportCommand('view-right')} disabled={!hasRenderableGeometry}>
                <span>Right</span>
                <span className="viewer-toolbar__menu-shortcut">3 / 6</span>
              </button>
            </div>
          </details>

          {/* Quick Floorplan */}
          {storeys.length > 0 && (
            <details className="viewer-toolbar__dropdown">
              <summary
                className="viewer-toolbar__icon-button viewer-toolbar__icon-button--summary"
                data-tooltip="Quick Floorplan"
              >
                <Building2 size={16} />
                <ChevronDown size={14} />
              </summary>
              <div className="viewer-toolbar__menu">
                {storeys.map((storey) => (
                  <button
                    key={storey.expressID}
                    type="button"
                    onClick={() => setActiveStoreyFilter(storey.expressID)}
                  >
                    <Building2 size={14} />
                    <span>{storey.name}</span>
                    {storey.elevation !== null && (
                      <span className="viewer-toolbar__menu-shortcut">
                        {storey.elevation >= 0 ? '+' : ''}{storey.elevation.toFixed(1)}m
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </details>
          )}

          {/* Class Visibility */}
          {(typeGeometryExists.spaces || typeGeometryExists.openings || typeGeometryExists.site) && (
            <details className="viewer-toolbar__dropdown">
              <summary
                className="viewer-toolbar__icon-button viewer-toolbar__icon-button--summary"
                data-tooltip="Class Visibility"
              >
                <Layers size={16} />
                <ChevronDown size={14} />
              </summary>
              <div className="viewer-toolbar__menu">
                {typeGeometryExists.spaces && (
                  <button type="button" className="viewer-toolbar__menu-check" onClick={() => toggleTypeVisibility('spaces')}>
                    <span className="viewer-toolbar__menu-check-icon" style={{ color: '#33d9ff' }}>
                      {typeVisibility.spaces && <Check size={14} />}
                    </span>
                    <span>Show Spaces</span>
                  </button>
                )}
                {typeGeometryExists.openings && (
                  <button type="button" className="viewer-toolbar__menu-check" onClick={() => toggleTypeVisibility('openings')}>
                    <span className="viewer-toolbar__menu-check-icon" style={{ color: '#ff6b4a' }}>
                      {typeVisibility.openings && <Check size={14} />}
                    </span>
                    <span>Show Openings</span>
                  </button>
                )}
                {typeGeometryExists.site && (
                  <button type="button" className="viewer-toolbar__menu-check" onClick={() => toggleTypeVisibility('site')}>
                    <span className="viewer-toolbar__menu-check-icon" style={{ color: '#66cc4d' }}>
                      {typeVisibility.site && <Check size={14} />}
                    </span>
                    <span>Show Site</span>
                  </button>
                )}
              </div>
            </details>
          )}
        </div>

        <span className="viewer-toolbar__separator" />

        {/* Export & Utilities */}
        <div className="viewer-toolbar__group">
          <details className="viewer-toolbar__dropdown">
            <summary
              className="viewer-toolbar__icon-button viewer-toolbar__icon-button--summary"
              data-tooltip="Export"
            >
              <Download size={16} />
              <ChevronDown size={14} />
            </summary>
            <div className="viewer-toolbar__menu">
              <button type="button" onClick={handleScreenshot} disabled={!hasRenderableGeometry}>
                <Camera size={14} />
                <span>Screenshot</span>
              </button>
              <hr className="viewer-toolbar__menu-divider" />
              <button type="button" onClick={handleExportJSON} disabled={spatialTree.length === 0}>
                <FileJson size={14} />
                <span>Export JSON</span>
              </button>
            </div>
          </details>
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={() => setShortcutsOpen(true)}
            data-tooltip="Shortcuts (?)"
          >
            <Keyboard size={16} />
          </button>
          <ThemeSwitch />
        </div>

        {/* Loading Progress */}
        {isLoading && (
          <>
            <span className="viewer-toolbar__separator" />
            <div className="viewer-toolbar__progress">
              <span className="viewer-toolbar__progress-label">{progressLabel}</span>
              <div className="viewer-toolbar__progress-bar">
                <div
                  className="viewer-toolbar__progress-fill"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <span className="viewer-toolbar__progress-pct">{Math.round(loadingProgress)}%</span>
            </div>
          </>
        )}

        {/* Engine Status */}
        <div className="viewer-toolbar__group viewer-toolbar__group--status">
          <span className={`viewer-toolbar__status-chip viewer-toolbar__status-chip--${engineState}`}>
            <ScanSearch size={14} />
            {engineState}
          </span>
        </div>
      </div>
      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </header>
  );
}

function checkTypeGeometry(
  node: IfcSpatialNode,
  result: { spaces: boolean; openings: boolean; site: boolean }
) {
  const t = node.type?.toUpperCase();
  if (t === 'IFCSPACE') result.spaces = true;
  if (t === 'IFCSITE') result.site = true;

  node.elements?.forEach((el) => {
    const et = el.ifcType?.toUpperCase();
    if (et === 'IFCSPACE') result.spaces = true;
    if (et === 'IFCOPENINGELEMENT') result.openings = true;
    if (et === 'IFCSITE') result.site = true;
  });

  for (const child of node.children) {
    if (result.spaces && result.openings && result.site) return;
    checkTypeGeometry(child, result);
  }
}
