import { Eye, EyeOff, Focus, Layers } from 'lucide-react';
import { useEffect, useRef } from 'react';

export interface ContextMenuState {
  expressId: number | null;
  x: number;
  y: number;
}

interface ContextMenuProps {
  menu: ContextMenuState;
  onClose: () => void;
  onHide: (expressId: number) => void;
  onIsolate: (expressId: number) => void;
  onShowAll: () => void;
  onFitSelected: () => void;
}

const menuBtnClass = "flex items-center gap-2 w-full px-2.5 py-[7px] border-0 rounded-[5px] bg-transparent text-text text-[0.78rem] font-medium cursor-pointer text-left hover:bg-primary/8 dark:text-slate-200 dark:hover:bg-blue-500/12";

export function ContextMenu({ menu, onClose, onHide, onIsolate, onShowAll, onFitSelected }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

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
      className="fixed z-110 flex flex-col min-w-40 p-1 border border-border-subtle rounded-lg bg-white/98 backdrop-blur-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] dark:border-slate-600 dark:bg-slate-800/98"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.expressId !== null && (
        <>
          <button type="button" className={menuBtnClass} onClick={() => { onHide(menu.expressId!); onClose(); }}>
            <EyeOff size={14} />
            <span>Hide</span>
          </button>
          <button type="button" className={menuBtnClass} onClick={() => { onIsolate(menu.expressId!); onClose(); }}>
            <Layers size={14} />
            <span>Isolate</span>
          </button>
          <button type="button" className={menuBtnClass} onClick={() => { onFitSelected(); onClose(); }}>
            <Focus size={14} />
            <span>Fit Selected</span>
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
