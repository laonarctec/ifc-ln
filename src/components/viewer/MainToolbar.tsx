import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { clsx } from 'clsx';
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
import { collectStoreys } from './hierarchy/treeDataBuilder';

/* ---- Shared Tailwind class constants ---- */

const toolbarClass =
  'relative flex items-center justify-start gap-5 px-5 border-b border-border-subtle bg-white/95 overflow-visible z-40 dark:border-slate-700 dark:bg-slate-900/88';

const iconBtnClass =
  'inline-flex items-center justify-center w-10 h-10 p-0 border border-border-subtle rounded-[10px] bg-white/94 text-slate-700 relative cursor-pointer overflow-hidden [&>svg]:shrink-0 [&>span]:sr-only disabled:opacity-45 disabled:cursor-default hover:not-disabled:border-primary/28 hover:not-disabled:bg-blue-100/58 hover:not-disabled:text-primary-text dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:not-disabled:bg-slate-700';

const iconBtnPrimaryClass =
  'border-primary-light bg-primary text-white hover:not-disabled:border-primary-light hover:not-disabled:bg-primary hover:not-disabled:text-white dark:border-primary-light dark:bg-blue-800 dark:text-blue-100 dark:hover:not-disabled:bg-blue-600';

const iconBtnToggleClass =
  'border-transparent bg-transparent dark:border-transparent dark:bg-transparent';

const iconBtnToggleActiveClass =
  'border-primary/22 bg-blue-100/60 text-primary-text dark:border-primary/22 dark:bg-blue-100/60 dark:text-primary-text';

const iconBtnSummaryClass =
  'w-auto gap-2 px-3 text-[0.78rem] font-bold overflow-visible [&>span]:not-sr-only list-none [&::-webkit-details-marker]:hidden';

const separatorClass =
  'w-px h-7 mx-1 bg-border-subtle shrink-0 dark:bg-slate-600';

const groupClass = 'inline-flex items-center gap-1.5';

const menuClass =
  'absolute top-[calc(100%+6px)] left-0 z-50 grid min-w-[200px] p-1 border border-border-subtle rounded-[10px] bg-white/98 backdrop-blur-[12px] shadow-[0_10px_28px_rgba(0,0,0,0.12)] dark:border-slate-600 dark:bg-slate-800';

const menuItemClass =
  'flex items-center gap-2 w-full py-2 px-2.5 border-0 rounded-md bg-transparent text-slate-900 text-[0.78rem] font-medium cursor-pointer text-left hover:not-disabled:bg-primary/8 dark:text-slate-200 dark:hover:not-disabled:bg-slate-700';

const menuShortcutClass =
  'ml-auto text-slate-400 text-[0.68rem] font-mono';

const menuDividerClass =
  'h-0 mx-1.5 my-[3px] border-0 border-t border-slate-200 dark:border-slate-600';

const menuCheckClass =
  'flex items-center gap-2.5 w-full py-2 px-2.5 border-0 rounded-md bg-transparent text-slate-900 text-[0.78rem] font-medium text-left cursor-pointer hover:bg-primary/8 dark:text-slate-200 dark:hover:bg-slate-700';

const menuCheckIconClass =
  'inline-flex items-center justify-center w-4 h-4 border border-slate-400 rounded shrink-0';

const statusChipBase =
  'inline-flex items-center gap-1.5 h-8 px-2.5 border border-border-subtle rounded-full bg-white/92 text-slate-600 text-[0.73rem] font-bold uppercase tracking-[0.06em] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300';

const statusChipVariant: Record<string, string> = {
  ready: 'border-green-200 bg-green-50 text-green-800',
  initializing: 'border-blue-200 bg-blue-50 text-blue-700',
  error: 'border-red-200 bg-red-50 text-red-700',
};

