import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import type { IfcSpatialNode } from '@/types/worker-messages';
import { buildSpatialPath, type SpatialPathSegment } from './treeHelpers';
import { getIfcTypeColor } from './ifcTypeColors';

interface SelectionBreadcrumbProps {
  spatialTree: IfcSpatialNode[];
  selectedEntityId: number | null;
  onNavigate: (expressId: number) => void;
}

export function SelectionBreadcrumb({ spatialTree, selectedEntityId, onNavigate }: SelectionBreadcrumbProps) {
  const path = useMemo<SpatialPathSegment[] | null>(
    () => (selectedEntityId !== null ? buildSpatialPath(spatialTree, selectedEntityId) : null),
    [spatialTree, selectedEntityId],
  );

  if (!path || path.length === 0) return null;

  return (
    <div className="flex items-center gap-0 h-6 px-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-border bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40">
      {path.map((segment, i) => (
        <span key={segment.expressID} className="inline-flex items-center shrink-0">
          {i > 0 && <ChevronRight size={8} strokeWidth={2.5} className="text-text-subtle mx-px" />}
          <button
            type="button"
            className="inline-flex items-center gap-0.5 px-1 border-0 rounded-sm bg-transparent text-[0.58rem] font-medium cursor-pointer whitespace-nowrap hover:bg-primary/8 hover:text-primary-text text-text-muted dark:text-slate-400 dark:hover:bg-blue-500/12"
            onClick={() => onNavigate(segment.expressID)}
            title={`${segment.type} · ${segment.name} · #${segment.expressID}`}
          >
            <span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: getIfcTypeColor(segment.type) }} />
            <span className="max-w-[80px] overflow-hidden text-ellipsis">{segment.name}</span>
          </button>
        </span>
      ))}
    </div>
  );
}
