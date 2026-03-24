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
    <div className="breadcrumb">
      {path.map((segment, i) => (
        <span key={segment.expressID} className="inline-flex items-center shrink-0">
          {i > 0 && <ChevronRight size={8} strokeWidth={2.5} className="text-text-subtle mx-px" />}
          <button
            type="button"
            className="breadcrumb-item"
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
