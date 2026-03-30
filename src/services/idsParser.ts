/**
 * IDS (Information Delivery Specification) XML parser.
 * Parses IDS XML files into a structured specification tree.
 */

export interface IdsFacet {
  type: "entity" | "attribute" | "property" | "classification" | "material";
  entityName?: string;
  predefinedType?: string;
  attributeName?: string;
  attributeValue?: string;
  propertySetName?: string;
  propertyName?: string;
  propertyValue?: string;
  system?: string;
  value?: string;
  materialValue?: string;
}

export interface IdsRequirement extends IdsFacet {
  use: "required" | "optional" | "prohibited";
  instructions?: string;
}

export interface IdsSpecification {
  name: string;
  description: string;
  ifcVersion: string[];
  applicability: IdsFacet[];
  requirements: IdsRequirement[];
}

export interface IdsInfo {
  title: string;
  copyright?: string;
  version?: string;
  description?: string;
  author?: string;
  date?: string;
  purpose?: string;
  milestone?: string;
}

export interface IdsDocument {
  info: IdsInfo;
  specifications: IdsSpecification[];
}

function getText(parent: Element, tag: string): string {
  return parent.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";
}

function getSimpleValueOrRestriction(el: Element): string {
  const simpleValue = el.getElementsByTagName("simpleValue")[0];
  if (simpleValue) return simpleValue.textContent?.trim() ?? "";

  const restriction = el.getElementsByTagName("xs:restriction")[0];
  if (restriction) {
    const enumeration = restriction.getElementsByTagName("xs:enumeration")[0];
    if (enumeration) return enumeration.getAttribute("value") ?? "";
    const pattern = restriction.getElementsByTagName("xs:pattern")[0];
    if (pattern) return pattern.getAttribute("value") ?? "";
  }
  return "";
}

function parseFacet(el: Element): IdsFacet | null {
  const tag = el.localName || el.tagName;

  switch (tag) {
    case "entity": {
      const nameEl = el.getElementsByTagName("name")[0];
      return {
        type: "entity",
        entityName: nameEl ? getSimpleValueOrRestriction(nameEl) : "",
        predefinedType: getText(el, "predefinedType") || undefined,
      };
    }
    case "attribute": {
      const nameEl = el.getElementsByTagName("name")[0];
      const valueEl = el.getElementsByTagName("value")[0];
      return {
        type: "attribute",
        attributeName: nameEl ? getSimpleValueOrRestriction(nameEl) : "",
        attributeValue: valueEl ? getSimpleValueOrRestriction(valueEl) : undefined,
      };
    }
    case "property": {
      const psetEl = el.getElementsByTagName("propertySet")[0];
      const nameEl = el.getElementsByTagName("baseName")[0] ?? el.getElementsByTagName("name")[0];
      const valueEl = el.getElementsByTagName("value")[0];
      return {
        type: "property",
        propertySetName: psetEl ? getSimpleValueOrRestriction(psetEl) : "",
        propertyName: nameEl ? getSimpleValueOrRestriction(nameEl) : "",
        propertyValue: valueEl ? getSimpleValueOrRestriction(valueEl) : undefined,
      };
    }
    case "classification": {
      const systemEl = el.getElementsByTagName("system")[0];
      const valueEl = el.getElementsByTagName("value")[0];
      return {
        type: "classification",
        system: systemEl ? getSimpleValueOrRestriction(systemEl) : "",
        value: valueEl ? getSimpleValueOrRestriction(valueEl) : undefined,
      };
    }
    case "material": {
      const valueEl = el.getElementsByTagName("value")[0];
      return {
        type: "material",
        materialValue: valueEl ? getSimpleValueOrRestriction(valueEl) : undefined,
      };
    }
    default:
      return null;
  }
}

function parseRequirement(el: Element): IdsRequirement | null {
  const facet = parseFacet(el);
  if (!facet) return null;

  return {
    ...facet,
    use: (el.getAttribute("use") as IdsRequirement["use"]) ?? "required",
    instructions: el.getAttribute("instructions") ?? undefined,
  };
}

export function parseIdsXml(xml: string): IdsDocument {
  const doc = new DOMParser().parseFromString(xml, "text/xml");

  // Parse info
  const infoEl = doc.getElementsByTagName("info")[0];
  const info: IdsInfo = {
    title: infoEl ? getText(infoEl, "title") : "IDS Document",
    copyright: infoEl ? getText(infoEl, "copyright") || undefined : undefined,
    version: infoEl ? getText(infoEl, "version") || undefined : undefined,
    description: infoEl ? getText(infoEl, "description") || undefined : undefined,
    author: infoEl ? getText(infoEl, "author") || undefined : undefined,
    date: infoEl ? getText(infoEl, "date") || undefined : undefined,
    purpose: infoEl ? getText(infoEl, "purpose") || undefined : undefined,
    milestone: infoEl ? getText(infoEl, "milestone") || undefined : undefined,
  };

  // Parse specifications
  const specifications: IdsSpecification[] = [];
  const specEls = doc.getElementsByTagName("specification");

  for (const specEl of specEls) {
    const name = specEl.getAttribute("name") ?? "Unnamed";
    const description = specEl.getAttribute("description") ?? "";
    const ifcVersion = (specEl.getAttribute("ifcVersion") ?? "IFC4").split(" ");

    const applicability: IdsFacet[] = [];
    const applicabilityEl = specEl.getElementsByTagName("applicability")[0];
    if (applicabilityEl) {
      for (const child of applicabilityEl.children) {
        const facet = parseFacet(child);
        if (facet) applicability.push(facet);
      }
    }

    const requirements: IdsRequirement[] = [];
    const requirementsEl = specEl.getElementsByTagName("requirements")[0];
    if (requirementsEl) {
      for (const child of requirementsEl.children) {
        const req = parseRequirement(child);
        if (req) requirements.push(req);
      }
    }

    specifications.push({
      name,
      description,
      ifcVersion,
      applicability,
      requirements,
    });
  }

  return { info, specifications };
}
