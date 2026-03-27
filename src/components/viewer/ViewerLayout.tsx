import { Group, Panel, Separator } from "react-resizable-panels";
import { useViewerLayoutController } from "@/hooks/controllers/useViewerLayoutController";
import { MainToolbar } from "./MainToolbar";
import { HierarchyPanel } from "./HierarchyPanel";
import { ViewportContainer } from "./ViewportContainer";
import { PropertiesPanel } from "./PropertiesPanel";
import { StatusBar } from "./StatusBar";

export function ViewerLayout() {
  const ctrl = useViewerLayoutController();

  return (
    <main className="grid h-screen grid-rows-[52px_minmax(0,1fr)_40px] dark:from-slate-900 dark:to-slate-800">
      <MainToolbar />
      <Group orientation="horizontal" className="viewer-content">
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
            <PropertiesPanel />
          </div>
        </Panel>
      </Group>
      <StatusBar />
    </main>
  );
}
