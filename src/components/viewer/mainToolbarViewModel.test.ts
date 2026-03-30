import { describe, expect, it } from "vitest";
import { buildMainToolbarSections } from "./mainToolbarViewModel";
import type {
  ToolbarActionConfig,
  ToolbarMenuConfig,
} from "./mainToolbarPrimitives";

function createAction(id: string): ToolbarActionConfig {
  return {
    id,
    icon: null,
    label: id,
    onClick: () => {},
    tooltip: { title: id },
  };
}

function createMenu(id: string): ToolbarMenuConfig {
  return {
    id,
    icon: null,
    label: id,
    tooltip: { title: id },
    items: [],
  };
}

describe("mainToolbarViewModel", () => {
  it("builds toolbar sections and omits optional null menus", () => {
    const sections = buildMainToolbarSections({
      engineMenu: createMenu("engine"),
      fileActions: [createAction("open")],
      visibilityActions: [createAction("visibility")],
      cameraActions: [createAction("camera")],
      sectionViewAction: createAction("section"),
      viewMenu: createMenu("view"),
      measureMenu: createMenu("measure"),
      floorplanMenu: null,
      classVisibilityMenu: createMenu("class"),
      panelsMenu: createMenu("panels"),
      exportMenu: createMenu("export"),
      utilityActions: [createAction("utility")],
    });

    expect(sections).toHaveLength(5);
    expect(sections[0]?.menus.map((menu) => menu.id)).toEqual(["engine"]);
    expect(sections[2]?.actions.map((action) => action.id)).toEqual([
      "camera",
      "section",
    ]);
    expect(sections[2]?.menus.map((menu) => menu.id)).toEqual([
      "view",
      "measure",
      "class",
    ]);
    expect(sections[3]?.menus.map((menu) => menu.id)).toEqual(["panels"]);
    expect(sections[4]?.includeThemeSwitch).toBe(true);
  });
});
