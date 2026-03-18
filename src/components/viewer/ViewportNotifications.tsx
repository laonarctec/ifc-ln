import { useViewerStore } from '@/stores';
import { ToastContainer } from '@/components/ui/Toast';

export function ViewportNotifications() {
  const isLoading = useViewerStore((state) => state.isLoading);
  const loadingProgress = useViewerStore((state) => state.loadingProgress);
  const progressLabel = useViewerStore((state) => state.progressLabel);

  return (
    <div className="viewport-notifications">
      {isLoading && (
        <div className="viewport-progress">
          <span className="viewport-progress__label">{progressLabel}</span>
          <div className="viewport-progress__bar">
            <div
              className="viewport-progress__fill"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <span className="viewport-progress__pct">{Math.round(loadingProgress)}%</span>
        </div>
      )}
      <ToastContainer />
    </div>
  );
}
