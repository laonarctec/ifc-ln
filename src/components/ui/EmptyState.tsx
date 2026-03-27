import { clsx } from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: ReactNode;
  title?: ReactNode;
  description: ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  className,
  ...divProps
}: EmptyStateProps) {
  return (
    <div {...divProps} className={clsx("empty-state", className)}>
      {icon || title ? (
        <div className="flex items-center gap-2">
          {icon}
          {title ? <span className="empty-state-title">{title}</span> : null}
        </div>
      ) : null}
      <p className="empty-state-description">{description}</p>
    </div>
  );
}
