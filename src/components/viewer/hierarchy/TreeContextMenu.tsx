import { Eye, EyeOff, Focus, Layers3, MousePointerClick } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { TreeNode } from './types';

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
      className="context-menu"
      style={{ left: menu.x, top: menu.y }}
    >
      {hasEntities && (
        <>
          <button type="button" onClick={() => { onSelect(ids); onClose(); }}>
            <MousePointerClick size={14} />
            <span>Select</span>
          </button>
          <button type="button" onClick={() => { onIsolate(ids); onClose(); }}>
            <Layers3 size={14} />
            <span>Isolate</span>
          </button>
          {someVisible && (
            <button type="button" onClick={() => { onHide(ids); onClose(); }}>
              <EyeOff size={14} />
              <span>Hide</span>
            </button>
          )}
          {someHidden && (
            <button type="button" onClick={() => { onShow(ids); onClose(); }}>
              <Eye size={14} />
              <span>Show</span>
            </button>
          )}
          <button type="button" onClick={() => { onFocus(ids); onClose(); }}>
            <Focus size={14} />
            <span>Focus</span>
          </button>
          <div className="context-menu__separator" />
        </>
      )}
      <button type="button" onClick={() => { onShowAll(); onClose(); }}>
        <Eye size={14} />
        <span>Show All</span>
      </button>
    </div>
  );
}
