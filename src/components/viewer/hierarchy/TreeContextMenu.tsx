import { Eye, EyeOff, Focus, Layers3, MousePointerClick } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { TreeNode } from '@/types/hierarchy';

export interface TreeContextMenuState {
  node: TreeNode;
  x: number;
  y: number;
}

interface TreeContextMenuProps {
  menu: TreeContextMenuState;
  hiddenEntityIds: Set<number>;
  onClose: () => void;
  onSelect: (entityIds: number[]) => void;
  onIsolate: (entityIds: number[]) => void;
  onHide: (entityIds: number[]) => void;
  onShow: (entityIds: number[]) => void;
  onFocus: (entityIds: number[]) => void;
  onShowAll: () => void;
}

export function TreeContextMenu({
  menu,
  hiddenEntityIds,
  onClose,
  onSelect,
  onIsolate,
  onHide,
  onShow,
  onFocus,
  onShowAll,
}: TreeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Clamp to viewport bounds
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 4;
    const maxY = window.innerHeight - rect.height - 4;
    if (menu.x > maxX) el.style.left = `${maxX}px`;
    if (menu.y > maxY) el.style.top = `${maxY}px`;
  }, [menu.x, menu.y]);

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const { node } = menu;
  const ids = node.entityIds;
  const hasEntities = ids.length > 0;
  const someVisible = hasEntities && ids.some((id) => !hiddenEntityIds.has(id));
  const someHidden = hasEntities && ids.some((id) => hiddenEntityIds.has(id));

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: menu.x, top: menu.y }}
    >
      {hasEntities && (
        <>
          <button type="button" className="ctx-menu-item" onClick={() => { onSelect(ids); onClose(); }}>
            <MousePointerClick size={14} />
            <span>Select</span>
          </button>
          <button type="button" className="ctx-menu-item" onClick={() => { onIsolate(ids); onClose(); }}>
            <Layers3 size={14} />
            <span>Isolate</span>
          </button>
          {someVisible && (
            <button type="button" className="ctx-menu-item" onClick={() => { onHide(ids); onClose(); }}>
              <EyeOff size={14} />
              <span>Hide</span>
            </button>
          )}
          {someHidden && (
            <button type="button" className="ctx-menu-item" onClick={() => { onShow(ids); onClose(); }}>
              <Eye size={14} />
              <span>Show</span>
            </button>
          )}
          <button type="button" className="ctx-menu-item" onClick={() => { onFocus(ids); onClose(); }}>
            <Focus size={14} />
            <span>Focus</span>
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
