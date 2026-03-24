import type { IfcSpatialNode } from '@/types/worker-messages';
import { COUNT_FORMATTER } from '@/types/hierarchy';

// --- Formatting ---

export function formatIfcType(type: string) {
  if (!type || type === 'EMPTY') return 'Empty';
  if (type.startsWith('IFC')) {
    return `Ifc${type.slice(3).toLowerCase().replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())}`.replace(/\s/g, '');
  }
  return type;
}

export function getNodeElevation(node: IfcSpatialNode) {
  const n = node as IfcSpatialNode & { elevation?: number; Elevation?: number | { value?: number } };
  if (typeof n.elevation === 'number') return n.elevation;
  if (typeof n.Elevation === 'number') return n.Elevation;
  if (typeof n.Elevation === 'object' && n.Elevation !== null && typeof n.Elevation.value === 'number') return n.Elevation.value;
  return null;
}

export function formatElevation(value: number | null) {
  if (value === null || Number.isNaN(value)) return null;
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  return `${normalized >= 0 ? '+' : ''}${normalized.toFixed(2)}m`;
}

export function formatCount(count: number, suffix: string) {
  return `${COUNT_FORMATTER.format(count)} ${suffix}`;
}

// --- Node name ---

export function getNodeName(node: IfcSpatialNode | null | undefined) {
  if (!node) return null;
  const n = node as IfcSpatialNode & { name?: string; Name?: string | { value?: string }; longName?: string; LongName?: string | { value?: string } };
  const candidates = [n.name, n.longName, n.Name, n.LongName];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (typeof value === 'object' && value !== null && 'value' in value) {
      const v = value.value;
      if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    }
  }
  return null;
}

// --- Tree navigation ---

export function collectExpandedIds(
  nodes: IfcSpatialNode[], depthLimit: number, depth = 0, ids = new Set<number>(),
) {
  for (const node of nodes) {
    if (node.children.length > 0 && depth < depthLimit) {
      ids.add(node.expressID);
      collectExpandedIds(node.children, depthLimit, depth + 1, ids);
    }
  }
  return ids;
}

export function filterNodes(nodes: IfcSpatialNode[], query: string): IfcSpatialNode[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return nodes;

  const filtered: IfcSpatialNode[] = [];
  nodes.forEach((node) => {
    const filteredChildren = filterNodes(node.children, q);
    const filteredElements = node.elements?.filter((el) => {
      const label = `${el.ifcType} ${el.expressID} ${el.name ?? ''}`.toLowerCase();
      return label.includes(q);
    }) ?? [];
    const label = `${node.type} ${node.expressID} ${getNodeName(node) ?? ''}`.toLowerCase();
    if (label.includes(q) || filteredChildren.length > 0 || filteredElements.length > 0) {
      filtered.push({ ...node, children: filteredChildren, elements: filteredElements.length > 0 ? filteredElements : node.elements });
    }
  });
  return filtered;
}

export function countNodes(nodes: IfcSpatialNode[]): number {
  return nodes.reduce((c, n) => c + 1 + (n.elements?.length ?? 0) + countNodes(n.children), 0);
}

export function findNodeById(nodes: IfcSpatialNode[], targetId: number): IfcSpatialNode | null {
  for (const node of nodes) {
    if (node.expressID === targetId) return node;
    const child = findNodeById(node.children, targetId);
    if (child) return child;
  }
  return null;
}

export function matchesSearch(query: string, ...values: Array<string | null | undefined>) {
  if (query.length === 0) return true;
  return values.some((value) => value?.toLowerCase().includes(query));
}

// --- Spatial path (breadcrumb) ---

export interface SpatialPathSegment {
  expressID: number;
  name: string;
  type: string;
}

export function buildSpatialPath(
  nodes: IfcSpatialNode[],
  targetEntityId: number,
  path: SpatialPathSegment[] = [],
): SpatialPathSegment[] | null {
  for (const node of nodes) {
    const segment: SpatialPathSegment = {
      expressID: node.expressID,
      name: getNodeName(node) ?? formatIfcType(node.type),
      type: node.type,
    };
    const nextPath = [...path, segment];

    if (node.expressID === targetEntityId) return nextPath;

    if (node.elements?.some((el) => el.expressID === targetEntityId)) {
      const el = node.elements.find((e) => e.expressID === targetEntityId)!;
      return [...nextPath, { expressID: el.expressID, name: el.name ?? `#${el.expressID}`, type: el.ifcType }];
    }

    const childResult = buildSpatialPath(node.children, targetEntityId, nextPath);
    if (childResult) return childResult;
  }
  return null;
}
