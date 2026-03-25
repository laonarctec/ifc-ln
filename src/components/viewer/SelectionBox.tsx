interface SelectionBoxProps {
  /** Screen-pixel coordinates of the drag start */
  startX: number;
  startY: number;
  /** Screen-pixel coordinates of the current pointer */
  endX: number;
  endY: number;
}

/**
 * CAD-style rubber-band selection rectangle overlay.
 *
 * - Left→right drag (window mode): solid blue border, light blue fill
 * - Right→left drag (crossing mode): dashed green border, light green fill
 */
export function SelectionBox({ startX, startY, endX, endY }: SelectionBoxProps) {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  // Determine mode by drag direction
  const isWindow = endX >= startX;

  return (
    <div
      style={{
        position: "fixed",
        left,
        top,
        width,
        height,
        border: isWindow ? "1.5px solid #3b82f6" : "1.5px dashed #22c55e",
        backgroundColor: isWindow
          ? "rgba(59, 130, 246, 0.08)"
          : "rgba(34, 197, 94, 0.08)",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
