import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { IFC_ICON_CODEPOINTS } from './ifc-icons';
import { TYPE_FILTER_ENTRIES } from './ifcTypeColors';
import { formatIfcType } from './treeDataBuilder';

interface TypeFilterBarProps {
  activeTypeToggles: Set<string>;
  availableTypes: Set<string>;
  onToggleType: (ifcType: string) => void;
  onClearAll: () => void;
}

function resolveIcon(ifcType: string): string {
  const formatted = formatIfcType(ifcType);
  return IFC_ICON_CODEPOINTS[formatted] ?? '\ue8b8';
}

export function TypeFilterBar({ activeTypeToggles, availableTypes, onToggleType, onClearAll }: TypeFilterBarProps) {
  const hasActive = activeTypeToggles.size > 0;

  return (
    <div className="filter-bar">
      {TYPE_FILTER_ENTRIES.map(({ ifcType, label, color }) => {
        const isActive = activeTypeToggles.has(ifcType);
        const isAvailable = availableTypes.has(ifcType) || availableTypes.has(ifcType + 'STANDARDCASE');
        return (
          <button
            key={ifcType}
            type="button"
            className={clsx(
              'filter-chip',
              isActive
                ? 'filter-chip-active'
                : 'filter-chip-inactive',
              !isAvailable && !isActive && 'opacity-30 cursor-default',
            )}
            style={isActive ? { backgroundColor: color, borderColor: color } : undefined}
            onClick={() => isAvailable && onToggleType(ifcType)}
            title={formatIfcType(ifcType)}
            disabled={!isAvailable && !isActive}
          >
            <span className="material-symbols-outlined text-[12px] leading-none select-none">{resolveIcon(ifcType)}</span>
            <span>{label}</span>
          </button>
        );
      })}
      {hasActive && (
        <button
          type="button"
          className="inline-flex items-center justify-center w-[22px] h-[22px] p-0 border-0 rounded-full bg-slate-200/80 text-slate-500 cursor-pointer shrink-0 hover:bg-slate-300 hover:text-slate-700 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600"
          onClick={onClearAll}
          title="Clear all type filters"
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
