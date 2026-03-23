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

const menuBtnClass = "flex items-center gap-2 w-full px-2.5 py-[7px] border-0 rounded-[5px] bg-transparent text-text text-[0.78rem] font-medium cursor-pointer text-left hover:bg-primary/8 dark:text-slate-200 dark:hover:bg-blue-500/12";

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
      className="fixed z-110 flex flex-col min-w-40 p-1 border border-border-subtle rounded-lg bg-white/98 backdrop-blur-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] dark:border-slate-600 dark:bg-slate-800/98"
      style={{ left: menu.x, top: menu.y }}
    >
      {hasEntities && (
        <>
          <button type="button" className={menuBtnClass} onClick={() => { onSelect(ids); onClose(); }}>
            <MousePointerClick size={14} />
            <span>Select</span>
          </button>
          <button type="button" className={menuBtnClass} onClick={() => { onIsolate(ids); onClose(); }}>
            <Layers3 size={14} />
            <span>Isolate</span>
          </button>
          {someVisible && (
            <button type="button" className={menuBtnClass} onClick={() => { onHide(ids); onClose(); }}>
              <EyeOff size={14} />
              <span>Hide</span>
            </button>
          )}
          {someHidden && (
            <button type="button" className={menuBtnClass} onClick={() => { onShow(ids); onClose(); }}>
              <Eye size={14} />
              <span>Show</span>
            </button>
          )}
          <button type="button" className={menuBtnClass} onClick={() => { onFocus(ids); onClose(); }}>
            <Focus size={14} />
            <span>Focus</span>
          </button>
          <div className="h-px mx-1.5 bg-border dark:bg-slate-700" />
        </>
      )}
      <button type="button" className={menuBtnClass} onClick={() => { onShowAll(); onClose(); }}>
        <Eye size={14} />
        <span>Show All</span>
      </button>
    </div>
  );
}
