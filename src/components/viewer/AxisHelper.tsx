import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

interface AxisHelperProps {
  rotationX?: number;
  rotationY?: number;
}

export interface AxisHelperRef {
  updateRotation: (x: number, y: number) => void;
}

const AXIS_LABEL_POSITIONS = {
  x: { left: 53, top: 25, depth: 0 },
  z: { left: 25, top: 2, depth: 0 },
  y: { left: 25, top: 25, depth: 28 },
} as const;

export const AxisHelper = forwardRef<AxisHelperRef, AxisHelperProps>(
  ({ rotationX = -25, rotationY = 45 }, ref) => {
    const rotationContainerRef = useRef<HTMLDivElement | null>(null);
    const xLabelRef = useRef<HTMLDivElement | null>(null);
    const yLabelRef = useRef<HTMLDivElement | null>(null);
    const zLabelRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const pendingRotationRef = useRef<{ x: number; y: number } | null>(null);

    const applyLabelTransform = (
      label: HTMLDivElement | null,
      x: number,
      y: number,
      depth = 0,
    ) => {
      if (!label) {
        return;
      }

      const depthTransform = depth > 0 ? ` translateZ(${depth}px)` : '';
      label.style.transform =
        `translate(-50%, -50%)${depthTransform} rotateY(${-y}deg) rotateX(${-x}deg)`;
    };

    const applyRotation = (x: number, y: number) => {
      if (!rotationContainerRef.current) {
        return;
      }

      rotationContainerRef.current.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`;
      applyLabelTransform(xLabelRef.current, x, y, AXIS_LABEL_POSITIONS.x.depth);
      applyLabelTransform(zLabelRef.current, x, y, AXIS_LABEL_POSITIONS.z.depth);
      applyLabelTransform(yLabelRef.current, x, y, AXIS_LABEL_POSITIONS.y.depth);
    };

    useImperativeHandle(ref, () => ({
      updateRotation: (x: number, y: number) => {
        pendingRotationRef.current = { x, y };

        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }

        rafRef.current = requestAnimationFrame(() => {
          if (pendingRotationRef.current) {
            applyRotation(pendingRotationRef.current.x, pendingRotationRef.current.y);
            pendingRotationRef.current = null;
          }
          rafRef.current = null;
        });
      },
    }));

    useEffect(() => {
      applyRotation(rotationX, rotationY);

      return () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }
      };
    }, []);

    return (
      <div className="relative select-none" style={{ width: 52, height: 52, perspective: 220 }}>
        <div
          ref={rotationContainerRef}
          className="relative w-full h-full transform-3d"
          style={{ transform: `rotateX(${rotationX}deg) rotateY(${rotationY}deg)` }}
        >
          {/* X axis */}
          <div className="absolute w-5 h-0.5 left-[26px] top-[25px] bg-red-500 origin-left" />
          <div
            ref={xLabelRef}
            className="axis-label text-red-500"
            style={{ left: AXIS_LABEL_POSITIONS.x.left, top: AXIS_LABEL_POSITIONS.x.top }}
          >
            X
          </div>

          {/* Z axis */}
          <div className="absolute w-0.5 h-5 left-[25px] top-[6px] bg-blue-600 origin-bottom" />
          <div
            ref={zLabelRef}
            className="axis-label text-blue-600"
            style={{ left: AXIS_LABEL_POSITIONS.z.left, top: AXIS_LABEL_POSITIONS.z.top }}
          >
            Z
          </div>

          {/* Y axis */}
          <div className="absolute w-5 h-0.5 left-[26px] top-[25px] bg-emerald-500 origin-left" style={{ transform: 'rotateY(-90deg)' }} />
          <div
            ref={yLabelRef}
            className="axis-label text-emerald-500"
            style={{ left: AXIS_LABEL_POSITIONS.y.left, top: AXIS_LABEL_POSITIONS.y.top }}
          >
            Y
          </div>

          {/* Origin */}
          <div className="absolute w-2 h-2 left-[22px] top-[22px] border border-slate-400/80 rounded-full bg-white/96" />
        </div>
      </div>
    );
  }
);

AxisHelper.displayName = 'AxisHelper';
