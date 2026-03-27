import { Eye, EyeOff, Focus, Layers } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface ContextMenuState {
  modelId: number | null;
  entityIds: number[];
  x: number;
  y: number;
}

interface ContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  onHide: (modelId: number, entityIds: number[]) => void;
  onIsolate: (modelId: number, entityIds: number[]) => void;
  onShowAll: () => void;
  onFitSelected: () => void;
}

export function ContextMenu({ menu, onClose, onHide, onIsolate, onShowAll, onFitSelected }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hasEntities = menu.modelId !== null && menu.entityIds.length > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: menu.x, top: menu.y }}
    >
      {hasEntities && (
        <>
          <button type="button" className="ctx-menu-item" onClick={() => { onHide(menu.modelId!, menu.entityIds); onClose(); }}>
            <EyeOff size={14} />
            <span>Hide</span>
          </button>
          <button type="button" className="ctx-menu-item" onClick={() => { onIsolate(menu.modelId!, menu.entityIds); onClose(); }}>
            <Layers size={14} />
            <span>Isolate</span>
          </button>
          <button type="button" className="ctx-menu-item" onClick={() => { onFitSelected(); onClose(); }}>
            <Focus size={14} />
            <span>Fit Selected</span>
          </button>
          <div className="h-px mx-1.5 bg-border dark:bg-slate-700" />
        </>
      )}
      <button type="button" className="ctx-menu-item" onClick={() => { onShowAll(); onClose(); }}>
        <Eye size={14} />
        <span>Show All</span>
      </button>
    </div>
  );
}
