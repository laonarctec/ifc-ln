import { Boxes, Building2, FolderTree, Layers3 } from "lucide-react";
import type { ReactNode } from "react";
import type { PanelSegmentedControlOption } from "../PanelSegmentedControl";

export type HierarchyGroupingMode = "spatial" | "class" | "type";

export const HIERARCHY_GROUPING_OPTIONS: readonly PanelSegmentedControlOption<HierarchyGroupingMode>[] =
  [
    {
      value: "spatial",
      label: "Spatial",
      icon: <Building2 size={14} strokeWidth={2} />,
      title: "Spatial",
    },
    {
      value: "class",
      label: "Class",
      icon: <Layers3 size={14} strokeWidth={2} />,
      title: "Class",
    },
    {
      value: "type",
      label: "Type",
      icon: <Boxes size={14} strokeWidth={2} />,
      title: "Type",
    },
  ] as const;

export interface HierarchyEmptyStateConfig {
  icon: ReactNode;
  description: string;
}

export function getHierarchySearchPlaceholder(
  groupingMode: HierarchyGroupingMode,
) {
  switch (groupingMode) {
    case "spatial":
      return "Search hierarchy...";
    case "class":
      return "Search classes or entities...";
    case "type":
      return "Search type groups or entities...";
  }
}

export function getHierarchyEmptyState(
  groupingMode: HierarchyGroupingMode,
): HierarchyEmptyStateConfig {
  switch (groupingMode) {
    case "spatial":
      return {
        icon: <FolderTree size={16} strokeWidth={2} />,
        description: "검색 결과가 없습니다.",
      };
    case "class":
      return {
        icon: <Layers3 size={16} strokeWidth={2} />,
        description: "표시할 클래스가 없습니다.",
      };
    case "type":
      return {
        icon: <Boxes size={16} strokeWidth={2} />,
        description: "표시할 타입 그룹이 없습니다.",
      };
  }
}

export function getHierarchyFooterSummary(
  groupingMode: HierarchyGroupingMode,
  hasSpatialTree: boolean,
) {
  switch (groupingMode) {
    case "spatial":
      return hasSpatialTree ? "Spatial tree synced" : "Spatial tree idle";
    case "class":
      return "By IFC class";
    case "type":
      return "By IfcType relation";
  }
}