export function MainToolbar() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const leftPanelCollapsed = useViewerStore((state) => state.leftPanelCollapsed);
  const rightPanelCollapsed = useViewerStore((state) => state.rightPanelCollapsed);
  const selectedEntityIds = useViewerStore((state) => state.selectedEntityIds);
  const viewportProjectionMode = useViewerStore((state) => state.viewportProjectionMode);
  const hoverTooltipsEnabled = useViewerStore((state) => state.hoverTooltipsEnabled);
  const edgesVisible = useViewerStore((state) => state.edgesVisible);
  const typeVisibility = useViewerStore((state) => state.typeVisibility);
  const toggleLeftPanel = useViewerStore((state) => state.toggleLeftPanel);
  const toggleRightPanel = useViewerStore((state) => state.toggleRightPanel);
  const toggleViewportProjectionMode = useViewerStore((state) => state.toggleViewportProjectionMode);
  const toggleHoverTooltips = useViewerStore((state) => state.toggleHoverTooltips);
  const toggleEdgesVisible = useViewerStore((state) => state.toggleEdgesVisible);
  const toggleTypeVisibility = useViewerStore((state) => state.toggleTypeVisibility);
  const isolateEntities = useViewerStore((state) => state.isolateEntities);
  const hideEntity = useViewerStore((state) => state.hideEntity);
  const resetHiddenEntities = useViewerStore((state) => state.resetHiddenEntities);
  const clearSelection = useViewerStore((state) => state.clearSelection);
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
  } = useWebIfc();
  const { manifest } = useViewportGeometry();
  const toolbarRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const entityIds = useMemo(
    () => [...new Set(manifest?.chunks.flatMap((chunk) => chunk.entityIds) ?? [])],
    [manifest]
  );
  const hasRenderableGeometry = entityIds.length > 0;

  // Close dropdowns on outside click or menu item click
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const toolbar = toolbarRef.current;
      if (!toolbar) return;
      const openDetails = toolbar.querySelectorAll('details[open]');
      for (const details of openDetails) {
        if (!details.contains(e.target as Node)) {
          details.removeAttribute('open');
        }
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const closeParentDropdown = useCallback((e: React.MouseEvent) => {
    const details = (e.target as HTMLElement).closest('details');
    if (details) details.removeAttribute('open');
  }, []);

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
    <header ref={toolbarRef} className={toolbarClass}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifc,.ifcz"
        className="viewer-hidden-input"
        onChange={(event) => { void handleFileChange(event); }}
      />
      <div className="flex items-center gap-3 shrink-0 min-w-0">
        <span className="inline-flex items-center justify-center min-w-14 h-7 px-2.5 rounded-full bg-blue-100 text-blue-700 text-[0.8125rem] font-bold dark:border dark:border-slate-600 dark:bg-slate-800 dark:text-blue-300">
          ifc-e
        </span>
        <div className="grid min-w-0 gap-0.5">
          <strong className="text-[0.95rem] text-slate-900 leading-[1.15] overflow-hidden text-ellipsis whitespace-nowrap dark:text-slate-100">
            IFC Viewer
          </strong>
          <small className="text-slate-500 text-[0.68rem] leading-[1.1] overflow-hidden text-ellipsis whitespace-nowrap dark:text-slate-400">
            {currentFileName ?? 'No model loaded'}
          </small>
        </div>
      </div>
      <div className="flex items-center flex-wrap justify-center flex-1 gap-3 overflow-visible">
        {/* Panel toggles */}
        <div className={groupClass}>
          <button
            type="button"
            className={iconBtnClass}
            onClick={toggleLeftPanel}
            title="좌측 패널 토글"
          >
            {leftPanelCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            <span>Hierarchy</span>
          </button>
          <button
            type="button"
            className={iconBtnClass}
            onClick={toggleRightPanel}
            title="우측 패널 토글"
          >
            {rightPanelCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
            <span>Properties</span>
          </button>
        </div>

        <span className={separatorClass} />

        {/* Engine & File */}
        <div className={groupClass}>
          <button
            type="button"
            className={iconBtnClass}
            onClick={() => void initEngine()}
            disabled={engineState === 'initializing' || engineState === 'ready'}
            title="엔진 초기화"
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
            className={clsx(iconBtnClass, iconBtnPrimaryClass)}
            onClick={handleOpenFile}
            disabled={loading || engineState !== 'ready'}
            title="IFC 파일 열기"
          >
            <FolderOpen size={16} />
            <span>{loading ? 'Loading...' : 'Open IFC'}</span>
          </button>
          <button
            type="button"
            className={iconBtnClass}
            onClick={() => void resetSession()}
            title="세션 초기화"
          >
            <RefreshCcw size={16} />
            <span>Reset</span>
          </button>
        </div>

        <span className={separatorClass} />

        {/* Visibility & Isolation */}
        <div className={groupClass}>
          <button
            type="button"
            className={iconBtnClass}
            onClick={() => {
              if (selectedEntityIds.length > 0) {
                isolateEntities(selectedEntityIds, entityIds);
              }
            }}
            disabled={!hasRenderableGeometry || selectedEntityIds.length === 0}
            title="Isolate (I)"
          >
            <Layers size={16} />
            <span>Isolate</span>
          </button>
          <button
            type="button"
            className={iconBtnClass}
            onClick={handleHideSelection}
            disabled={!hasRenderableGeometry || selectedEntityIds.length === 0}
            title="Hide Selection (H)"
          >
            <EyeOff size={16} />
            <span>Hide</span>
          </button>
          <button
            type="button"
            className={iconBtnClass}
            onClick={resetHiddenEntities}
            disabled={!hasRenderableGeometry}
            title="Show All (S)"
          >
            <Eye size={16} />
            <span>Show All</span>
          </button>
        </div>

        <span className={separatorClass} />

        {/* Camera & View */}
        <div className={groupClass}>
          <button
            type="button"
            className={iconBtnClass}
            onClick={() => runViewportCommand('fit-selected')}
            disabled={!hasRenderableGeometry || selectedEntityIds.length === 0}
            title="Fit Selected (F)"
          >
            <Focus size={16} />
            <span>Fit Sel</span>
          </button>
          <button
            type="button"
            className={iconBtnClass}
            onClick={() => runViewportCommand('fit-all')}
            disabled={!hasRenderableGeometry}
            title="Fit All (Z)"
          >
            <Maximize2 size={16} />
            <span>Fit All</span>
          </button>
          <button
            type="button"
            className={iconBtnClass}
            onClick={() => runViewportCommand('home')}
            disabled={!hasRenderableGeometry}
            title="Home (0)"
          >
            <Home size={16} />
            <span>Home</span>
          </button>
          <button
            type="button"
            className={clsx(
              iconBtnClass,
              iconBtnToggleClass,
              viewportProjectionMode === 'orthographic' && iconBtnToggleActiveClass,
            )}
            onClick={toggleViewportProjectionMode}
            disabled={!hasRenderableGeometry}
            title={
              viewportProjectionMode === 'perspective'
                ? 'Orthographic 전환'
                : 'Perspective 전환'
            }
          >
            <Box size={16} />
          </button>
          <button
            type="button"
            className={clsx(
              iconBtnClass,
              iconBtnToggleClass,
              hoverTooltipsEnabled && iconBtnToggleActiveClass,
            )}
            onClick={toggleHoverTooltips}
            title={hoverTooltipsEnabled ? 'Hover Tooltips Off' : 'Hover Tooltips On'}
          >
            <Info size={16} />
          </button>
          <button
            type="button"
            className={clsx(
              iconBtnClass,
              iconBtnToggleClass,
              edgesVisible && iconBtnToggleActiveClass,
            )}
            onClick={toggleEdgesVisible}
            disabled={!hasRenderableGeometry}
            title={edgesVisible ? 'Edges Off' : 'Edges On'}
          >
            <Workflow size={16} />
          </button>

          {/* Preset Views */}
          <details className="relative">
            <summary
              className={clsx(iconBtnClass, iconBtnSummaryClass)}
              title="Preset Views"
            >
              <Compass size={16} />
              <span>View</span>
              <ChevronDown size={12} />
            </summary>
            <div className={menuClass} onClick={closeParentDropdown}>
              <button type="button" className={menuItemClass} onClick={() => runViewportCommand('view-iso')} disabled={!hasRenderableGeometry}>
                <span>Isometric</span>
                <span className={menuShortcutClass}>H</span>
              </button>
              <hr className={menuDividerClass} />
              <button type="button" className={menuItemClass} onClick={() => runViewportCommand('view-top')} disabled={!hasRenderableGeometry}>
                <span>Top</span>
                <span className={menuShortcutClass}>7</span>
              </button>
              <button type="button" className={menuItemClass} onClick={() => runViewportCommand('view-bottom')} disabled={!hasRenderableGeometry}>
                <span>Bottom</span>
                <span className={menuShortcutClass}>2</span>
              </button>
              <button type="button" className={menuItemClass} onClick={() => runViewportCommand('view-front')} disabled={!hasRenderableGeometry}>
                <span>Front</span>
                <span className={menuShortcutClass}>1</span>
              </button>
              <button type="button" className={menuItemClass} onClick={() => runViewportCommand('view-back')} disabled={!hasRenderableGeometry}>
                <span>Back</span>
                <span className={menuShortcutClass}>4</span>
              </button>
              <button type="button" className={menuItemClass} onClick={() => runViewportCommand('view-left')} disabled={!hasRenderableGeometry}>
                <span>Left</span>
                <span className={menuShortcutClass}>5</span>
              </button>
              <button type="button" className={menuItemClass} onClick={() => runViewportCommand('view-right')} disabled={!hasRenderableGeometry}>
                <span>Right</span>
                <span className={menuShortcutClass}>3 / 6</span>
              </button>
            </div>
          </details>

          {/* Quick Floorplan */}
          {storeys.length > 0 && (
            <details className="relative">
              <summary
                className={clsx(iconBtnClass, iconBtnSummaryClass)}
                title="Quick Floorplan"
              >
                <Building2 size={16} />
                <ChevronDown size={14} />
              </summary>
              <div className={menuClass} onClick={closeParentDropdown}>
                {storeys.map((storey) => (
                  <button
                    key={storey.expressID}
                    type="button"
                    className={menuItemClass}
                    onClick={() => setActiveStoreyFilter(storey.expressID)}
                  >
                    <Building2 size={14} />
                    <span>{storey.name}</span>
                    {storey.elevation !== null && (
                      <span className={menuShortcutClass}>
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
            <details className="relative">
              <summary
                className={clsx(iconBtnClass, iconBtnSummaryClass)}
                title="Class Visibility"
              >
                <Layers size={16} />
                <ChevronDown size={14} />
              </summary>
              <div className={menuClass}>
                {typeGeometryExists.spaces && (
                  <button type="button" className={menuCheckClass} onClick={() => toggleTypeVisibility('spaces')}>
                    <span className={menuCheckIconClass} style={{ color: '#33d9ff' }}>
                      {typeVisibility.spaces && <Check size={14} />}
                    </span>
                    <span>Show Spaces</span>
                  </button>
                )}
                {typeGeometryExists.openings && (
                  <button type="button" className={menuCheckClass} onClick={() => toggleTypeVisibility('openings')}>
                    <span className={menuCheckIconClass} style={{ color: '#ff6b4a' }}>
                      {typeVisibility.openings && <Check size={14} />}
                    </span>
                    <span>Show Openings</span>
                  </button>
                )}
                {typeGeometryExists.site && (
                  <button type="button" className={menuCheckClass} onClick={() => toggleTypeVisibility('site')}>
                    <span className={menuCheckIconClass} style={{ color: '#66cc4d' }}>
                      {typeVisibility.site && <Check size={14} />}
                    </span>
                    <span>Show Site</span>
                  </button>
                )}
              </div>
            </details>
          )}
        </div>

        <span className={separatorClass} />

        {/* Export & Utilities */}
        <div className={groupClass}>
          <details className="relative">
            <summary
              className={clsx(iconBtnClass, iconBtnSummaryClass)}
              title="Export"
            >
              <Download size={16} />
              <ChevronDown size={14} />
            </summary>
            <div className={menuClass} onClick={closeParentDropdown}>
              <button type="button" className={menuItemClass} onClick={handleScreenshot} disabled={!hasRenderableGeometry}>
                <Camera size={14} />
                <span>Screenshot</span>
              </button>
              <hr className={menuDividerClass} />
              <button type="button" className={menuItemClass} onClick={handleExportJSON} disabled={spatialTree.length === 0}>
                <FileJson size={14} />
                <span>Export JSON</span>
              </button>
            </div>
          </details>
          <button
            type="button"
            className={iconBtnClass}
            onClick={() => setShortcutsOpen(true)}
            title="Shortcuts (?)"
          >
            <Keyboard size={16} />
          </button>
          <ThemeSwitch />
        </div>

        {/* Engine Status */}
        <div className="inline-flex items-center gap-2.5">
          <span className={clsx(statusChipBase, statusChipVariant[engineState])}>
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
