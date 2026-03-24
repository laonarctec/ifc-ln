import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

const shortcuts = [
  { key: "H", description: "선택 객체 숨기기" },
  { key: "I", description: "선택 객체만 보기 (Isolate)" },
  { key: "S", description: "전체 다시 보기 (Show All)" },
  { key: "F", description: "선택 객체에 맞춰 보기 (Fit Selected)" },
  { key: "Z", description: "전체 모델에 맞춤 (Fit All)" },
  { key: "Esc", description: "선택 해제" },
  { key: "0", description: "Home (Isometric)" },
  { key: "1", description: "Front 뷰" },
  { key: "2", description: "Bottom 뷰" },
  { key: "3", description: "Right 뷰" },
  { key: "4", description: "Back 뷰" },
  { key: "5", description: "Left 뷰" },
  { key: "6", description: "Right 뷰" },
  { key: "7", description: "Top 뷰" },
];

export function KeyboardShortcutsDialog({ open, onClose }: KeyboardShortcutsDialogProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border dark:border-slate-700">
          <h2 id="keyboard-shortcuts-title" className="m-0 text-base font-bold text-text dark:text-slate-100">
            키보드 단축키
          </h2>
          <button
            type="button"
            className="inline-flex items-center justify-center w-7 h-7 p-0 border-0 rounded-md bg-transparent text-text-muted cursor-pointer hover:bg-slate-100 hover:text-text dark:hover:bg-slate-700 dark:hover:text-slate-200"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-3 pb-5 overflow-y-auto">
          {shortcuts.map(({ key, description }) => (
            <div key={key} className="flex items-center gap-3.5 py-2 border-b border-slate-50 text-[0.82rem] text-slate-700 last:border-b-0 dark:text-slate-200 dark:border-slate-700">
              <kbd className="kbd">{key}</kbd>
              <span>{description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
