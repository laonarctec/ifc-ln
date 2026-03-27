import { clsx } from "clsx";
import { type KeyboardEvent, type ReactNode, useMemo, useRef } from "react";

export interface PanelSegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon: ReactNode;
  title?: string;
  disabled?: boolean;
}

interface PanelSegmentedControlProps<T extends string> {
  options: readonly PanelSegmentedControlOption<T>[];
  value: T;
  onChange: (nextValue: T) => void;
  ariaLabel: string;
  className?: string;
}

function getEnabledOptions<T extends string>(
  options: readonly PanelSegmentedControlOption<T>[],
) {
  return options.filter((option) => !option.disabled);
}

export function PanelSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: PanelSegmentedControlProps<T>) {
  const buttonRefs = useRef(new Map<T, HTMLButtonElement | null>());
  const enabledOptions = useMemo(() => getEnabledOptions(options), [options]);

  const focusOption = (nextValue: T) => {
    const button = buttonRefs.current.get(nextValue);
    button?.focus();
  };

  const selectOption = (nextValue: T, shouldFocus = false) => {
    if (nextValue !== value) {
      onChange(nextValue);
    }
    if (shouldFocus) {
      focusOption(nextValue);
    }
  };

  const handleDirectionalSelection = (
    currentValue: T,
    direction: 1 | -1,
  ) => {
    const currentIndex = enabledOptions.findIndex(
      (option) => option.value === currentValue,
    );
    if (currentIndex < 0 || enabledOptions.length === 0) return;
    const nextIndex =
      (currentIndex + direction + enabledOptions.length) %
      enabledOptions.length;
    selectOption(enabledOptions[nextIndex].value, true);
  };

  const handleKeyDown = (
    option: PanelSegmentedControlOption<T>,
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (option.disabled) return;

    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        handleDirectionalSelection(option.value, -1);
        return;
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        handleDirectionalSelection(option.value, 1);
        return;
      case "Home":
        event.preventDefault();
        if (enabledOptions.length > 0) {
          selectOption(enabledOptions[0].value, true);
        }
        return;
      case "End":
        event.preventDefault();
        if (enabledOptions.length > 0) {
          selectOption(enabledOptions[enabledOptions.length - 1].value, true);
        }
        return;
      case " ":
      case "Enter":
        event.preventDefault();
        selectOption(option.value, true);
        return;
      default:
        return;
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={clsx("panel-tab-list", className)}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonRefs.current.set(option.value, node);
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={option.title ?? option.label}
            title={option.title}
            disabled={option.disabled}
            tabIndex={isActive ? 0 : -1}
            className={clsx("panel-tab", isActive && "panel-tab-active")}
            onClick={() => selectOption(option.value)}
            onKeyDown={(event) => handleKeyDown(option, event)}
          >
            <span className="panel-tab-icon" aria-hidden="true">
              {option.icon}
            </span>
            <span className="panel-tab-label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
