import type { IfcElementProperties, IfcPropertySection, IfcSpatialNode } from '@/types/worker-messages';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value: string | number | null | undefined) {
  const normalized = value === null || value === undefined ? '' : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function buildCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n');
}

export function exportSpatialTreeJSON(tree: IfcSpatialNode[], filename = 'model-spatial-tree.json') {
  const json = JSON.stringify(tree, null, 2);
  downloadBlob(new Blob([json], { type: 'application/json' }), filename);
}

function flattenSpatialTreeRows(
  nodes: IfcSpatialNode[],
  parentPath = '',
): Array<Array<string | number | null | undefined>> {
  return nodes.flatMap((node) => {
    const nodeName = node.name ?? node.type ?? `#${node.expressID}`;
    const nodePath = parentPath ? `${parentPath} / ${nodeName}` : nodeName;
    const rows: Array<Array<string | number | null | undefined>> = [
      [
        'node',
        nodePath,
        node.type,
        node.expressID,
        node.name ?? '',
        node.elevation ?? '',
        '',
        '',
        '',
      ],
    ];

    for (const element of node.elements ?? []) {
      rows.push([
        'element',
        nodePath,
        node.type,
        node.expressID,
        node.name ?? '',
        node.elevation ?? '',
        element.ifcType,
        element.expressID,
        element.name ?? '',
      ]);
    }

    rows.push(...flattenSpatialTreeRows(node.children, nodePath));
    return rows;
  });
}

export function exportSpatialTreeCSV(tree: IfcSpatialNode[], filename = 'model-spatial-tree.csv') {
  const rows: Array<Array<string | number | null | undefined>> = [
    ['record_type', 'path', 'node_ifc_type', 'node_express_id', 'node_name', 'node_elevation', 'element_ifc_type', 'element_express_id', 'element_name'],
    ...flattenSpatialTreeRows(tree),
  ];
  downloadBlob(new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8' }), filename);
}

function flattenPropertySections(
  category: string,
  sections: IfcPropertySection[],
): Array<Array<string | number | null | undefined>> {
  return sections.flatMap((section) =>
    section.entries.map((entry) => [
      category,
      section.title,
      section.ifcType ?? '',
      section.expressID ?? '',
      entry.key,
      entry.value,
    ]),
  );
}

export function exportElementPropertiesCSV(
  properties: IfcElementProperties,
  filename = 'selected-properties.csv',
) {
  const rows: Array<Array<string | number | null | undefined>> = [
    ['category', 'section_title', 'section_ifc_type', 'section_express_id', 'key', 'value'],
    ['basic', 'Basic', properties.ifcType ?? '', properties.expressID ?? '', 'GlobalId', properties.globalId ?? ''],
    ['basic', 'Basic', properties.ifcType ?? '', properties.expressID ?? '', 'IfcType', properties.ifcType ?? ''],
    ['basic', 'Basic', properties.ifcType ?? '', properties.expressID ?? '', 'Name', properties.name ?? ''],
    ...properties.attributes.map((entry) => [
      'attributes',
      'Attributes',
      properties.ifcType ?? '',
      properties.expressID ?? '',
      entry.key,
      entry.value,
    ]),
    ...flattenPropertySections('propertySets', properties.propertySets),
    ...flattenPropertySections('quantitySets', properties.quantitySets),
    ...flattenPropertySections('typeProperties', properties.typeProperties),
    ...flattenPropertySections('materials', properties.materials),
    ...flattenPropertySections('documents', properties.documents),
    ...flattenPropertySections('classifications', properties.classifications),
    ...flattenPropertySections('metadata', properties.metadata),
    ...flattenPropertySections('relations', properties.relations),
    ...flattenPropertySections('inverseRelations', properties.inverseRelations),
  ];

  downloadBlob(new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8' }), filename);
}
