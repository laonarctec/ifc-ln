import { clsx } from 'clsx';
import {
  Activity,
  AlertTriangle,
  Bug,
  EyeOff,
  FileBox,
  Layers,
  MousePointer2,
  Ruler,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useViewerStore } from '@/stores';
import {
  countHiddenEntitiesForModel,
  selectStatusBarState,
} from '@/stores/viewerSelectors';
import { useViewportGeometry } from '@/services/viewportGeometryStore';
import { StatusDebugPanel } from './StatusDebugPanel';
import { useWebIfc } from '@/hooks/useWebIfc';
import { formatMetric } from '@/utils/geometryMetrics';
import {
  buildStatusBarDebugCards,
  buildStatusBarLeadingItems,
  resolveStatusBarEngineIndicator,
  resolveStatusBarFrameDisplay,
  type StatusBarLeadingItem,
} from './statusBarViewModel';

function StatusDivider() {
  return <span className="w-px h-3 bg-slate-200 mx-1 dark:bg-slate-700" />;
}

function StatusLeadingItemView({ item }: { item: StatusBarLeadingItem }) {
  const iconClassName = clsx(
    'shrink-0',
    item.kind === 'loading' && 'animate-pulse',
  );
  const containerClassName = clsx(
    'inline-flex items-center gap-1 px-2 h-6 rounded-sm cursor-default',
    item.kind === 'loading' && 'text-blue-600 dark:text-blue-400',
    item.tone === 'info' &&
      item.kind !== 'loading' &&
      'text-blue-700 font-medium dark:text-blue-300',
    item.tone === 'warning' && 'text-amber-600 font-medium dark:text-amber-400',
    item.tone === 'error' && 'text-error font-bold',
    item.tone === 'default' &&
      item.active &&
      'text-primary-text font-medium dark:text-blue-400',
  );
  const valueClassName = clsx(
    item.truncate && 'truncate max-w-[140px]',
    item.compact && 'truncate max-w-[100px] text-[0.62rem]',
  );

  return (
    <div className={containerClassName} title={item.title}>
      {item.kind === 'selection' ? (
        <MousePointer2 size={11} strokeWidth={2} className={iconClassName} />
      ) : item.kind === 'measurement' ? (
        <Ruler size={11} strokeWidth={2} className={iconClassName} />
      ) : item.kind === 'hidden' ? (
        <EyeOff size={11} strokeWidth={2} className={iconClassName} />
      ) : item.kind === 'error' ? (
        <AlertTriangle size={11} strokeWidth={2} className={iconClassName} />
      ) : (
        <Layers size={11} strokeWidth={2} className={iconClassName} />
      )}
      <span className={valueClassName}>{item.value}</span>
    </div>
  );
}

export function StatusBar() {
  const [debugOpen, setDebugOpen] = useState(false);
  const statusState = useViewerStore(useShallow(selectStatusBarState));
  const {
    currentFileName,
    currentModelId,
    currentModelSchema,
    currentModelMaxExpressId,
    engineState,
    geometryReady,
    isLoading: loading,
    progressLabel: progress,
    viewerError: error,
    selectedEntityId,
    selectedEntityIds,
    hiddenEntityKeys,
    frameRate,
    interactionMode,
    measurement,
  } = statusState;

  const {
    engineMessage,
    geometryResult,
    loadedModels,
  } = useWebIfc();

  const { combinedManifest, modelsById } = useViewportGeometry();

  const hiddenEntityCount = countHiddenEntitiesForModel(
    hiddenEntityKeys,
    currentModelId,
  );
  const residentChunkCount = Object.values(modelsById).reduce(
    (sum, model) => sum + model.residentChunkIds.length,
    0,
  );
  const visibleChunkCount = Object.values(modelsById).reduce(
    (sum, model) => sum + model.visibleChunkIds.length,
    0,
  );
  const measurementValue =
    measurement.distance !== null
      ? formatMetric(measurement.distance, 'm', 3)
      : 'placing';
  const leadingItems = buildStatusBarLeadingItems({
    selectedEntityId,
    selectedEntityCount: selectedEntityIds.length,
    showMeasurement:
      interactionMode === 'measure-distance' || measurement.distance !== null,
    measurementValue,
    hiddenEntityCount,
    error,
    loading,
    progress,
  });
  const debugCards = buildStatusBarDebugCards({
    engineState,
    engineMessage,
    loading,
    progress,
    geometryReady: geometryResult.ready,
    geometryMeshCount: geometryResult.meshCount,
    geometryVertexCount: geometryResult.vertexCount,
    geometryIndexCount: geometryResult.indexCount,
    selectedEntityId,
    selectedEntityCount: selectedEntityIds.length,
    currentFileName,
    currentModelId,
    currentModelSchema,
    currentModelMaxExpressId,
    loadedModelCount: loadedModels.length,
    residentChunkCount,
    totalChunkCount: combinedManifest?.chunkCount ?? 0,
    visibleChunkCount,
  });
  const frameDisplay = resolveStatusBarFrameDisplay(
    currentFileName,
    geometryReady,
    frameRate,
  );
  const engineIndicator = resolveStatusBarEngineIndicator(engineState);

  return (
    <footer className="status-bar">
      <div className="flex min-w-0 flex-1 items-center gap-px overflow-hidden">
        {leadingItems.map((item, index) => (
          <Fragment key={item.id}>
            {index > 0 ? <StatusDivider /> : null}
            <StatusLeadingItemView item={item} />
          </Fragment>
        ))}
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

          {debugOpen ? (
            <StatusDebugPanel
              cards={debugCards}
              onClose={() => setDebugOpen(false)}
            />
          ) : null}
        </div>

        <StatusDivider />

        <div className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 h-6 rounded-sm font-mono text-[0.7rem] font-bold cursor-default',
          frameDisplay.lowFrameRate
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-text dark:text-slate-300',
        )} title={`Frame rate: ${frameDisplay.text} FPS`}>
          <Activity size={12} strokeWidth={2.5} className="shrink-0" />
          <span>{frameDisplay.text}</span>
          {frameDisplay.showUnit ? <span className="text-text-subtle font-normal text-[0.58rem]">FPS</span> : null}
        </div>

        <StatusDivider />

        <div className="inline-flex items-center gap-1.5 px-2 h-6 rounded-sm cursor-default" title={`Engine: ${engineState}`}>
          <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', engineIndicator.dotClassName)} />
          <span className="font-medium">{engineIndicator.label}</span>
        </div>
      </div>
    </footer>
  );
}
