import type { IfcSpatialNode } from '@/types/worker-messages';
import type { EntitySummary } from '@/types/hierarchy';
import { formatIfcType, getNodeName } from './treeHelpers';

// --- Entity data collection ---

export function buildEntityNameMap(nodes: IfcSpatialNode[], result = new Map<number, string>()) {
  for (const node of nodes) {
    const name = getNodeName(node);
    if (name) result.set(node.expressID, name);
    node.elements?.forEach((el) => { if (el.name) result.set(el.expressID, el.name); });
    buildEntityNameMap(node.children, result);
  }
  return result;
}

export function collectSpatialEntities(nodes: IfcSpatialNode[], result = new Map<number, EntitySummary>()) {
  for (const node of nodes) {
    // Include the spatial node itself (it may have rendered geometry)
    if (!result.has(node.expressID)) {
      const label = node.name ?? `${formatIfcType(node.type)} #${node.expressID}`;
      result.set(node.expressID, { expressId: node.expressID, ifcType: node.type, name: node.name ?? null, label });
    }
    node.elements?.forEach((element) => {
      if (result.has(element.expressID)) return;
      const label = element.name ?? `${formatIfcType(element.ifcType)} #${element.expressID}`;
      result.set(element.expressID, { expressId: element.expressID, ifcType: element.ifcType, name: element.name ?? null, label });
    });
    collectSpatialEntities(node.children, result);
  }
  return result;
}

export interface SpatialNodeMetrics {
  totalElementCount: number;
}

export function buildSpatialMetrics(nodes: IfcSpatialNode[], result = new Map<number, SpatialNodeMetrics>()) {
  const visit = (node: IfcSpatialNode) => {
    let totalElementCount = node.elements?.length ?? 0;
    node.children.forEach((child) => { totalElementCount += visit(child).totalElementCount; });
    const metrics = { totalElementCount };
    result.set(node.expressID, metrics);
    return metrics;
  };
  nodes.forEach((node) => visit(node));
  return result;
}

export function collectNodeEntityIds(
  node: IfcSpatialNode, renderableEntityIds: Set<number>, bucket = new Set<number>(),
) {
  if (renderableEntityIds.has(node.expressID)) bucket.add(node.expressID);
  node.elements?.forEach((el) => bucket.add(el.expressID));
  node.children.forEach((child) => collectNodeEntityIds(child, renderableEntityIds, bucket));
  return [...bucket];
}

export function collectRenderableNodeEntityIds(
  node: IfcSpatialNode, renderableEntityIds: Set<number>, result = new Set<number>(),
) {
  if (renderableEntityIds.has(node.expressID)) result.add(node.expressID);
  node.elements?.forEach((el) => { if (renderableEntityIds.has(el.expressID)) result.add(el.expressID); });
  node.children.forEach((child) => collectRenderableNodeEntityIds(child, renderableEntityIds, result));
  return result;
}

export interface StoreyInfo {
  expressID: number;
  name: string;
  elevation: number | null;
}

export function collectStoreys(nodes: IfcSpatialNode[]): StoreyInfo[] {
  const result: StoreyInfo[] = [];
  for (const node of nodes) {
    if (node.type === 'IFCBUILDINGSTOREY') {
      result.push({ expressID: node.expressID, name: node.name ?? `Storey #${node.expressID}`, elevation: node.elevation ?? null });
    }
    result.push(...collectStoreys(node.children));
  }
  return result;
}
