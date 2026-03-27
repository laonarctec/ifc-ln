import { useMainToolbarController } from "@/hooks/controllers/useMainToolbarController";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { ThemeSwitch } from "./ThemeSwitch";
import { ToolbarActionButtons, ToolbarMenu } from "./mainToolbarPrimitives";

export function MainToolbar() {
  const ctrl = useMainToolbarController();

  return (
    <header ref={ctrl.toolbarRef} className="toolbar">
      <input
        ref={ctrl.fileInputRef}
        type="file"
        accept=".ifc,.ifcz,.ifcb"
        multiple
        className="viewer-hidden-input"
        onChange={(event) => {
          void ctrl.handleFileChange(event);
        }}
      />

      <div className="mx-auto flex max-w-full flex-wrap items-center justify-center gap-3 overflow-visible">
        {ctrl.leftPanelAction ? (
          <>
            <div className="toolbar-group shrink-0">
              <ToolbarActionButtons actions={[ctrl.leftPanelAction]} />
            </div>
            <span className="toolbar-sep" />
          </>
        ) : null}

        <div className="toolbar-group">
          <ToolbarMenu menu={ctrl.engineMenu} />
          <ToolbarActionButtons actions={ctrl.fileActions} />
        </div>

        <span className="toolbar-sep" />

        <div className="toolbar-group">
          <ToolbarActionButtons actions={ctrl.visibilityActions} />
        </div>

        <span className="toolbar-sep" />

        <div className="toolbar-group">
          <ToolbarActionButtons actions={ctrl.cameraActions} />
          <ToolbarMenu menu={ctrl.viewMenu} />
          <ToolbarMenu menu={ctrl.measureMenu} />
          <ToolbarMenu menu={ctrl.clippingMenu} />
          {ctrl.floorplanMenu ? <ToolbarMenu menu={ctrl.floorplanMenu} /> : null}
          {ctrl.classVisibilityMenu ? (
            <ToolbarMenu menu={ctrl.classVisibilityMenu} />
          ) : null}
        </div>

        <span className="toolbar-sep" />

        <div className="toolbar-group">
          <ToolbarMenu menu={ctrl.exportMenu} />
          <ToolbarActionButtons actions={ctrl.utilityActions} />
          <ThemeSwitch />
        </div>

        {ctrl.rightPanelAction ? (
          <>
            <span className="toolbar-sep" />
            <div className="toolbar-group shrink-0">
              <ToolbarActionButtons actions={[ctrl.rightPanelAction]} />
            </div>
          </>
        ) : null}
      </div>

      <KeyboardShortcutsDialog
        open={ctrl.shortcutsOpen}
        onClose={() => ctrl.setShortcutsOpen(false)}
      />
    </header>
  );
}
