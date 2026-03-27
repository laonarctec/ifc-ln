import { clsx } from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

type PanelCardVariant = "default" | "accent" | "soft";

interface PanelCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  variant?: PanelCardVariant;
}

export function PanelCard({
  title,
  description,
  actions,
  variant = "default",
  className,
  children,
  ...divProps
}: PanelCardProps) {
  return (
    <div
      {...divProps}
      className={clsx(
        "panel-card",
        variant === "accent" && "panel-card-accent",
        variant === "soft" && "panel-card-soft",
        className,
      )}
    >
      {(title || description || actions) && (
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            {title ? (
              <strong className="block text-[0.92rem] text-text">{title}</strong>
            ) : null}
            {description ? (
              <small className="text-[0.72rem] text-text-muted">{description}</small>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {children}
    </div>
  );
}
