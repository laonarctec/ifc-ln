import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

interface PanelProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  label?: string;
}

export function PanelProgress({
  value,
  max = 100,
  label,
  className,
  ...divProps
}: PanelProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div {...divProps} className={clsx("panel-progress", className)}>
      {label ? (
        <div className="flex items-center justify-between text-[0.72rem]">
          <span className="text-text-muted">{label}</span>
          <span className="font-medium text-text">{Math.round(pct)}%</span>
        </div>
      ) : null}
      <div className="panel-progress-track" role="progressbar" aria-valuenow={pct}>
        <div className="panel-progress-bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
