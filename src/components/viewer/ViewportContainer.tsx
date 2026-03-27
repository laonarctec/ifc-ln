import { clsx } from "clsx";
import { useViewportController } from "@/hooks/controllers/useViewportController";
import { ContextMenu } from "./ContextMenu";
import { HoverTooltip } from "./HoverTooltip";
import { ViewportNotifications } from "./ViewportNotifications";
import { ViewportScene } from "./ViewportScene";

export function ViewportContainer() {
  const ctrl = useViewportController();

  return (
    <section className="viewport">
      <div className="viewport-label">Viewport</div>
      <div className="relative flex-auto h-full min-h-0 w-full overflow-hidden bg-transparent">
        {ctrl.visibleManifest ? (
          <ViewportScene
            manifest={ctrl.visibleManifest}
            manifests={ctrl.manifests}
            residentChunks={ctrl.residentChunks}
            chunkVersion={ctrl.geometryVersion}
            selectedModelId={ctrl.selectedModelId}
            selectedEntityIds={ctrl.selectedEntityIds}
            selectedEntityKeys={ctrl.selectedEntityKeys}
            hiddenEntityKeys={ctrl.combinedHiddenKeys}
            colorOverrides={ctrl.colorOverrides}
            projectionMode={ctrl.viewportProjectionMode}
            viewportCommand={ctrl.viewportCommand}
            onSelectEntity={ctrl.handleSelectEntity}
            onVisibleChunkIdsChange={ctrl.handleVisibleChunkIdsChange}
            onHoverEntity={ctrl.handleHoverEntity}
            onContextMenu={ctrl.handleContextMenu}
            onBoxSelect={ctrl.handleBoxSelect}
          />
        ) : (
          <div className={clsx("viewport-empty", ctrl.emptyToneClassName)}>
            <h1 className="m-0 text-text text-[clamp(1.9rem,3vw,2.6rem)] leading-[1.05] dark:text-slate-100">
              {ctrl.emptyState.title}
            </h1>
            <p className="m-0 max-w-160 text-text-secondary">
              {ctrl.emptyState.description}
            </p>
            <p className="m-0 max-w-160 text-text-secondary">
              {ctrl.emptyState.hint}
            </p>
          </div>
        )}
        <ViewportNotifications />
        {ctrl.hoverTooltipsEnabled &&
        ctrl.hoverInfo &&
        ctrl.hoverSummary &&
        !ctrl.contextMenu ? (
          <HoverTooltip
            entityId={ctrl.hoverInfo.expressId}
            ifcType={ctrl.hoverSummary.ifcType}
            name={ctrl.hoverSummary.name}
            x={ctrl.hoverInfo.x}
            y={ctrl.hoverInfo.y}
          />
        ) : null}
        {ctrl.contextMenu ? (
          <ContextMenu
            menu={ctrl.contextMenu}
            onClose={ctrl.closeContextMenu}
            onHide={ctrl.handleContextMenuHide}
            onIsolate={ctrl.handleContextMenuIsolate}
            onShowAll={ctrl.handleContextMenuShowAll}
            onFitSelected={ctrl.handleContextMenuFitSelected}
          />
        ) : null}
      </div>
    </section>
  );
}
