import { CheckCircle, Info, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

let nextToastId = 1;
const listeners = new Set<(toasts: ToastMessage[]) => void>();
let toasts: ToastMessage[] = [];

function notify() {
  listeners.forEach((listener) => listener([...toasts]));
}

export function addToast(type: ToastType, message: string, durationMs = 4000) {
  const id = nextToastId++;
  toasts = [...toasts, { id, type, message }];
  notify();

  if (durationMs > 0) {
    setTimeout(() => removeToast(id), durationMs);
  }
}

function removeToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

const iconColor: Record<ToastType, string> = {
  success: 'text-green-600',
  error: 'text-red-600',
  info: 'text-blue-600',
};

export function ToastContainer() {
  const [items, setItems] = useState<ToastMessage[]>([]);

  useEffect(() => {
    listeners.add(setItems);
    return () => { listeners.delete(setItems); };
  }, []);

  const handleDismiss = useCallback((id: number) => removeToast(id), []);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-2 w-full pointer-events-none">
      {items.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-white/98 border border-border-subtle shadow-md text-sm pointer-events-auto [animation:toast-slide-in_0.22s_ease-out] dark:border-slate-600 dark:bg-slate-800/98"
        >
          <span className={iconColor[toast.type]}>
            {toast.type === 'success' && <CheckCircle size={16} />}
            {toast.type === 'error' && <XCircle size={16} />}
            {toast.type === 'info' && <Info size={16} />}
          </span>
          <span className="flex-1 text-text font-medium dark:text-slate-200">{toast.message}</span>
          <button
            type="button"
            className="inline-flex items-center justify-center w-5 h-5 p-0 border-0 rounded bg-transparent text-text-subtle cursor-pointer hover:bg-black/5 hover:text-text-secondary dark:hover:bg-white/10"
            onClick={() => handleDismiss(toast.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
