import type { IfcElementProperties, IfcPropertySection, IfcSpatialNode } from '@/types/worker-messages';

export interface ExportContext {
  fileName: string | null;
  modelId: number | null;
  modelSchema: string | null;
  primarySelectedEntityId: number | null;
  exportedAt: string;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportIfcBuffer(
  data: ArrayBuffer,
  filename = 'model.ifc',
) {
  downloadBlob(new Blob([data], { type: 'application/octet-stream' }), filename);
}

function escapeCsvValue(value: string | number | null | undefined) {
  const normalized = value === null || value === undefined ? '' : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function buildCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n');
}

function buildContextRows(context?: ExportContext) {
  if (!context) {
    return [];
  }

  return [
    ['context', 'Export', '', '', 'fileName', context.fileName ?? ''],
    ['context', 'Export', '', '', 'modelId', context.modelId ?? ''],
    ['context', 'Export', '', '', 'modelSchema', context.modelSchema ?? ''],
    ['context', 'Export', '', '', 'primarySelectedEntityId', context.primarySelectedEntityId ?? ''],
    ['context', 'Export', '', '', 'exportedAt', context.exportedAt],
  ] satisfies Array<Array<string | number | null | undefined>>;
}

export function exportSpatialTreeJSON(
  tree: IfcSpatialNode[],
  filename = 'model-spatial-tree.json',
  context?: ExportContext,
) {
  const json = JSON.stringify(context ? { meta: context, tree } : tree, null, 2);
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

export function exportSpatialTreeCSV(
  tree: IfcSpatialNode[],
  filename = 'model-spatial-tree.csv',
  context?: ExportContext,
) {
  const rows: Array<Array<string | number | null | undefined>> = [
    ['record_type', 'path', 'node_ifc_type', 'node_express_id', 'node_name', 'node_elevation', 'element_ifc_type', 'element_express_id', 'element_name'],
    ...(
      context
        ? [
            ['meta', 'Context', 'fileName', '', context.fileName ?? '', '', '', '', ''],
            ['meta', 'Context', 'modelId', '', context.modelId ?? '', '', '', '', ''],
            ['meta', 'Context', 'modelSchema', '', context.modelSchema ?? '', '', '', '', ''],
            ['meta', 'Context', 'primarySelectedEntityId', '', context.primarySelectedEntityId ?? '', '', '', '', ''],
            ['meta', 'Context', 'exportedAt', '', context.exportedAt, '', '', '', ''],
          ]
        : []
    ),
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
  context?: ExportContext,
) {
  const rows: Array<Array<string | number | null | undefined>> = [
    ['category', 'section_title', 'section_ifc_type', 'section_express_id', 'key', 'value'],
    ...buildContextRows(context),
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
