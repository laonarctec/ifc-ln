import { useViewerStore } from '@/stores';
import { ToastContainer } from '@/components/ui/Toast';

export function ViewportNotifications() {
  const isLoading = useViewerStore((state) => state.isLoading);
  const loadingProgress = useViewerStore((state) => state.loadingProgress);
  const progressLabel = useViewerStore((state) => state.progressLabel);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-15 flex flex-col items-center gap-2 pointer-events-none w-max max-w-[90%]">
      {isLoading && (
        <div className="flex items-center gap-2.5 px-[18px] py-2.5 rounded-[10px] bg-white/85 backdrop-blur-[12px] border border-border-subtle/70 shadow-[0_4px_16px_rgba(0,0,0,0.08)] pointer-events-auto dark:bg-slate-800/85 dark:border-slate-600/50">
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
