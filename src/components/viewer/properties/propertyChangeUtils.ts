import type { IfcPropertyEntry } from "@/types/worker-messages";

export function getChangeKey(entry: IfcPropertyEntry) {
  if (!entry.target) {
    return null;
  }

  return `${entry.target.lineExpressId}:${entry.target.attributeName}`;
}
