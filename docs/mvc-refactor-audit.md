# MVC Refactor Audit

## Scope

This document captures the first-pass MVC refactor audit for the viewer shell in
`ifc-ln`.

## Targets

| File | Current role | Direct dependencies | Local UI state | Side effects | Refactor note |
| --- | --- | --- | --- | --- | --- |
| `src/components/viewer/ViewerLayout.tsx` | Shell layout | `useViewerStore`, `useWebIfc`, `useKeyboardShortcuts`, `useWebIfcPropertySync` | Panel refs | Engine init, panel sync | Move orchestration into `useViewerLayoutController` |
| `src/components/viewer/MainToolbar.tsx` | Toolbar view + action coordinator | `useViewerStore`, `useWebIfc`, `useViewportGeometry`, `addToast`, export hook | Shortcuts dialog, file input ref | File load, engine init, export, visibility commands | Move state/actions into `useMainToolbarController` |
| `src/components/viewer/PropertiesPanel.tsx` | Inspector view + mutation coordinator | `useViewerStore`, `useWebIfc`, `ifcWorkerClient`, `addToast`, `usePropertiesPanelData` | Active tab | Property fetch, property update/revert, model actions | Move data/mutations into `usePropertiesController` |
| `src/components/viewer/ViewportContainer.tsx` | Viewport wrapper + interaction coordinator | `useViewerStore`, `useWebIfc`, `viewportGeometryStore`, viewport hooks | Hover info, context menu | Selection sync, context actions, chunk visibility updates | Move orchestration into `useViewportController` |
| `src/components/viewer/properties/LensRulesCard.tsx` | Lens editor | `useViewerStore` | None | Rule mutation | Keep model in store, replace repeated inline field/button styles with DS primitives |
| `src/components/viewer/HierarchyPanel.tsx` | Tree view | `useHierarchyController` | Scroll ref | Scroll sync | Keep controller pattern, replace repeated inline field/filter/empty styles with DS primitives |

## Notes

- `useHierarchyController` already follows the intended MVC pattern most closely:
  derived data, local ephemeral state, and imperative handlers are all exposed
  through a dedicated hook.
- The primary 1st-pass acceptance rule is that target view files must not import
  `useViewerStore`, `ifcWorkerClient`, `viewportGeometryStore`, or `addToast`
  directly.
- Design-system drift is concentrated in `PropertiesPanel`, `LensRulesCard`, and
  `HierarchyPanel`, where repeated inline `slate`/`blue` utility strings are
  mixed with semantic token classes.
