import {
  Check,
  ChevronDown,
} from "lucide-react";
import type {
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import { Tooltip, type TooltipContentData } from "@/components/ui/Tooltip";
import {
  ToolbarButton,
  getToolbarButtonClassName,
  type ToolbarButtonVariant,
} from "./ToolbarButton";

export type EngineState = "idle" | "initializing" | "ready" | "error";
export type TypeVisibilityKey = "spaces" | "openings" | "site";

export interface ToolbarActionConfig {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tooltip: TooltipContentData;
  variant?: Exclude<ToolbarButtonVariant, "summary">;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

interface ToolbarMenuActionItem {
  kind: "action";
  id: string;
  label: string;
  onSelect: () => void;
  tooltip?: TooltipContentData | null;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  closeOnSelect?: boolean;
}

interface ToolbarMenuCheckItem {
  kind: "check";
  id: string;
  label: string;
  checked: boolean;
  color: string;
  onSelect: () => void;
  tooltip?: TooltipContentData | null;
  closeOnSelect?: boolean;
}

interface ToolbarMenuDivider {
  kind: "divider";
  id: string;
}

export type ToolbarMenuItemConfig =
  | ToolbarMenuActionItem
  | ToolbarMenuCheckItem
  | ToolbarMenuDivider;

export interface ToolbarMenuConfig {
  id: string;
  icon: ReactNode;
  label: string;
  tooltip: TooltipContentData;
  items: ToolbarMenuItemConfig[];
}

export const ENGINE_STATE_LABEL: Record<EngineState, string> = {
  idle: "대기 중",
  initializing: "초기화 중",
  ready: "준비 완료",
  error: "오류",
};

export const VIEW_PRESET_CONFIGS = [
  { id: "view-iso", label: "Isometric", command: "view-iso", shortcut: "H", title: "등각 보기로 전환" },
  { id: "view-top", label: "Top", command: "view-top", shortcut: "7", title: "상단 보기로 전환" },
  { id: "view-bottom", label: "Bottom", command: "view-bottom", shortcut: "2", title: "하단 보기로 전환" },
  { id: "view-front", label: "Front", command: "view-front", shortcut: "1", title: "전면 보기로 전환" },
  { id: "view-back", label: "Back", command: "view-back", shortcut: "4", title: "후면 보기로 전환" },
  { id: "view-left", label: "Left", command: "view-left", shortcut: "5", title: "좌측 보기로 전환" },
  { id: "view-right", label: "Right", command: "view-right", shortcut: "3 / 6", title: "우측 보기로 전환" },
] as const;

export const TYPE_VISIBILITY_CONFIGS: Array<{
  key: TypeVisibilityKey;
  label: string;
  color: string;
  enabledTitle: string;
  disabledTitle: string;
}> = [
  {
    key: "spaces",
    label: "Show Spaces",
    color: "#33d9ff",
    enabledTitle: "공간 표시 끄기",
    disabledTitle: "공간 표시 켜기",
  },
  {
    key: "openings",
    label: "Show Openings",
    color: "#ff6b4a",
    enabledTitle: "개구부 표시 끄기",
    disabledTitle: "개구부 표시 켜기",
  },
  {
    key: "site",
    label: "Show Site",
    color: "#66cc4d",
    enabledTitle: "Site 표시 끄기",
    disabledTitle: "Site 표시 켜기",
  },
];

function closeAncestorDetails(element: HTMLElement | null) {
  element?.closest("details")?.removeAttribute("open");
}

function MenuTrigger({
  icon,
  label,
  tooltip,
}: {
  icon: ReactNode;
  label: string;
  tooltip: TooltipContentData;
}) {
  return (
    <Tooltip content={tooltip} asChild hideWhenDetailsOpen>
      <summary
        className={getToolbarButtonClassName({ variant: "summary" })}
        aria-label={tooltip.title}
      >
        {icon}
        {label ? <span>{label}</span> : null}
        <ChevronDown size={label ? 12 : 14} />
      </summary>
    </Tooltip>
  );
}

export function ToolbarActionButtons({ actions }: { actions: ToolbarActionConfig[] }) {
  return actions.map((action) => (
    <ToolbarButton
      key={action.id}
      icon={action.icon}
      label={action.label}
      onClick={action.onClick}
      tooltip={action.tooltip}
      variant={action.variant}
      active={action.active}
      disabled={action.disabled}
      className={action.className}
      ariaLabel={action.tooltip.title}
    />
  ));
}

function ToolbarMenuItem({ item }: { item: ToolbarMenuItemConfig }) {
  if (item.kind === "divider") {
    return <hr className="dropdown-divider" />;
  }

  if (item.kind === "check") {
    const handleSelect = (event: ReactMouseEvent<HTMLButtonElement>) => {
      item.onSelect();
      if (item.closeOnSelect) {
        closeAncestorDetails(event.currentTarget);
      }
    };

    const button = (
      <button
        type="button"
        className="dropdown-check"
        onClick={handleSelect}
        aria-label={item.tooltip?.title ?? item.label}
      >
        <span className="dropdown-check-icon" style={{ color: item.color }}>
          {item.checked ? <Check size={14} /> : null}
        </span>
        <span>{item.label}</span>
      </button>
    );

    return item.tooltip ? (
      <Tooltip content={item.tooltip} asChild>
        <span className="tooltip-anchor w-full">{button}</span>
      </Tooltip>
    ) : (
      button
    );
  }

  const handleSelect = (event: ReactMouseEvent<HTMLButtonElement>) => {
    item.onSelect();
    if (item.closeOnSelect) {
      closeAncestorDetails(event.currentTarget);
    }
  };

  const button = (
    <button
      type="button"
      className="dropdown-item"
      onClick={handleSelect}
      disabled={item.disabled}
      aria-label={item.tooltip?.title ?? item.label}
    >
      {item.icon}
      <span>{item.label}</span>
      {item.shortcut ? <span className="dropdown-shortcut">{item.shortcut}</span> : null}
    </button>
  );

  return item.tooltip ? (
    <Tooltip content={item.tooltip} asChild>
      <span className="tooltip-anchor w-full">{button}</span>
    </Tooltip>
  ) : (
    button
  );
}

export function ToolbarMenu({ menu }: { menu: ToolbarMenuConfig }) {
  if (menu.items.length === 0) {
    return null;
  }

  return (
    <details className="relative">
      <MenuTrigger icon={menu.icon} label={menu.label} tooltip={menu.tooltip} />
      <div className="dropdown">
        {menu.items.map((item) => (
          <ToolbarMenuItem key={item.id} item={item} />
        ))}
      </div>
    </details>
  );
}
