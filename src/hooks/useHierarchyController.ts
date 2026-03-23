import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ifcWorkerClient } from '@/services/IfcWorkerClient';
import { useViewportGeometry } from '@/services/viewportGeometryStore';
import { useViewerStore } from '@/stores';
import type { IfcSpatialNode } from '@/types/worker-messages';
import type { TreeNode } from '@/types/hierarchy';
import {
  collectNodeEntityIds,
  collectSpatialEntities,
  findNodeById,
  getNodeName,
} from '@/components/viewer/hierarchy/treeDataBuilder';
import { useHierarchyPanelData } from '@/components/viewer/hierarchy/useHierarchyPanelData';
import { useHierarchyTree } from '@/components/viewer/hierarchy/useHierarchyTree';

export function useHierarchyController() {
  const store = useViewerStore(useShallow((state) => ({
    selectedEntityId: state.selectedEntityId,
    selectedEntityIds: state.selectedEntityIds,
    setSelectedEntityId: state.setSelectedEntityId,
    setSelectedEntityIds: state.setSelectedEntityIds,
    toggleSelectedEntityId: state.toggleSelectedEntityId,
    clearSelection: state.clearSelection,
    hiddenEntityIds: state.hiddenEntityIds,
    hideEntity: state.hideEntity,
    showEntity: state.showEntity,
    resetHiddenEntities: state.resetHiddenEntities,
    setIsolation: state.setIsolation,
    clearIsolation: state.clearIsolation,
    runViewportCommand: state.runViewportCommand,
    setActiveClassFilter: state.setActiveClassFilter,
    setActiveTypeFilter: state.setActiveTypeFilter,
    setActiveStoreyFilter: state.setActiveStoreyFilter,
    activeTypeToggles: state.activeTypeToggles,
    toggleIfcTypeFilter: state.toggleIfcTypeFilter,
    clearIfcTypeFilters: state.clearIfcTypeFilters,
  })));

  const {
    selectedEntityId, selectedEntityIds, setSelectedEntityId, setSelectedEntityIds,
    toggleSelectedEntityId, clearSelection, hiddenEntityIds, hideEntity, showEntity,
    resetHiddenEntities, setIsolation, clearIsolation, runViewportCommand,
    setActiveClassFilter, setActiveTypeFilter, setActiveStoreyFilter,
    activeTypeToggles, toggleIfcTypeFilter, clearIfcTypeFilters,
  } = store;

  const {
    currentModelId, spatialTree, typeTree,
    activeClassFilter, activeTypeFilter, activeStoreyFilter,
  } = useHierarchyPanelData();

  const { manifest } = useViewportGeometry();

  // --- Derived data ---
  const entities = useMemo(() => collectSpatialEntities(spatialTree), [spatialTree]);
  const entityIds = useMemo(() => [...entities.keys()], [entities]);
  const entityIdSet = useMemo(() => new Set(entityIds), [entityIds]);
  const selectedEntityIdSet = useMemo(() => new Set(selectedEntityIds), [selectedEntityIds]);
  const [selectedSpatialNodeIds, setSelectedSpatialNodeIds] = useState<Set<number>>(() => new Set());

  // --- Tree ---
  const tree = useHierarchyTree({
    spatialTree, typeTree,
    selectedEntityIds: selectedEntityIdSet,
    entityIdSet,
  });

  // --- Type tree lazy loading ---
  useEffect(() => {
    if (tree.groupingMode !== 'type' || currentModelId === null || typeTree.length > 0) return;
    const ids = [...collectSpatialEntities(spatialTree).keys()];
    if (ids.length === 0) return;
    let cancelled = false;
    void ifcWorkerClient.getTypeTree(currentModelId, ids).then((result) => {
      if (!cancelled) useViewerStore.getState().setTypeTree(result.groups);
    }).catch((error) => console.error(error));
    return () => { cancelled = true; };
  }, [tree.groupingMode, currentModelId, spatialTree, typeTree.length]);

  // --- Storey scope ---
  const activeStoreyNode = useMemo(
    () => (activeStoreyFilter === null ? null : findNodeById(spatialTree, activeStoreyFilter)),
    [activeStoreyFilter, spatialTree],
  );
  const activeStoreyLabel = useMemo(() => {
    if (!activeStoreyNode) return null;
    return getNodeName(activeStoreyNode) ?? `Storey #${activeStoreyNode.expressID}`;
  }, [activeStoreyNode]);
  const activeStoreyEntityIds = useMemo(
    () => (activeStoreyNode ? collectNodeEntityIds(activeStoreyNode, entityIdSet) : []),
    [activeStoreyNode, entityIdSet],
  );

  // --- Filters ---
  const hasActiveFilters = activeStoreyFilter !== null || activeClassFilter !== null || activeTypeFilter !== null;

  const clearSemanticFilters = useCallback(() => {
    setActiveClassFilter(null);
    setActiveTypeFilter(null);
    setActiveStoreyFilter(null);
    clearIsolation();
  }, [setActiveClassFilter, setActiveTypeFilter, setActiveStoreyFilter, clearIsolation]);

  const clearStoreyFilter = useCallback(() => {
    setActiveStoreyFilter(null);
  }, [setActiveStoreyFilter]);

  // ESC key to clear filters
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && hasActiveFilters) {
        e.preventDefault();
        clearSemanticFilters();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasActiveFilters, clearSemanticFilters]);

  // --- Entity selection ---
  const handleEntitySelection = useCallback((entityId: number | null, additive = false) => {
    if (entityId === null) { setSelectedSpatialNodeIds(new Set()); clearSelection(); return; }
    if (additive) { toggleSelectedEntityId(entityId); return; }
    setSelectedSpatialNodeIds(new Set());
    setSelectedEntityId(entityId);
  }, [clearSelection, setSelectedEntityId, toggleSelectedEntityId]);

  const handleSpatialNodeSelection = useCallback((nodeId: number, additive = false) => {
    setSelectedSpatialNodeIds((current) => {
      const next = additive ? new Set(current) : new Set<number>();
      if (additive && next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  }, []);

  const handleSpatialNodeClick = useCallback((node: IfcSpatialNode, targetEntityId: number | null, additive = false) => {
    handleSpatialNodeSelection(node.expressID, additive);

    // Container nodes (Project, Site, Building, Storey): select all child entities
    const isContainer = node.children.length > 0 || (node.elements?.length ?? 0) > 0;
    if (isContainer) {
      const childIds = collectNodeEntityIds(node, entityIdSet);
      if (childIds.length > 0) {
        if (additive) {
          const current = new Set(useViewerStore.getState().selectedEntityIds);
          childIds.forEach((id) => current.add(id));
          setSelectedEntityIds([...current]);
        } else {
          setSelectedEntityIds(childIds);
        }
      }
    } else {
      handleEntitySelection(targetEntityId ?? node.expressID, additive);
    }

    // Storey filter toggle
    if (node.type === 'IFCBUILDINGSTOREY') {
      const isToggleOff = activeStoreyFilter === node.expressID;
      setActiveStoreyFilter(isToggleOff ? null : node.expressID);
    }
  }, [handleSpatialNodeSelection, handleEntitySelection, activeStoreyFilter, setActiveStoreyFilter,
    entityIdSet, setSelectedEntityIds]);

  // --- Node click (dispatches by node type) ---
  const handleNodeClick = useCallback((node: TreeNode, event: React.MouseEvent) => {
    const additive = event.shiftKey;
    if (node.spatialNode) {
      const primaryEntityId = entityIdSet.has(node.expressId) ? node.expressId : node.entityIds[0] ?? null;
      handleSpatialNodeClick(node.spatialNode, primaryEntityId, additive);
      return;
    }
    if (node.type === 'type-group' && tree.groupingMode === 'class') {
      if (node.entityIds.length > 0) {
        setSelectedEntityIds(node.entityIds);
        setActiveClassFilter(node.ifcType ?? null);
        setActiveTypeFilter(null);
      }
      tree.toggleExpand(node.id); return;
    }
    if (node.type === 'type-group' && tree.groupingMode === 'type') {
      if (node.entityIds.length > 0) {
        setSelectedEntityIds(node.entityIds);
        setActiveTypeFilter(node.ifcType ?? null);
        setActiveClassFilter(null);
      }
      tree.toggleExpand(node.id); return;
    }
    if (node.type === 'type-family') {
      if (node.entityIds.length > 0) {
        setSelectedEntityIds(node.entityIds);
        setActiveTypeFilter(node.ifcType ?? null);
        setActiveClassFilter(null);
      }
      tree.toggleExpand(node.id); return;
    }
    if (node.type === 'element') { handleEntitySelection(node.expressId, additive); return; }
    tree.toggleExpand(node.id);
  }, [entityIdSet, handleSpatialNodeClick, tree, setActiveClassFilter, setActiveTypeFilter, handleEntitySelection, setSelectedEntityIds]);

  // --- Group actions ---
  const handleGroupIsolate = useCallback((targetEntityIds: number[]) => {
    setSelectedSpatialNodeIds(new Set());
    clearSemanticFilters();
    setSelectedEntityIds(targetEntityIds);
    setIsolation(targetEntityIds);
  }, [clearSemanticFilters, setSelectedEntityIds, setIsolation]);

  const handleEntityFocus = useCallback((entityId: number) => {
    handleEntitySelection(entityId);
    runViewportCommand('fit-selected');
  }, [handleEntitySelection, runViewportCommand]);

  const handleResetGroupView = useCallback(() => {
    clearSemanticFilters();
    resetHiddenEntities();
    clearIsolation();
  }, [clearSemanticFilters, resetHiddenEntities, clearIsolation]);

  // --- Visibility ---
  const handleMasterVisibilityToggle = useCallback(() => {
    if (hiddenEntityIds.size > 0) resetHiddenEntities();
    else entityIds.forEach((id) => hideEntity(id));
  }, [hiddenEntityIds.size, resetHiddenEntities, entityIds, hideEntity]);

  const handleVisibilityToggle = useCallback((targetEntityIds: number[]) => {
    if (targetEntityIds.length === 0) return;
    const allHidden = targetEntityIds.every((id) => hiddenEntityIds.has(id));
    if (allHidden) { targetEntityIds.forEach((id) => showEntity(id)); return; }
    targetEntityIds.forEach((id) => hideEntity(id));
    if (selectedEntityIds.some((id) => targetEntityIds.includes(id))) {
      setSelectedEntityIds(selectedEntityIds.filter((id) => !targetEntityIds.includes(id)));
    }
  }, [hiddenEntityIds, showEntity, hideEntity, selectedEntityIds, setSelectedEntityIds]);

  // --- Storey scope actions ---
  const handleStoreyScopeSelect = useCallback(() => {
    if (activeStoreyFilter === null) return;
    if (activeStoreyEntityIds.length > 0) { setSelectedSpatialNodeIds(new Set()); setSelectedEntityIds(activeStoreyEntityIds); return; }
    handleEntitySelection(activeStoreyFilter);
  }, [activeStoreyFilter, activeStoreyEntityIds, setSelectedEntityIds, handleEntitySelection]);

  const handleStoreyScopeIsolate = useCallback(() => {
    if (activeStoreyFilter === null || activeStoreyEntityIds.length === 0) return;
    setSelectedSpatialNodeIds(new Set());
    setActiveClassFilter(null);
    setActiveTypeFilter(null);
    setSelectedEntityIds(activeStoreyEntityIds);
    setIsolation(activeStoreyEntityIds);
  }, [activeStoreyFilter, activeStoreyEntityIds, setActiveClassFilter, setActiveTypeFilter,
    setSelectedEntityIds, setIsolation]);

  // --- Context menu ---
  const [treeContextMenu, setTreeContextMenu] = useState<{ node: TreeNode; x: number; y: number } | null>(null);

  const handleTreeContextMenu = useCallback((node: TreeNode, event: React.MouseEvent) => {
    if (node.type === 'reset') return;
    setTreeContextMenu({ node, x: event.clientX, y: event.clientY });
  }, []);

  const closeTreeContextMenu = useCallback(() => setTreeContextMenu(null), []);

  const handleCtxSelect = useCallback((eIds: number[]) => setSelectedEntityIds(eIds), [setSelectedEntityIds]);
  const handleCtxHide = useCallback((eIds: number[]) => {
    eIds.forEach((id) => hideEntity(id));
    if (selectedEntityIds.some((id) => eIds.includes(id))) {
      setSelectedEntityIds(selectedEntityIds.filter((id) => !eIds.includes(id)));
    }
  }, [hideEntity, selectedEntityIds, setSelectedEntityIds]);
  const handleCtxShow = useCallback((eIds: number[]) => eIds.forEach((id) => showEntity(id)), [showEntity]);
  const handleCtxFocus = useCallback((eIds: number[]) => {
    setSelectedEntityIds(eIds);
    runViewportCommand('fit-selected');
  }, [setSelectedEntityIds, runViewportCommand]);

  return {
    // Data
    selectedEntityId, selectedEntityIds, hiddenEntityIds,
    spatialTree, typeTree, manifest,
    activeClassFilter, activeTypeFilter, activeStoreyFilter,
    activeStoreyLabel, activeStoreyEntityIds,
    hasActiveFilters, selectedSpatialNodeIds, selectedEntityIdSet,
    // Type toggle filter
    activeTypeToggles, toggleIfcTypeFilter, clearIfcTypeFilters,
    // Tree
    ...tree,
    // Handlers
    handleNodeClick, handleGroupIsolate, handleEntityFocus, handleResetGroupView,
    handleMasterVisibilityToggle, handleVisibilityToggle,
    handleStoreyScopeSelect, handleStoreyScopeIsolate,
    clearSemanticFilters, clearStoreyFilter,
    setActiveClassFilter, setActiveTypeFilter,
    // Context menu
    treeContextMenu, handleTreeContextMenu, closeTreeContextMenu,
    handleCtxSelect, handleCtxHide, handleCtxShow, handleCtxFocus,
  };
}
