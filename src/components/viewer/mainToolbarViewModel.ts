import type {
  ToolbarActionConfig,
  ToolbarMenuConfig,
} from "./mainToolbarPrimitives";

export interface MainToolbarSection {
  id: string;
  actions: ToolbarActionConfig[];
  menus: ToolbarMenuConfig[];
  includeThemeSwitch?: boolean;
}

interface BuildMainToolbarSectionsOptions {
  engineMenu: ToolbarMenuConfig;
  fileActions: ToolbarActionConfig[];
  visibilityActions: ToolbarActionConfig[];
  cameraActions: ToolbarActionConfig[];
  viewMenu: ToolbarMenuConfig;
  measureMenu: ToolbarMenuConfig;
  clippingMenu: ToolbarMenuConfig;
  floorplanMenu: ToolbarMenuConfig | null;
  classVisibilityMenu: ToolbarMenuConfig | null;
  exportMenu: ToolbarMenuConfig;
  utilityActions: ToolbarActionConfig[];
}

function compactMenus(
  ...menus: Array<ToolbarMenuConfig | null | undefined>
): ToolbarMenuConfig[] {
  return menus.filter((menu): menu is ToolbarMenuConfig => menu != null);
}

export function buildMainToolbarSections({
  engineMenu,
  fileActions,
  visibilityActions,
  cameraActions,
  viewMenu,
  measureMenu,
  clippingMenu,
  floorplanMenu,
  classVisibilityMenu,
  exportMenu,
  utilityActions,
}: BuildMainToolbarSectionsOptions): MainToolbarSection[] {
  return [
    {
      id: "engine-file",
      actions: fileActions,
      menus: [engineMenu],
    },
    {
      id: "visibility",
      actions: visibilityActions,
      menus: [],
    },
    {
      id: "camera-tools",
      actions: cameraActions,
      menus: compactMenus(
        viewMenu,
        measureMenu,
        clippingMenu,
        floorplanMenu,
        classVisibilityMenu,
      ),
    },
    {
      id: "utility",
      actions: utilityActions,
      menus: [exportMenu],
      includeThemeSwitch: true,
    },
  ];
}
