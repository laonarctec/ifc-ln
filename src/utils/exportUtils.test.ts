import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IfcElementProperties, IfcSpatialNode } from "@/types/worker-messages";
import {
  exportElementPropertiesCSV,
  exportSpatialTreeCSV,
} from "./exportUtils";

describe("exportUtils", () => {
  let restoreSpies: Array<() => void> = [];
  let capturedBlob: Blob | null = null;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    capturedBlob = null;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: () => "blob:stub",
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: () => {},
    });

    const objectUrlSpy = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      capturedBlob = blob as Blob;
      return "blob:test";
    });
    const revokeObjectUrlSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    restoreSpies = [
      () => objectUrlSpy.mockRestore(),
      () => revokeObjectUrlSpy.mockRestore(),
      () => clickSpy.mockRestore(),
    ];
  });

  afterEach(() => {
    restoreSpies.forEach((restore) => restore());
    restoreSpies = [];
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it("exports selected element properties as CSV", async () => {
    const properties: IfcElementProperties = {
      expressID: 101,
      globalId: "3Fj8lP",
      ifcType: "IfcWall",
      name: "Wall A",
      loadedSections: [],
      attributes: [{ key: "ObjectType", value: "Basic Wall" }],
      propertySets: [
        {
          expressID: 201,
          title: "Pset_WallCommon",
          ifcType: "IfcPropertySet",
          entries: [{ key: "FireRating", value: "2h" }],
        },
      ],
      quantitySets: [],
      typeProperties: [],
      materials: [],
      documents: [],
      classifications: [],
      metadata: [],
      relations: [],
      inverseRelations: [],
    };

    exportElementPropertiesCSV(properties, "wall.csv");

    expect(capturedBlob).toBeTruthy();
    const text = await capturedBlob!.text();
    expect(text).toContain('"basic","Basic","IfcWall","101","GlobalId","3Fj8lP"');
    expect(text).toContain('"attributes","Attributes","IfcWall","101","ObjectType","Basic Wall"');
    expect(text).toContain('"propertySets","Pset_WallCommon","IfcPropertySet","201","FireRating","2h"');
  });

  it("exports spatial tree rows as CSV", async () => {
    const tree: IfcSpatialNode[] = [
      {
        expressID: 1,
        type: "IFCPROJECT",
        name: "Demo Project",
        children: [
          {
            expressID: 2,
            type: "IFCBUILDINGSTOREY",
            name: "Level 01",
            elevation: 3,
            elements: [
              {
                expressID: 101,
                ifcType: "IFCWALL",
                name: "Wall A",
              },
            ],
            children: [],
          },
        ],
      },
    ];

    exportSpatialTreeCSV(tree, "spatial.csv");

    expect(capturedBlob).toBeTruthy();
    const text = await capturedBlob!.text();
    expect(text).toContain('"record_type","path","node_ifc_type","node_express_id"');
    expect(text).toContain('"node","Demo Project / Level 01","IFCBUILDINGSTOREY","2","Level 01","3","","",""');
    expect(text).toContain('"element","Demo Project / Level 01","IFCBUILDINGSTOREY","2","Level 01","3","IFCWALL","101","Wall A"');
  });
});
