import { clsx } from 'clsx';
import { Activity, AlertTriangle, Bug, EyeOff, FileBox, Layers, MousePointer2, X } from 'lucide-react';
import { useState } from 'react';
import { useViewerStore } from '@/stores';
import { useViewportGeometry } from '@/services/viewportGeometryStore';
import { useWebIfc } from '@/hooks/useWebIfc';

export function StatusBar() {
  const [debugOpen, setDebugOpen] = useState(false);
  const currentFileName = useViewerStore((state) => state.currentFileName);
  const currentModelSchema = useViewerStore((state) => state.currentModelSchema);
  const engineState = useViewerStore((state) => state.engineState);
  const geometryReady = useViewerStore((state) => state.geometryReady);
  const loading = useViewerStore((state) => state.isLoading);
  const progress = useViewerStore((state) => state.progressLabel);
  const error = useViewerStore((state) => state.viewerError);
  const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
  const selectedEntityIds = useViewerStore((state) => state.selectedEntityIds);
  const hiddenEntityIds = useViewerStore((state) => state.hiddenEntityIds);
  const frameRate = useViewerStore((state) => state.frameRate);

  const {
    engineMessage,
    currentModelId,
    currentModelMaxExpressId,
    geometryResult,
  } = useWebIfc();

  const { manifest, residentChunkIds, visibleChunkIds } = useViewportGeometry();

  const frameText =
    currentFileName === null
      ? '-'
      : !geometryReady
        ? 'Prep'
        : frameRate === null
          ? '...'
          : `${frameRate}`;

  const engineDot = engineState === 'ready'
    ? 'bg-emerald-500'
    : engineState === 'initializing'
      ? 'bg-blue-400 animate-pulse'
      : engineState === 'error'
        ? 'bg-red-500'
        : 'bg-slate-400';

  return (
    <footer className="status-bar">
      {/* Engine dot */}
      <div className="inline-flex items-center gap-1.5 px-2 h-6 rounded-sm cursor-default" title={`Engine: ${engineState}`}>
        <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', engineDot)} />
        <span className="font-medium">{engineState === 'ready' ? 'Ready' : engineState === 'initializing' ? 'Init' : engineState === 'error' ? 'Error' : 'Idle'}</span>
      </div>

      <span className="w-px h-3 bg-slate-200 mx-1 dark:bg-slate-700" />

      {/* Model */}
      <div className="inline-flex items-center gap-1 px-2 h-6 rounded-sm min-w-0 cursor-default" title={currentFileName ?? 'No file'}>
        <FileBox size={11} strokeWidth={2} className="shrink-0 text-text-subtle" />
        <span className="truncate max-w-[120px]">{currentFileName ?? 'No file'}</span>
        {currentModelSchema && <span className="text-text-subtle">· {currentModelSchema}</span>}
      </div>

      <span className="w-px h-3 bg-slate-200 mx-1 dark:bg-slate-700" />

      {/* Selection */}
      <div className={clsx('inline-flex items-center gap-1 px-2 h-6 rounded-sm cursor-default', selectedEntityIds.length > 0 && 'text-primary-text font-medium dark:text-blue-400')} title={selectedEntityId !== null ? `Primary: #${selectedEntityId}` : 'No selection'}>
        <MousePointer2 size={11} strokeWidth={2} className="shrink-0" />
        <span>{selectedEntityIds.length > 0 ? selectedEntityIds.length : '-'}</span>
      </div>

      {/* Hidden */}
      {hiddenEntityIds.size > 0 && (
        <>
          <span className="w-px h-3 bg-slate-200 mx-1 dark:bg-slate-700" />
          <div className="inline-flex items-center gap-1 px-2 h-6 rounded-sm text-amber-600 font-medium cursor-default dark:text-amber-400" title={`${hiddenEntityIds.size} entities hidden`}>
            <EyeOff size={11} strokeWidth={2} className="shrink-0" />
            <span>{hiddenEntityIds.size}</span>
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <>
          <span className="w-px h-3 bg-slate-200 mx-1 dark:bg-slate-700" />
          <div className="inline-flex items-center gap-1 px-2 h-6 rounded-sm text-error font-bold cursor-default" title={error}>
            <AlertTriangle size={11} strokeWidth={2} className="shrink-0" />
            <span className="truncate max-w-[140px]">{error}</span>
          </div>
        </>
      )}

      {/* Loading */}
      {loading && (
        <>
          <span className="w-px h-3 bg-slate-200 mx-1 dark:bg-slate-700" />
          <div className="inline-flex items-center gap-1 px-2 h-6 rounded-sm text-blue-600 dark:text-blue-400 cursor-default">
            <Layers size={11} strokeWidth={2} className="shrink-0 animate-pulse" />
            <span className="truncate max-w-[100px] text-[0.62rem]">{progress}</span>
          </div>
        </>
      )}

      {/* Left spacer */}
      <div className="flex-1" />

      {/* Debug toggle (center) */}
      <button
        type="button"
        className={clsx(
          'inline-flex items-center gap-1 px-2 h-6 rounded-sm border-0 bg-transparent cursor-pointer text-[0.68rem] hover:bg-slate-100 dark:hover:bg-slate-800',
          debugOpen ? 'text-primary-text font-bold dark:text-blue-400' : 'text-text-subtle',
        )}
        onClick={() => setDebugOpen((v) => !v)}
        title="Debug panel"
      >
        <Bug size={12} strokeWidth={2} />
        <span>Debug</span>
      </button>

      {/* Right spacer */}
      <div className="flex-1" />

      <span className="w-px h-3 bg-slate-200 mx-1 dark:bg-slate-700" />

      {/* FPS */}
      <div className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 h-6 rounded-sm font-mono text-[0.7rem] font-bold cursor-default',
        frameRate !== null && frameRate < 30
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-text dark:text-slate-300',
      )} title={`Frame rate: ${frameText} FPS`}>
        <Activity size={12} strokeWidth={2.5} className="shrink-0" />
        <span>{frameText}</span>
        {frameRate !== null && <span className="text-text-subtle font-normal text-[0.58rem]">FPS</span>}
      </div>

      {/* Debug popup */}
      {debugOpen && (
        <div className="debug-popup">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.72rem] font-bold text-text dark:text-slate-200">Debug Info</span>
            <button type="button" className="inline-flex items-center justify-center w-5 h-5 p-0 border-0 rounded bg-transparent text-text-subtle cursor-pointer hover:bg-slate-100 hover:text-text dark:hover:bg-slate-800" onClick={() => setDebugOpen(false)}>
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
            <div className="meta-card">
              <span className="meta-label">Engine</span>
              <span className="meta-value">{engineState}</span>
              <span className="meta-sub">{engineMessage}</span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Loading</span>
              <span className="meta-value">{loading ? 'Active' : 'Idle'}</span>
              <span className="meta-sub">{progress || '-'}</span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Geometry</span>
              <span className="meta-value">{geometryResult.ready ? `${geometryResult.meshCount} meshes` : 'Not ready'}</span>
              <span className="meta-sub">{geometryResult.ready ? `${geometryResult.vertexCount.toLocaleString()} verts · ${geometryResult.indexCount.toLocaleString()} idx` : '-'}</span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Selection</span>
              <span className="meta-value">{selectedEntityIds.length > 0 ? `${selectedEntityIds.length} selected` : 'None'}</span>
              <span className="meta-sub">{selectedEntityId !== null ? `Primary #${selectedEntityId}` : '-'}</span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Model</span>
              <span className="meta-value">{currentFileName ?? '-'}</span>
              <span className="meta-sub">ID {currentModelId ?? '-'} · Schema {currentModelSchema ?? '-'} · Max {currentModelMaxExpressId ?? '-'}</span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Chunks</span>
              <span className="meta-value">{residentChunkIds.length} / {manifest?.chunkCount ?? 0}</span>
              <span className="meta-sub">{visibleChunkIds.length} visible targets</span>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
