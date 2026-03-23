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
    <div className="flex items-center gap-1 px-1 py-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TYPE_FILTER_ENTRIES.map(({ ifcType, label, color }) => {
        const isActive = activeTypeToggles.has(ifcType);
        const isAvailable = availableTypes.has(ifcType) || availableTypes.has(ifcType + 'STANDARDCASE');
        return (
          <button
            key={ifcType}
            type="button"
            className={clsx(
              'inline-flex items-center gap-1 h-[26px] px-1.5 rounded-full border text-[0.62rem] font-bold whitespace-nowrap cursor-pointer shrink-0 transition-colors duration-150',
              isActive
                ? 'border-current text-white shadow-sm'
                : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-600 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-300',
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
