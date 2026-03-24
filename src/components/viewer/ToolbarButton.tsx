import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Tooltip, type TooltipContentData } from "@/components/ui/Tooltip";

export type ToolbarButtonVariant = "default" | "primary" | "toggle" | "summary";

interface ToolbarButtonClassOptions {
  variant?: ToolbarButtonVariant;
  active?: boolean;
  className?: string;
}

export interface ToolbarButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">,
    ToolbarButtonClassOptions {
  icon: ReactNode;
  label: string;
  tooltip: TooltipContentData;
  ariaLabel?: string;
}

export function getToolbarButtonClassName({
  variant = "default",
  active = false,
  className,
}: ToolbarButtonClassOptions = {}) {
  return clsx(
    "btn-icon",
    variant === "primary" && "btn-icon-primary",
    variant === "toggle" && "btn-icon-toggle",
    variant === "summary" && "btn-icon-summary",
    variant === "toggle" && active && "btn-icon-toggle-active",
    className,
  );
}

export function ToolbarButton({
  icon,
  label,
  tooltip,
  variant = "default",
  active = false,
  className,
  ariaLabel,
  type = "button",
  ...buttonProps
}: ToolbarButtonProps) {
  return (
    <Tooltip content={tooltip}>
      <button
        {...buttonProps}
        type={type}
        className={getToolbarButtonClassName({ variant, active, className })}
        aria-label={ariaLabel ?? label}
      >
        {icon}
        <span>{label}</span>
      </button>
    </Tooltip>
  );
}
