import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

export function FilterChip({
  active = false,
  className,
  children,
  type = "button",
  ...buttonProps
}: FilterChipProps) {
  return (
    <button
      {...buttonProps}
      type={type}
      className={clsx(
        "filter-chip-ui",
        active && "filter-chip-ui-active",
        className,
      )}
    >
      {children}
    </button>
  );
}
