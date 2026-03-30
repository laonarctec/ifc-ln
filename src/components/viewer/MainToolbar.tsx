import { Fragment } from "react";
import { useMainToolbarController } from "@/hooks/controllers/useMainToolbarController";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { ThemeSwitch } from "./ThemeSwitch";
import { ToolbarActionButtons, ToolbarMenu } from "./mainToolbarPrimitives";
import { buildMainToolbarSections } from "./mainToolbarViewModel";

export function MainToolbar() {
  const ctrl = useMainToolbarController();
  const sections = buildMainToolbarSections({
    engineMenu: ctrl.engineMenu,
    fileActions: ctrl.fileActions,
    visibilityActions: ctrl.visibilityActions,
    cameraActions: ctrl.cameraActions,
    sectionViewAction: ctrl.sectionViewAction,
    quantitySplitAction: ctrl.quantitySplitAction,
    viewMenu: ctrl.viewMenu,
    measureMenu: ctrl.measureMenu,
    floorplanMenu: ctrl.floorplanMenu,
    classVisibilityMenu: ctrl.classVisibilityMenu,
    panelsMenu: ctrl.panelsMenu,
    exportMenu: ctrl.exportMenu,
    utilityActions: ctrl.utilityActions,
  });

  return (
    <header ref={ctrl.toolbarRef} className="toolbar">
      <input
        ref={ctrl.fileInputRef}
        type="file"
        accept=".ifc,.ifcz,.ifcb"
        className="viewer-hidden-input"
        onChange={(event) => {
          void ctrl.handleFileChange(event);
        }}
      />
      <input
        ref={ctrl.addModelInputRef}
        type="file"
        accept=".ifc,.ifcz,.ifcb"
        multiple
        className="viewer-hidden-input"
        onChange={(event) => {
          void ctrl.handleAddModelChange(event);
        }}
      />

      <div className="mx-auto flex max-w-full flex-wrap items-center justify-center gap-2 overflow-visible">
        {ctrl.leftPanelAction ? (
          <>
            <div className="toolbar-group shrink-0">
              <ToolbarActionButtons actions={[ctrl.leftPanelAction]} />
            </div>
            <span className="toolbar-sep" />
          </>
        ) : null}

        {sections.map((section, index) => (
          <Fragment key={section.id}>
            {index > 0 ? <span className="toolbar-sep" /> : null}
            <div className="toolbar-group">
              {section.menus.map((menu) => (
                <ToolbarMenu key={menu.id} menu={menu} />
              ))}
              <ToolbarActionButtons actions={section.actions} />
              {section.includeThemeSwitch ? <ThemeSwitch /> : null}
            </div>
          </Fragment>
        ))}

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
