const BSDD_API_BASE = "https://api.bsdd.buildingsmart.org";
const IFC_DICT_URI = "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3";
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface BsddClassProperty {
  name: string;
  uri: string;
  description: string | null;
  dataType: string | null;
  propertySet: string | null;
  allowedValues: { uri?: string; value: string; description?: string }[] | null;
  units: string[] | null;
}

export interface BsddClassInfo {
  uri: string;
  code: string;
  name: string;
  definition: string | null;
  classProperties: BsddClassProperty[];
  relatedIfcEntityNames: string[] | null;
}

interface CacheEntry {
  data: BsddClassInfo | null;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function isCacheValid(entry: CacheEntry | undefined): entry is CacheEntry {
  return entry !== undefined && Date.now() - entry.timestamp < CACHE_TTL_MS;
}

export function buildClassUri(ifcType: string): string {
  return `${IFC_DICT_URI}/class/${ifcType}`;
}

export function buildBsddWebUrl(ifcType: string): string {
  return `https://search.bsdd.buildingsmart.org/uri/buildingsmart/ifc/4.3/class/${ifcType}`;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchBsddClass(ifcType: string): Promise<BsddClassInfo | null> {
  const uri = buildClassUri(ifcType);
  const cached = cache.get(uri);
  if (isCacheValid(cached)) return cached.data;

  const params = new URLSearchParams({
    Uri: uri,
    IncludeClassProperties: "true",
    IncludeClassRelations: "true",
  });

  const data = await fetchJson<BsddClassInfo>(
    `${BSDD_API_BASE}/api/Class/v1?${params.toString()}`,
  );

  if (data && (!data.classProperties || data.classProperties.length === 0)) {
    const propsRes = await fetchJson<{ classProperties: BsddClassProperty[] }>(
      `${BSDD_API_BASE}/api/Class/Properties/v1?${new URLSearchParams({ Uri: uri }).toString()}`,
    );
    if (propsRes?.classProperties) {
      data.classProperties = propsRes.classProperties;
    }
  }

  cache.set(uri, { data, timestamp: Date.now() });
  return data;
}

export function groupPropertiesByPset(
  props: BsddClassProperty[],
): Map<string, BsddClassProperty[]> {
  const groups = new Map<string, BsddClassProperty[]>();
  for (const prop of props) {
    const key = prop.propertySet ?? "Attributes";
    const list = groups.get(key);
    if (list) {
      list.push(prop);
    } else {
      groups.set(key, [prop]);
    }
  }
  return groups;
}

export function isQuantitySet(psetName: string): boolean {
  return psetName.startsWith("Qto_");
}

export function mapBsddDataType(dataType: string | null): string {
  if (!dataType) return "Label";
  const lower = dataType.toLowerCase();
  if (lower === "boolean") return "Boolean";
  if (lower === "real" || lower === "number") return "Real";
  if (lower === "integer") return "Integer";
  if (lower === "character" || lower === "string") return "String";
  return "Label";
}
