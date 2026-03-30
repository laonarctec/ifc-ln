import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

type PanelBadgeVariant = "default" | "success" | "error" | "warning" | "info";

interface PanelBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: PanelBadgeVariant;
}

const variantClasses: Record<PanelBadgeVariant, string> = {
  default: "panel-badge-default",
  success: "panel-badge-success",
  error: "panel-badge-error",
  warning: "panel-badge-warning",
  info: "panel-badge-info",
};

export function PanelBadge({
  variant = "default",
  className,
  children,
  ...spanProps
}: PanelBadgeProps) {
  return (
    <span
      {...spanProps}
      className={clsx("panel-badge", variantClasses[variant], className)}
    >
      {children}
    </span>
  );
}
