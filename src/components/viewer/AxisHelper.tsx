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
      <div className="viewer-axis-helper" style={{ width: 52, height: 52, perspective: 220 }}>
        <div
          ref={rotationContainerRef}
          className="viewer-axis-helper__rotator"
          style={{ transform: `rotateX(${rotationX}deg) rotateY(${rotationY}deg)` }}
        >
          <div className="viewer-axis-helper__axis viewer-axis-helper__axis--x" />
          <div ref={xLabelRef} className="viewer-axis-helper__label viewer-axis-helper__label--x">
            X
          </div>

          <div className="viewer-axis-helper__axis viewer-axis-helper__axis--z" />
          <div ref={zLabelRef} className="viewer-axis-helper__label viewer-axis-helper__label--z">
            Z
          </div>

          <div className="viewer-axis-helper__axis viewer-axis-helper__axis--y" />
          <div ref={yLabelRef} className="viewer-axis-helper__label viewer-axis-helper__label--y">
            Y
          </div>

          <div className="viewer-axis-helper__origin" />
        </div>
      </div>
    );
  }
);

AxisHelper.displayName = 'AxisHelper';
