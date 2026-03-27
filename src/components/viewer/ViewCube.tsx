import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { clsx } from 'clsx';
import type { ViewportProjectionMode } from '@/stores/slices/uiSlice';

interface ViewCubeProps {
  onViewChange?: (view: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right') => void;
  onDrag?: (deltaX: number, deltaY: number) => void;
  projectionMode?: ViewportProjectionMode;
  rotationX?: number;
  rotationY?: number;
}

export interface ViewCubeRef {
  updateRotation: (x: number, y: number) => void;
}

const FACES = [
  { id: 'front', label: 'FRONT', transform: (half: number) => `translateZ(${half}px)` },
  { id: 'back', label: 'BACK', transform: (half: number) => `translateZ(${-half}px) rotateY(180deg)` },
  { id: 'top', label: 'TOP', transform: (half: number) => `translateY(${-half}px) rotateX(90deg)` },
  { id: 'bottom', label: 'BTM', transform: (half: number) => `translateY(${half}px) rotateX(-90deg)` },
  { id: 'right', label: 'RIGHT', transform: (half: number) => `translateX(${half}px) rotateY(90deg)` },
  { id: 'left', label: 'LEFT', transform: (half: number) => `translateX(${-half}px) rotateY(-90deg)` },
] as const;

export const ViewCube = forwardRef<ViewCubeRef, ViewCubeProps>(
  ({ onViewChange, onDrag, projectionMode = 'perspective', rotationX = -25, rotationY = 45 }, ref) => {
    const [hoveredFace, setHoveredFace] = useState<string | null>(null);
    const [isPointerDown, setIsPointerDown] = useState(false);
    const rotationContainerRef = useRef<HTMLDivElement | null>(null);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);
    const isDraggingRef = useRef(false);
    const didDragRef = useRef(false);
    const onDragRef = useRef(onDrag);
    const rafRef = useRef<number | null>(null);
    const pendingRotationRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
      onDragRef.current = onDrag;
    }, [onDrag]);

    useImperativeHandle(ref, () => ({
      updateRotation: (x: number, y: number) => {
        pendingRotationRef.current = { x, y };

        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }

        rafRef.current = requestAnimationFrame(() => {
          if (rotationContainerRef.current && pendingRotationRef.current) {
            rotationContainerRef.current.style.transform = `rotateX(${pendingRotationRef.current.x}deg) rotateY(${pendingRotationRef.current.y}deg)`;
            pendingRotationRef.current = null;
          }
          rafRef.current = null;
        });
      },
    }));

    useEffect(() => {
      if (rotationContainerRef.current) {
        rotationContainerRef.current.style.transform = `rotateX(${rotationX}deg) rotateY(${rotationY}deg)`;
      }
    }, []);

    useEffect(() => {
      if (!isPointerDown) {
        document.body.style.cursor = '';
        return;
      }

      const handlePointerMove = (event: PointerEvent) => {
        if (!dragStartRef.current) {
          return;
        }

        const deltaX = event.clientX - dragStartRef.current.x;
        const deltaY = event.clientY - dragStartRef.current.y;

        if (!isDraggingRef.current && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
          isDraggingRef.current = true;
          didDragRef.current = true;
          document.body.style.cursor = 'grabbing';
        }

        if (isDraggingRef.current) {
          onDragRef.current?.(deltaX * 1.6, deltaY * 1.6);
          dragStartRef.current = { x: event.clientX, y: event.clientY };
        }
      };

      const handlePointerUp = () => {
        setIsPointerDown(false);
        isDraggingRef.current = false;
        dragStartRef.current = null;
        document.body.style.cursor = '';

        setTimeout(() => {
          didDragRef.current = false;
        }, 50);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);

      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        document.body.style.cursor = '';
      };
    }, [isPointerDown]);

    useEffect(
      () => () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
        }
      },
      []
    );

    const handleFaceClick = useCallback(
      (face: (typeof FACES)[number]['id']) => {
        if (!didDragRef.current) {
          onViewChange?.(face);
        }
      },
      [onViewChange]
    );

    const size = 64;
    const half = size / 2;

    const isOrtho = projectionMode === 'orthographic';

    return (
      <div
        className={clsx('relative select-none', isOrtho && 'saturate-[0.92]')}
        style={{ width: size, height: size, perspective: isOrtho ? 'none' : 220 }}
        onPointerDown={(event) => {
          dragStartRef.current = { x: event.clientX, y: event.clientY };
          isDraggingRef.current = false;
          didDragRef.current = false;
          setIsPointerDown(true);
        }}
      >
        <div
          ref={rotationContainerRef}
          className="relative w-full h-full transform-3d"
          style={{ transform: `rotateX(${rotationX}deg) rotateY(${rotationY}deg)` }}
        >
          {FACES.map(({ id, label, transform }) => {
            const hovered = hoveredFace === id;
            return (
              <button
                key={id}
                type="button"
                className={clsx(
                  'viewcube-face',
                  isOrtho && 'viewcube-face-ortho',
                  hovered && 'viewcube-face-hover',
                  hovered && isOrtho && 'viewcube-face-hover-ortho',
                )}
                style={{ transform: transform(half) }}
                onMouseEnter={() => setHoveredFace(id)}
                onMouseLeave={() => setHoveredFace(null)}
                onClick={() => handleFaceClick(id)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
);

ViewCube.displayName = 'ViewCube';
