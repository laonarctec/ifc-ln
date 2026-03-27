import { Home, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { Ref } from 'react';
import type { ViewportProjectionMode } from '@/stores/slices/uiSlice';
import type { InteractionMode, MeasurementState } from '@/stores/slices/toolsSlice';
import type { AxisHelperRef } from './AxisHelper';
import { AxisHelper } from './AxisHelper';
import type { ViewCubeRef } from './ViewCube';
import { ViewCube } from './ViewCube';
import { ViewportToolCards } from './ViewportToolCards';
import type { ClippingPlaneLabel } from '@/hooks/useClippingPlane';

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
  interactionMode: InteractionMode;
  measurement: MeasurementState;
  onToggleMeasurementMode: () => void;
  onClearMeasurement: () => void;
  clippingLabels: ClippingPlaneLabel[];
}

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
  interactionMode,
  measurement,
  onToggleMeasurementMode,
  onClearMeasurement,
  clippingLabels,
}: ViewportOverlaysProps) {
  return (
    <div className="absolute inset-0 z-9 pointer-events-none">
      <div className="absolute top-6 left-6 pointer-events-auto">
        <ViewportToolCards
          interactionMode={interactionMode}
          measurement={measurement}
          onToggleMeasurementMode={onToggleMeasurementMode}
          onClearMeasurement={onClearMeasurement}
        />
      </div>

      {clippingLabels.map((label) => (
        <div
          key={label.id}
          className="absolute pointer-events-none"
          style={{ left: label.left, top: label.top, transform: 'translate(-50%, -50%)' }}
        >
          <span
            className="inline-flex items-center rounded-md border border-slate-200/90 bg-white/92 px-2 py-1 text-[0.68rem] font-semibold tracking-[0.02em] text-slate-700 shadow-sm backdrop-blur-sm dark:border-slate-600 dark:bg-slate-900/92 dark:text-slate-100"
            style={{ outline: label.selected ? '2px solid rgba(37,99,235,0.35)' : undefined }}
          >
            {label.name}
          </span>
        </div>
      ))}

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
        <button type="button" className="btn-nav" onClick={onHome} title="Home">
          <Home size={16} strokeWidth={2} />
        </button>
        <button type="button" className="btn-nav" onClick={onFitAll} title="Fit All">
          <Maximize2 size={16} strokeWidth={2} />
        </button>
        <button type="button" className="btn-nav" onClick={onZoomIn} title="Zoom In">
          <ZoomIn size={16} strokeWidth={2} />
        </button>
        <button type="button" className="btn-nav" onClick={onZoomOut} title="Zoom Out">
          <ZoomOut size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
