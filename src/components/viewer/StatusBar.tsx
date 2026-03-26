import { clsx } from 'clsx';
import { Activity, AlertTriangle, Bug, EyeOff, FileBox, Layers, MousePointer2, Ruler, X } from 'lucide-react';
import { useState } from 'react';
import { useViewerStore } from '@/stores';
import { useViewportGeometry } from '@/services/viewportGeometryStore';
import { useWebIfc } from '@/hooks/useWebIfc';
import { formatMetric } from '@/utils/geometryMetrics';

function StatusDivider() {
  return <span className="w-px h-3 bg-slate-200 mx-1 dark:bg-slate-700" />;
}

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
  const hiddenEntityKeys = useViewerStore((state) => state.hiddenEntityKeys);
  const frameRate = useViewerStore((state) => state.frameRate);
  const interactionMode = useViewerStore((state) => state.interactionMode);
  const measurement = useViewerStore((state) => state.measurement);

  const {
    engineMessage,
    currentModelId,
    currentModelMaxExpressId,
    geometryResult,
    loadedModels,
  } = useWebIfc();

  const { combinedManifest, modelsById } = useViewportGeometry();

  const hiddenEntityCount =
    currentModelId === null
      ? hiddenEntityKeys.size
      : [...hiddenEntityKeys].filter((key) =>
          key.startsWith(`${currentModelId}:`),
        ).length;
  const residentChunkCount = Object.values(modelsById).reduce(
    (sum, model) => sum + model.residentChunkIds.length,
    0,
  );
  const visibleChunkCount = Object.values(modelsById).reduce(
    (sum, model) => sum + model.visibleChunkIds.length,
    0,
  );

  const frameText =
    currentFileName === null
      ? '-'
      : !geometryReady
        ? 'Prep'
        : frameRate === null
          ? '...'
          : `${frameRate}`;

  const engineLabel =
    engineState === 'ready'
      ? 'Ready'
      : engineState === 'initializing'
        ? 'Init'
        : engineState === 'error'
          ? 'Error'
          : 'Idle';

  const engineDot = engineState === 'ready'
    ? 'bg-emerald-500'
    : engineState === 'initializing'
      ? 'bg-blue-400 animate-pulse'
      : engineState === 'error'
        ? 'bg-red-500'
        : 'bg-slate-400';

  return (
    <footer className="status-bar">
      <div className="flex min-w-0 flex-1 items-center gap-px overflow-hidden">
        <div className={clsx('inline-flex items-center gap-1 px-2 h-6 rounded-sm cursor-default', selectedEntityIds.length > 0 && 'text-primary-text font-medium dark:text-blue-400')} title={selectedEntityId !== null ? `Primary: #${selectedEntityId}` : 'No selection'}>
          <MousePointer2 size={11} strokeWidth={2} className="shrink-0" />
          <span>{selectedEntityIds.length > 0 ? selectedEntityIds.length : '-'}</span>
        </div>

        {(interactionMode === 'measure-distance' || measurement.distance !== null) && (
          <>
            <StatusDivider />
            <div className="inline-flex items-center gap-1 px-2 h-6 rounded-sm text-blue-700 font-medium cursor-default dark:text-blue-300" title="Measurement">
              <Ruler size={11} strokeWidth={2} className="shrink-0" />
              <span>{measurement.distance !== null ? formatMetric(measurement.distance, "m", 3) : 'placing'}</span>
            </div>
          </>
        )}

        {hiddenEntityCount > 0 && (
          <>
            <StatusDivider />
            <div className="inline-flex items-center gap-1 px-2 h-6 rounded-sm text-amber-600 font-medium cursor-default dark:text-amber-400" title={`${hiddenEntityCount} entities hidden`}>
              <EyeOff size={11} strokeWidth={2} className="shrink-0" />
              <span>{hiddenEntityCount}</span>
            </div>
          </>
        )}

        {error && (
          <>
            <StatusDivider />
            <div className="inline-flex items-center gap-1 px-2 h-6 rounded-sm text-error font-bold cursor-default" title={error}>
              <AlertTriangle size={11} strokeWidth={2} className="shrink-0" />
              <span className="truncate max-w-[140px]">{error}</span>
            </div>
          </>
        )}

        {loading && (
          <>
            <StatusDivider />
            <div className="inline-flex items-center gap-1 px-2 h-6 rounded-sm text-blue-600 dark:text-blue-400 cursor-default">
              <Layers size={11} strokeWidth={2} className="shrink-0 animate-pulse" />
              <span className="truncate max-w-[100px] text-[0.62rem]">{progress}</span>
            </div>
          </>
        )}
      </div>

      <div className="flex min-w-0 items-center justify-center px-2">
        <div className="inline-flex items-center gap-1 px-2 h-6 rounded-sm min-w-0 max-w-[280px] cursor-default" title={currentFileName ?? 'No file'}>
          <FileBox size={11} strokeWidth={2} className="shrink-0 text-text-subtle" />
          <span className="truncate">{currentFileName ?? 'No file'}</span>
          {currentModelSchema && <span className="shrink-0 text-text-subtle">· {currentModelSchema}</span>}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-px">
        <div className="relative inline-flex items-center">
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
                  <span className="meta-sub">ID {currentModelId ?? '-'} · Schema {currentModelSchema ?? '-'} · Max {currentModelMaxExpressId ?? '-'} · {loadedModels.length} models</span>
                </div>
                <div className="meta-card">
                  <span className="meta-label">Chunks</span>
                  <span className="meta-value">{residentChunkCount} / {combinedManifest?.chunkCount ?? 0}</span>
                  <span className="meta-sub">{visibleChunkCount} visible targets</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <StatusDivider />

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

        <StatusDivider />

        <div className="inline-flex items-center gap-1.5 px-2 h-6 rounded-sm cursor-default" title={`Engine: ${engineState}`}>
          <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', engineDot)} />
          <span className="font-medium">{engineLabel}</span>
        </div>
      </div>
    </footer>
  );
}
