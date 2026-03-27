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

const iconClass: Record<ToastType, string> = {
  success: 'toast-icon-success',
  error: 'toast-icon-error',
  info: 'toast-icon-info',
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
        <div key={toast.id} className="toast">
          <span className={iconClass[toast.type]}>
            {toast.type === 'success' && <CheckCircle size={16} />}
            {toast.type === 'error' && <XCircle size={16} />}
            {toast.type === 'info' && <Info size={16} />}
          </span>
          <span className="toast-message">{toast.message}</span>
          <button
            type="button"
            className="toast-dismiss"
            onClick={() => handleDismiss(toast.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
