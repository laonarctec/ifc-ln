import { useWebIfc } from '@/hooks/useWebIfc';
import { useViewerStore } from '@/stores';

export function StatusBar() {
  const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
  const hiddenEntityIds = useViewerStore((state) => state.hiddenEntityIds);
  const { loading, progress, engineState, currentModelSchema, currentFileName } = useWebIfc();

  return (
    <footer className="viewer-statusbar">
      <span className="viewer-statusbar__item">Model: {currentFileName ?? 'No file'}</span>
      <span className="viewer-statusbar__item">Status: {loading ? progress : 'Viewer ready'}</span>
      <span className="viewer-statusbar__item">Engine: {engineState}</span>
      <span className="viewer-statusbar__item">Schema: {currentModelSchema ?? '-'}</span>
      <span className="viewer-statusbar__item">Selection: {selectedEntityId ?? 'none'}</span>
      <span className="viewer-statusbar__item">Hidden: {hiddenEntityIds.size}</span>
    </footer>
  );
}
