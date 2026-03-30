import { Group, Panel, Separator } from "react-resizable-panels";
import { useViewerLayoutController } from "@/hooks/controllers/useViewerLayoutController";
import { MainToolbar } from "./MainToolbar";
import { HierarchyPanel } from "./HierarchyPanel";
import { StatusBar } from "./StatusBar";
import { ViewportContainer } from "./ViewportContainer";
import { BottomPanelContent, RightPanelContent } from "./ViewerLayoutPanels";

export function ViewerLayout() {
  const ctrl = useViewerLayoutController();
  const hasBottomPanel = ctrl.bottomPanelMode !== "none";

  return (
    <main className="grid h-screen grid-rows-[52px_minmax(0,1fr)_40px]">
      <MainToolbar />
      <div className="flex min-h-0 flex-col">
        <Group orientation="horizontal" className="viewer-content min-h-0 flex-1">
          <Panel
            id="viewer-left-panel"
            panelRef={ctrl.leftPanelRef}
            defaultSize={21}
            minSize={14}
            collapsible
            collapsedSize={0}
            onResize={ctrl.handleLeftPanelResize}
          >
            <div className="flex h-full min-h-0 w-full min-w-0 overflow-hidden dark:bg-slate-900">
              <HierarchyPanel />
            </div>
          </Panel>
          <Separator className="viewer-resize-handle" />
          <Panel id="viewer-viewport-panel" defaultSize={57} minSize={28}>
            <div className="flex h-full min-h-0 w-full min-w-0 overflow-hidden">
              <ViewportContainer />
            </div>
          </Panel>
          <Separator className="viewer-resize-handle" />
          <Panel
            id="viewer-right-panel"
            panelRef={ctrl.rightPanelRef}
            defaultSize={22}
            minSize={15}
            collapsible
            collapsedSize={0}
            onResize={ctrl.handleRightPanelResize}
          >
            <div className="flex h-full min-h-0 w-full min-w-0 overflow-hidden dark:bg-slate-900">
              <RightPanelContent mode={ctrl.rightPanelMode} />
            </div>
          </Panel>
        </Group>

        {hasBottomPanel ? (
          <div className="h-[280px] shrink-0 border-t border-border-subtle dark:border-slate-700">
            <BottomPanelContent mode={ctrl.bottomPanelMode} />
          </div>
        ) : null}
      </div>
      <StatusBar />
    </main>
  );
}
