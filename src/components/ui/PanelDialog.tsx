import { useCallback, useEffect, useRef } from "react";
import { clsx } from "clsx";
import { X } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

interface PanelDialogProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PanelDialog({
  open,
  onClose,
  title,
  description,
  actions,
  className,
  children,
  ...divProps
}: PanelDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        className={clsx("modal-dialog", className)}
        onClick={(e) => e.stopPropagation()}
        {...divProps}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 className="text-[1rem] font-bold text-text">{title}</h2>
            {description ? (
              <p className="mt-1 text-[0.78rem] text-text-muted">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="toast-dismiss"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-3">{children}</div>
        {actions ? (
          <div className="flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
