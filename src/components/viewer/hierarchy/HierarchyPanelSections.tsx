import { FilterChip } from "@/components/ui/FilterChip";
import { COUNT_FORMATTER } from "@/types/hierarchy";
import { formatIfcType } from "./treeDataBuilder";

interface StoreyScopeSectionProps {
  activeStoreyFilter: number | null;
  activeStoreyLabel: string | null;
  activeStoreyEntityCount: number;
  onClearStoreyFilter: () => void;
  onStoreyScopeSelect: () => void;
  onStoreyScopeIsolate: () => void;
}

export function StoreyScopeSection({
  activeStoreyFilter,
  activeStoreyLabel,
  activeStoreyEntityCount,
  onClearStoreyFilter,
  onStoreyScopeSelect,
  onStoreyScopeIsolate,
}: StoreyScopeSectionProps) {
  if (activeStoreyFilter === null) {
    return null;
  }

  return (
    <>
      <div className="storey-filter">
        <span className="text-[0.72rem] tracking-[0.06em] uppercase text-text-muted">
          Active Storey
        </span>
        <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-text text-[0.85rem] dark:text-slate-100">
          {activeStoreyLabel ?? `#${activeStoreyFilter}`}
        </strong>
        <button
          type="button"
          className="h-6 px-2 border border-blue-500/22 rounded bg-white/90 text-blue-700 text-[0.7rem] font-bold cursor-pointer"
          onClick={onClearStoreyFilter}
        >
          Clear
        </button>
      </div>
      <div className="grid gap-2 p-2.5 px-3 border border-border-subtle bg-slate-50/96">
        <div>
          <strong className="block text-text text-[0.72rem] leading-[1.1] dark:text-slate-100">
            Storey Scope
          </strong>
          <small className="block mt-0.5 text-text-muted text-[0.64rem] leading-[1.15] dark:text-slate-400">
            {activeStoreyEntityCount > 0
              ? `${COUNT_FORMATTER.format(activeStoreyEntityCount)} entities in scope`
              : "No renderable entities in this storey"}
          </small>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="btn-scope" onClick={onStoreyScopeSelect}>
            Select
          </button>
          <button
            type="button"
            className="btn-scope"
            onClick={onStoreyScopeIsolate}
            disabled={activeStoreyEntityCount === 0}
          >
            Isolate
          </button>
          <button type="button" className="btn-scope" onClick={onClearStoreyFilter}>
            Clear Scope
          </button>
        </div>
      </div>
    </>
  );
}

interface SemanticFilterBarProps {
  activeClassFilter: string | null;
  activeTypeFilter: string | null;
  onClearClassFilter: () => void;
  onClearTypeFilter: () => void;
  onClearAll: () => void;
}

export function SemanticFilterBar({
  activeClassFilter,
  activeTypeFilter,
  onClearClassFilter,
  onClearTypeFilter,
  onClearAll,
}: SemanticFilterBarProps) {
  if (activeClassFilter === null && activeTypeFilter === null) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-t border-border bg-white/92 dark:border-slate-700 dark:bg-slate-900/92">
      <div className="flex flex-wrap gap-1.5 min-w-0">
        {activeClassFilter !== null && (
          <FilterChip
            active
            className="min-w-0 max-w-full"
            onClick={onClearClassFilter}
          >
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              Class · {formatIfcType(activeClassFilter)}
            </span>
            <small className="text-[0.62rem] font-bold">Clear</small>
          </FilterChip>
        )}
        {activeTypeFilter !== null && (
          <FilterChip
            active
            className="min-w-0 max-w-full"
            onClick={onClearTypeFilter}
          >
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
              Type · {formatIfcType(activeTypeFilter)}
            </span>
            <small className="text-[0.62rem] font-bold">Clear</small>
          </FilterChip>
        )}
      </div>
      <FilterChip className="ml-auto whitespace-nowrap" onClick={onClearAll}>
        Clear All
      </FilterChip>
    </div>
  );
}
