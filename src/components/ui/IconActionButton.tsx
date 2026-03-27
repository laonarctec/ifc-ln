import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconActionButtonVariant = "neutral" | "danger";

interface IconActionButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ReactNode;
  label?: string;
  children?: ReactNode;
  iconOnly?: boolean;
  variant?: IconActionButtonVariant;
}

export function IconActionButton({
  icon,
  label,
  children,
  iconOnly = false,
  variant = "neutral",
  className,
  type = "button",
  ...buttonProps
}: IconActionButtonProps) {
  return (
    <button
      {...buttonProps}
      type={type}
      className={clsx(
        "icon-action-button",
        iconOnly && "icon-action-button-icon-only",
        variant === "danger" && "icon-action-button-danger",
        className,
      )}
      aria-label={buttonProps["aria-label"] ?? label}
      title={buttonProps.title ?? label}
    >
      {icon}
      {iconOnly ? null : <span>{children ?? label}</span>}
    </button>
  );
}
