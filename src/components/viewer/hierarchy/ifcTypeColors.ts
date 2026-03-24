/** IFC type → unique color mapping for visual identification in hierarchy tree */

const IFC_TYPE_COLORS: Record<string, string> = {
  IFCWALL: '#3b82f6',
  IFCWALLSTANDARDCASE: '#3b82f6',
  IFCWALLELEMENTEDCASE: '#3b82f6',
  IFCSLAB: '#6b7280',
  IFCSLABSTANDARDCASE: '#6b7280',
  IFCSLABELEMENTEDCASE: '#6b7280',
  IFCDOOR: '#f97316',
  IFCDOORSTANDARDCASE: '#f97316',
  IFCWINDOW: '#06b6d4',
  IFCWINDOWSTANDARDCASE: '#06b6d4',
  IFCCOLUMN: '#ef4444',
  IFCCOLUMNSTANDARDCASE: '#ef4444',
  IFCBEAM: '#92400e',
  IFCBEAMSTANDARDCASE: '#92400e',
  IFCROOF: '#22c55e',
  IFCSTAIR: '#a855f7',
  IFCSTAIRFLIGHT: '#a855f7',
  IFCRAILING: '#ec4899',
  IFCCURTAINWALL: '#14b8a6',
  IFCFURNISHINGELEMENT: '#eab308',
  IFCFURNITURE: '#eab308',
  IFCFOOTING: '#78716c',
  IFCPLATE: '#64748b',
  IFCMEMBER: '#64748b',
  IFCCOVERING: '#a3a3a3',
  IFCSPACE: '#d1d5db',
  IFCOPENINGELEMENT: '#fbbf24',
  IFCFLOWSEGMENT: '#0ea5e9',
  IFCFLOWTERMINAL: '#0284c7',
  IFCFLOWFITTING: '#0369a1',
  IFCBUILDINGSTOREY: '#6366f1',
  IFCBUILDING: '#4f46e5',
  IFCSITE: '#059669',
  IFCPROJECT: '#1e40af',
};

const DEFAULT_COLOR = '#94a3b8';

export function getIfcTypeColor(ifcType: string | undefined): string {
  if (!ifcType) return DEFAULT_COLOR;
  const upper = ifcType.toUpperCase();
  return IFC_TYPE_COLORS[upper]
    ?? IFC_TYPE_COLORS[upper.replace(/STANDARDCASE$|ELEMENTEDCASE$/, '')]
    ?? DEFAULT_COLOR;
}

/** Subset of common types shown in the TypeFilterBar */
export const TYPE_FILTER_ENTRIES = [
  { ifcType: 'IFCWALL', label: 'Wall', color: '#3b82f6' },
  { ifcType: 'IFCSLAB', label: 'Slab', color: '#6b7280' },
  { ifcType: 'IFCDOOR', label: 'Door', color: '#f97316' },
  { ifcType: 'IFCWINDOW', label: 'Window', color: '#06b6d4' },
  { ifcType: 'IFCCOLUMN', label: 'Column', color: '#ef4444' },
  { ifcType: 'IFCBEAM', label: 'Beam', color: '#92400e' },
  { ifcType: 'IFCROOF', label: 'Roof', color: '#22c55e' },
  { ifcType: 'IFCSTAIR', label: 'Stair', color: '#a855f7' },
  { ifcType: 'IFCRAILING', label: 'Rail', color: '#ec4899' },
  { ifcType: 'IFCCURTAINWALL', label: 'Curtain', color: '#14b8a6' },
  { ifcType: 'IFCFURNITURE', label: 'Furn', color: '#eab308' },
  { ifcType: 'IFCPLATE', label: 'Plate', color: '#64748b' },
] as const;
