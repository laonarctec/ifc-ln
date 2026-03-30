import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

interface PanelSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface PanelSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: PanelSelectOption[];
  placeholder?: string;
}

export function PanelSelect({
  options,
  placeholder,
  className,
  ...selectProps
}: PanelSelectProps) {
  return (
    <div className={clsx("field-control relative", className)}>
      <select
        {...selectProps}
        className="field-control-element field-control-select pr-6"
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="field-control-suffix pointer-events-none" />
    </div>
  );
}
