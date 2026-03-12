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
    <div className="viewer-viewport__controls-layer">
      <div className="viewer-viewport__viewcube">
        <ViewCube
          ref={viewCubeRef}
          onViewChange={onViewChange}
          onDrag={onViewCubeDrag}
          projectionMode={projectionMode}
        />
      </div>

      <div className="viewer-viewport__axis-cluster">
        <div className="viewer-viewport__axis-helper">
          <AxisHelper ref={axisHelperRef} />
        </div>
        <div className="viewer-viewport__scale-bar">
          <div className="viewer-viewport__scale-bar-line" />
          <span>{scaleLabel}</span>
        </div>
      </div>

      <div className="viewer-viewport__nav-controls">
        <button type="button" onClick={onHome} title="Home">
          <Home size={16} strokeWidth={2} />
        </button>
        <button type="button" onClick={onFitAll} title="Fit All">
          <Maximize2 size={16} strokeWidth={2} />
        </button>
        <button type="button" onClick={onZoomIn} title="Zoom In">
          <ZoomIn size={16} strokeWidth={2} />
        </button>
        <button type="button" onClick={onZoomOut} title="Zoom Out">
          <ZoomOut size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
