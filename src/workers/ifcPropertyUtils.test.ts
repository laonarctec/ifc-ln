import { describe, expect, it, vi } from "vitest";
import {
  createAssociationSections,
  createMetadataSections,
} from "./ifcPropertyUtils";

describe("createAssociationSections", () => {
  it("extracts document and classification sections from HasAssociations", async () => {
    const getLine = vi.fn(
      (
        _modelId: number,
        expressId: number,
        recursive?: boolean,
        inverse?: boolean,
        inversePropKey?: string | null,
      ) => {
        if (expressId === 101 && inverse && inversePropKey === "HasAssociations") {
          return {
            HasAssociations: [{ value: 500 }, { value: 501 }, { value: 500 }],
          };
        }

        if (expressId === 500) {
          return {
            expressID: 500,
            type: "IfcRelAssociatesDocument",
            RelatingDocument: { value: 700 },
          };
        }

        if (expressId === 501) {
          return {
            expressID: 501,
            type: "IfcRelAssociatesClassification",
            RelatingClassification: { value: 800 },
          };
        }

        if (expressId === 700 && recursive) {
          return {
            expressID: 700,
            type: "IfcDocumentInformation",
            Name: { value: "Door Schedule" },
            Identification: { value: "DOC-01" },
            Location: { value: "/docs/door-schedule.pdf" },
          };
        }

        if (expressId === 800 && recursive) {
          return {
            expressID: 800,
            type: "IfcClassificationReference",
            Name: { value: "OmniClass 23" },
            Identification: { value: "23-17 11 00" },
            Location: { value: "https://example.test/classifications/23-17-11-00" },
          };
        }

        return null;
      },
    );

    const api = { GetLine: getLine };

    const documents = await createAssociationSections(
      api,
      1,
      101,
      "IfcRelAssociatesDocument",
      "RelatingDocument",
      "Document",
    );
    const classifications = await createAssociationSections(
      api,
      1,
      101,
      "IfcRelAssociatesClassification",
      "RelatingClassification",
      "Classification",
    );

    expect(documents).toHaveLength(1);
    expect(documents[0].title).toBe("Door Schedule");
    expect(documents[0].entries).toEqual(
      expect.arrayContaining([
        { key: "Identification", value: "DOC-01" },
        { key: "Location", value: "/docs/door-schedule.pdf" },
      ]),
    );

    expect(classifications).toHaveLength(1);
    expect(classifications[0].title).toBe("OmniClass 23");
    expect(classifications[0].entries).toEqual(
      expect.arrayContaining([
        { key: "Identification", value: "23-17 11 00" },
      ]),
    );
  });
});

describe("createMetadataSections", () => {
  it("groups summary fields and reference fields into separate sections", () => {
    const sections = createMetadataSections({
      expressID: 42,
      type: "IfcWall",
      Description: { value: "외벽" },
      ObjectType: { value: "Basic Wall" },
      PredefinedType: { value: "STANDARD" },
      Tag: { value: "W-01" },
      ObjectPlacement: { value: 11 },
      Representation: { value: 12 },
    });

    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe("Entity Metadata");
    expect(sections[0].entries).toEqual(
      expect.arrayContaining([
        { key: "Description", value: "외벽" },
        { key: "ObjectType", value: "Basic Wall" },
        { key: "PredefinedType", value: "STANDARD" },
      ]),
    );
    expect(sections[1].title).toBe("Placement & Representation");
    expect(sections[1].entries).toEqual(
      expect.arrayContaining([
        { key: "ObjectPlacement", value: "11" },
        { key: "Representation", value: "12" },
      ]),
    );
  });
});
