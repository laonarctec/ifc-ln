import { clsx } from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  value: ReactNode;
  description?: ReactNode;
}

export function StatCard({
  label,
  value,
  description,
  className,
  ...divProps
}: StatCardProps) {
  return (
    <div {...divProps} className={clsx("stat-card", className)}>
      <span className="stat-card-label">{label}</span>
      <strong className="stat-card-value">{value}</strong>
      {description ? (
        <span className="stat-card-description">{description}</span>
      ) : null}
    </div>
  );
}
