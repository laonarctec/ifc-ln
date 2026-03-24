import { useEffect } from 'react';
import { useViewerStore } from '@/stores';
import { useViewportGeometry } from '@/services/viewportGeometryStore';

export function useKeyboardShortcuts() {
  const { combinedManifest } = useViewportGeometry();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const state = useViewerStore.getState();
      const entityIds = [
        ...new Set(combinedManifest?.chunks.flatMap((chunk) => chunk.entityIds) ?? []),
      ];
      const hasGeometry = entityIds.length > 0;

      switch (event.key.toLowerCase()) {
        case 'm': {
          if (!hasGeometry) return;
          state.toggleMeasurementMode();
          break;
        }
        case 'h': {
          if (!hasGeometry || state.selectedEntityIds.length === 0) return;
          for (const id of state.selectedEntityIds) {
            state.hideEntity(id, state.currentModelId);
          }
          state.clearSelection();
          break;
        }
        case 'i': {
          if (!hasGeometry || state.selectedEntityIds.length === 0) return;
          state.isolateEntities(state.selectedEntityIds, entityIds, state.currentModelId);
          break;
        }
        case 's': {
          if (event.ctrlKey || event.metaKey) return;
          if (!hasGeometry) return;
          state.resetHiddenEntities(state.currentModelId);
          break;
        }
        case 'f': {
          if (event.ctrlKey || event.metaKey) return;
          if (!hasGeometry || state.selectedEntityIds.length === 0) return;
          state.runViewportCommand('fit-selected');
          break;
        }
        case 'escape': {
          if (state.measurement.mode !== 'idle') {
            state.clearMeasurement();
            break;
          }
          state.clearSelection();
          break;
        }
        case '1': {
          if (!hasGeometry) return;
          state.runViewportCommand('view-front');
          break;
        }
        case '3': {
          if (!hasGeometry) return;
          state.runViewportCommand('view-right');
          break;
        }
        case '7': {
          if (!hasGeometry) return;
          state.runViewportCommand('view-top');
          break;
        }
        case '0': {
          if (!hasGeometry) return;
          state.runViewportCommand('home');
          break;
        }
        case 'z': {
          if (event.ctrlKey || event.metaKey) return;
          if (!hasGeometry) return;
          state.runViewportCommand('fit-all');
          break;
        }
        case '2': {
          if (!hasGeometry) return;
          state.runViewportCommand('view-bottom');
          break;
        }
        case '4': {
          if (!hasGeometry) return;
          state.runViewportCommand('view-back');
          break;
        }
        case '5': {
          if (!hasGeometry) return;
          state.runViewportCommand('view-left');
          break;
        }
        case '6': {
          if (!hasGeometry) return;
          state.runViewportCommand('view-right');
          break;
        }
        default:
          return;
      }

      event.preventDefault();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [combinedManifest]);
}
