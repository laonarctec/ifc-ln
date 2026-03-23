import { clsx } from 'clsx';
import { useViewerStore } from '@/stores';

export function StatusBar() {
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
  const statusText = error ? `Error: ${error}` : loading ? progress : 'Viewer ready';
  const frameText =
    currentFileName === null
      ? '-'
      : !geometryReady
        ? 'Preparing'
        : frameRate === null
          ? 'Measuring'
          : `${frameRate} FPS`;

  return (
    <footer className="flex items-center justify-between gap-3 px-4 border-t border-border-subtle bg-white/92 text-text-muted text-sm whitespace-nowrap overflow-hidden dark:border-slate-700 dark:bg-slate-900/92 dark:text-slate-400">
      <div className="inline-flex flex-auto items-center gap-3 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="whitespace-nowrap">Model: {currentFileName ?? 'No file'}</span>
        <span className={clsx('whitespace-nowrap', error && 'text-error font-bold')}>
          Status: {statusText}
        </span>
        <span className="whitespace-nowrap">Engine: {engineState}</span>
        <span className="whitespace-nowrap">Schema: {currentModelSchema ?? '-'}</span>
        <span className="whitespace-nowrap">
          Selection:{' '}
          {selectedEntityIds.length > 0
            ? `${selectedEntityIds.length}${selectedEntityId !== null ? ` · primary #${selectedEntityId}` : ''}`
            : 'none'}
        </span>
        <span className="whitespace-nowrap">Hidden: {hiddenEntityIds.size}</span>
      </div>
      <div className="ml-auto flex-none overflow-visible">
        <span className="inline-flex items-center justify-end min-w-[118px] text-text font-bold font-mono">Frame: {frameText}</span>
      </div>
    </footer>
  );
}
