import { useViewerStore } from '@/stores';
import { ToastContainer } from '@/components/ui/Toast';

export function ViewportNotifications() {
  const isLoading = useViewerStore((state) => state.isLoading);
  const loadingProgress = useViewerStore((state) => state.loadingProgress);
  const progressLabel = useViewerStore((state) => state.progressLabel);

  return (
    <div className="notif-container">
      {isLoading && (
        <div className="notif-bar">
          <span className="text-xs font-semibold text-text-secondary whitespace-nowrap dark:text-slate-400">{progressLabel}</span>
          <div className="w-[120px] h-1.5 rounded-full bg-border overflow-hidden dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-primary-light transition-[width] duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <span className="text-[0.7rem] font-bold text-primary-light font-mono dark:text-blue-400">{Math.round(loadingProgress)}%</span>
        </div>
      )}
      <ToastContainer />
    </div>
  );
}
