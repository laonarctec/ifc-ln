import type { IfcSpatialNode } from '@/types/worker-messages';

export function exportSpatialTreeJSON(tree: IfcSpatialNode[], filename = 'model-spatial-tree.json') {
  const json = JSON.stringify(tree, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
