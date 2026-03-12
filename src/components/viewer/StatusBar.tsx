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
    <footer className="viewer-statusbar">
      <div className="viewer-statusbar__group">
        <span className="viewer-statusbar__item">Model: {currentFileName ?? 'No file'}</span>
        <span className={`viewer-statusbar__item${error ? ' viewer-statusbar__item--error' : ''}`}>
          Status: {statusText}
        </span>
        <span className="viewer-statusbar__item">Engine: {engineState}</span>
        <span className="viewer-statusbar__item">Schema: {currentModelSchema ?? '-'}</span>
        <span className="viewer-statusbar__item">
          Selection:{' '}
          {selectedEntityIds.length > 0
            ? `${selectedEntityIds.length}${selectedEntityId !== null ? ` · primary #${selectedEntityId}` : ''}`
            : 'none'}
        </span>
        <span className="viewer-statusbar__item">Hidden: {hiddenEntityIds.size}</span>
      </div>
      <div className="viewer-statusbar__group viewer-statusbar__group--right">
        <span className="viewer-statusbar__item viewer-statusbar__item--frame">Frame: {frameText}</span>
      </div>
    </footer>
  );
}
