import { useState } from "react";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

interface CollapsibleCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  variant?: "default" | "accent" | "soft";
}

export function CollapsibleCard({
  title,
  description,
  actions,
  defaultOpen = true,
  variant = "default",
  className,
  children,
  ...divProps
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

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
      <button
        type="button"
        className="collapsible-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <ChevronDown
          size={14}
          className={clsx(
            "shrink-0 text-text-muted transition-transform duration-150",
            !open && "-rotate-90",
          )}
        />
        <div className="min-w-0 flex-1 text-left">
          <strong className="block text-[0.92rem] text-text">{title}</strong>
          {description ? (
            <small className="text-[0.72rem] text-text-muted">{description}</small>
          ) : null}
        </div>
        {actions ? (
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        ) : null}
      </button>
      {open ? <div className="collapsible-content">{children}</div> : null}
    </div>
  );
}
