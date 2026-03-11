import { useRef, type ChangeEvent } from 'react';
import {
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RefreshCcw,
  ScanSearch,
  Workflow,
} from 'lucide-react';
import { useWebIfc } from '@/hooks/useWebIfc';
import { useViewerStore } from '@/stores';

export function MainToolbar() {
  const leftPanelCollapsed = useViewerStore((state) => state.leftPanelCollapsed);
  const rightPanelCollapsed = useViewerStore((state) => state.rightPanelCollapsed);
  const toggleLeftPanel = useViewerStore((state) => state.toggleLeftPanel);
  const toggleRightPanel = useViewerStore((state) => state.toggleRightPanel);
  const { loadFile, resetSession, loading, initEngine, engineState, currentFileName } = useWebIfc();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          >
            {leftPanelCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            <span>Hierarchy</span>
          </button>
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={toggleRightPanel}
            title="우측 패널 토글"
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
          >
            <FolderOpen size={16} />
            <span>{loading ? 'Loading...' : 'Open IFC'}</span>
          </button>
          <button
            type="button"
            className="viewer-toolbar__icon-button"
            onClick={() => void resetSession()}
            title="세션 초기화"
          >
            <RefreshCcw size={16} />
            <span>Reset</span>
          </button>
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
