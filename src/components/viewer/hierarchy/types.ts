import type { IfcSpatialNode } from '@/types/worker-messages';

export type NodeType =
  | 'IfcProject'
  | 'IfcSite'
  | 'IfcBuilding'
  | 'IfcBuildingStorey'
  | 'IfcSpace'
  | 'type-group'
  | 'type-family'
  | 'element'
  | 'reset';

export interface TreeNode {
  id: string;
  expressId: number;
  entityIds: number[];
  name: string;
  type: NodeType;
  ifcType?: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  badges?: string[];
  meta?: string | null;
  subtitle?: string | null;
  elementCount?: number;
  storeyElevation?: number | null;
  typeBadge?: string | null;
  spatialNode?: IfcSpatialNode;
}

export interface EntitySummary {
  expressId: number;
  ifcType: string;
  name: string | null;
  label: string;
}

export type GroupingMode = 'spatial' | 'class' | 'type';

export const ROW_HEIGHT = 32;
export const OVERSCAN = 12;
export const COUNT_FORMATTER = new Intl.NumberFormat();
