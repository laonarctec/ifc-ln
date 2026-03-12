import { useEffect, useRef } from 'react';
import { Group, Panel, Separator, type PanelImperativeHandle } from 'react-resizable-panels';
import { useWebIfc } from '@/hooks/useWebIfc';
import { useWebIfcPropertySync } from '@/hooks/useWebIfcPropertySync';
import { MainToolbar } from './MainToolbar';
import { HierarchyPanel } from './HierarchyPanel';
import { ViewportContainer } from './ViewportContainer';
import { PropertiesPanel } from './PropertiesPanel';
import { StatusBar } from './StatusBar';
import { useViewerStore } from '@/stores';

export function ViewerLayout() {
  const leftPanelCollapsed = useViewerStore((state) => state.leftPanelCollapsed);
  const rightPanelCollapsed = useViewerStore((state) => state.rightPanelCollapsed);
  const setLeftPanelCollapsed = useViewerStore((state) => state.setLeftPanelCollapsed);
  const setRightPanelCollapsed = useViewerStore((state) => state.setRightPanelCollapsed);
  const { initEngine } = useWebIfc();
  useWebIfcPropertySync();
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null);
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null);

  useEffect(() => {
    void initEngine();
  }, [initEngine]);

  useEffect(() => {
    const panel = leftPanelRef.current;
    if (!panel) {
      return;
    }

    if (leftPanelCollapsed && !panel.isCollapsed()) {
      panel.collapse();
      return;
    }

    if (!leftPanelCollapsed && panel.isCollapsed()) {
      panel.expand();
    }
  }, [leftPanelCollapsed]);

  useEffect(() => {
    const panel = rightPanelRef.current;
    if (!panel) {
      return;
    }

    if (rightPanelCollapsed && !panel.isCollapsed()) {
      panel.collapse();
      return;
    }

    if (!rightPanelCollapsed && panel.isCollapsed()) {
      panel.expand();
    }
  }, [rightPanelCollapsed]);

  return (
    <main className="viewer-shell">
      <MainToolbar />
      <Group orientation="horizontal" className="viewer-content">
        <Panel
          id="viewer-left-panel"
          panelRef={leftPanelRef}
          defaultSize={21}
          minSize={14}
          collapsible
          collapsedSize={0}
          onResize={() => {
            const panel = leftPanelRef.current;
            if (panel) {
              setLeftPanelCollapsed(panel.isCollapsed());
            }
          }}
        >
          <div className="viewer-panel-slot viewer-panel-slot--left">
            <HierarchyPanel />
          </div>
        </Panel>
        <Separator className="viewer-resize-handle" />
        <Panel id="viewer-viewport-panel" defaultSize={57} minSize={28}>
          <div className="viewer-viewport-slot">
            <ViewportContainer />
          </div>
        </Panel>
        <Separator className="viewer-resize-handle" />
        <Panel
          id="viewer-right-panel"
          panelRef={rightPanelRef}
          defaultSize={22}
          minSize={15}
          collapsible
          collapsedSize={0}
          onResize={() => {
            const panel = rightPanelRef.current;
            if (panel) {
              setRightPanelCollapsed(panel.isCollapsed());
            }
          }}
        >
          <div className="viewer-panel-slot viewer-panel-slot--right">
            <PropertiesPanel />
          </div>
        </Panel>
      </Group>
      <StatusBar />
    </main>
  );
}
