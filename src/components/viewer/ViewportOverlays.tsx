import { Home, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { Ref } from 'react';
import type { ViewportProjectionMode } from '@/stores/slices/uiSlice';
import type { AxisHelperRef } from './AxisHelper';
import { AxisHelper } from './AxisHelper';
import type { ViewCubeRef } from './ViewCube';
import { ViewCube } from './ViewCube';

interface ViewportOverlaysProps {
  axisHelperRef: Ref<AxisHelperRef>;
  projectionMode: ViewportProjectionMode;
  scaleLabel: string;
  onFitAll: () => void;
  onHome: () => void;
  onViewChange: (view: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right') => void;
  onViewCubeDrag: (deltaX: number, deltaY: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  viewCubeRef: Ref<ViewCubeRef>;
}

const navBtnClass = "inline-flex items-center justify-center w-[38px] h-[38px] border border-transparent rounded-[10px] bg-transparent text-slate-700 hover:border-primary/18 hover:bg-primary-bg/94 hover:text-primary-text dark:text-slate-200 dark:hover:bg-slate-700";

export function ViewportOverlays({
  axisHelperRef,
  projectionMode,
  scaleLabel,
  onFitAll,
  onHome,
  onViewChange,
  onViewCubeDrag,
  onZoomIn,
  onZoomOut,
  viewCubeRef,
}: ViewportOverlaysProps) {
  return (
    <div className="absolute inset-0 z-9 pointer-events-none">
      <div className="absolute top-6 right-6 pointer-events-auto">
        <ViewCube
          ref={viewCubeRef}
          onViewChange={onViewChange}
          onDrag={onViewCubeDrag}
          projectionMode={projectionMode}
        />
      </div>

      <div className="absolute left-4 bottom-4 grid gap-2 pointer-events-none">
        <div className="pointer-events-auto">
          <AxisHelper ref={axisHelperRef} />
        </div>
        <div className="grid gap-1 text-slate-900/78 text-xs font-bold dark:text-slate-400">
          <div className="w-24 h-1 rounded-full bg-slate-900/78 dark:bg-slate-400" />
          <span>{scaleLabel}</span>
        </div>
      </div>

      <div className="absolute right-4 bottom-[72px] grid gap-1.5 p-[7px] border border-slate-300/96 rounded-[14px] bg-white/95 shadow-[0_10px_22px_rgba(15,23,42,0.08)] pointer-events-auto dark:border-slate-600 dark:bg-slate-800/92">
        <button type="button" className={navBtnClass} onClick={onHome} title="Home">
          <Home size={16} strokeWidth={2} />
        </button>
        <button type="button" className={navBtnClass} onClick={onFitAll} title="Fit All">
          <Maximize2 size={16} strokeWidth={2} />
        </button>
        <button type="button" className={navBtnClass} onClick={onZoomIn} title="Zoom In">
          <ZoomIn size={16} strokeWidth={2} />
        </button>
        <button type="button" className={navBtnClass} onClick={onZoomOut} title="Zoom Out">
          <ZoomOut size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
