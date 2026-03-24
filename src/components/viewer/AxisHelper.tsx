import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

interface AxisHelperProps {
  rotationX?: number;
  rotationY?: number;
}

export interface AxisHelperRef {
  updateRotation: (x: number, y: number) => void;
}

export const AxisHelper = forwardRef<AxisHelperRef, AxisHelperProps>(
  ({ rotationX = -25, rotationY = 45 }, ref) => {
    const rotationContainerRef = useRef<HTMLDivElement | null>(null);
    const xLabelRef = useRef<HTMLDivElement | null>(null);
    const yLabelRef = useRef<HTMLDivElement | null>(null);
    const zLabelRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const pendingRotationRef = useRef<{ x: number; y: number } | null>(null);

    const applyRotation = (x: number, y: number) => {
      if (!rotationContainerRef.current) {
        return;
      }

      rotationContainerRef.current.style.transform = `rotateX(${x}deg) rotateY(${y}deg)`;

      const inverseRotation = `rotateY(${-y}deg) rotateX(${-x}deg)`;
      if (xLabelRef.current) {
        xLabelRef.current.style.transform = inverseRotation;
      }
      if (zLabelRef.current) {
        zLabelRef.current.style.transform = inverseRotation;
      }
      if (yLabelRef.current) {
        yLabelRef.current.style.transform = `translateZ(28px) ${inverseRotation}`;
      }
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
          <div ref={xLabelRef} className="axis-label left-[52px] top-[19px] text-red-500">
            X
          </div>

          {/* Z axis */}
          <div className="absolute w-0.5 h-5 left-[25px] top-[6px] bg-blue-600 origin-bottom" />
          <div ref={zLabelRef} className="axis-label left-[22px] top-[-2px] text-blue-600">
            Z
          </div>

          {/* Y axis */}
          <div className="absolute w-5 h-0.5 left-[26px] top-[25px] bg-emerald-500 origin-left" style={{ transform: 'rotateY(-90deg)' }} />
          <div ref={yLabelRef} className="axis-label left-[22px] top-[31px] text-emerald-500">
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
