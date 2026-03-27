import { useMemo } from "react";
import { useViewerStore } from "@/stores";
import { createModelEntityKey, type ModelEntityKey } from "@/utils/modelEntity";
import type { LoadedViewerModel } from "@/stores/slices/dataSlice";
import type { IfcSpatialNode } from "@/types/worker-messages";

interface LensCandidate {
  modelId: number;
  modelLabel: string;
  expressId: number;
  ifcType: string;
  name: string;
  storeyName: string;
  changed: boolean;
}

function collectStoreyLookup(
  nodes: IfcSpatialNode[],
  activeStoreyName = "",
  result = new Map<number, string>(),
) {
  for (const node of nodes) {
    const nextStoreyName =
      node.type === "IFCBUILDINGSTOREY"
        ? node.name ?? `Storey #${node.expressID}`
        : activeStoreyName;

    result.set(node.expressID, nextStoreyName);
    node.elements?.forEach((element) => {
      result.set(element.expressID, nextStoreyName);
    });
    collectStoreyLookup(node.children, nextStoreyName, result);
  }

  return result;
}

function collectLensCandidates(models: LoadedViewerModel[], changedKeys: Set<ModelEntityKey>) {
  return models.flatMap((model) => {
    const storeyLookup = collectStoreyLookup(model.spatialTree);
    const candidates: LensCandidate[] = [];

    const visit = (nodes: IfcSpatialNode[]) => {
      nodes.forEach((node) => {
        const nodeKey = createModelEntityKey(model.modelId, node.expressID);
        candidates.push({
          modelId: model.modelId,
          modelLabel: model.fileName,
          expressId: node.expressID,
          ifcType: node.type,
          name: node.name ?? "",
          storeyName: storeyLookup.get(node.expressID) ?? "",
          changed: changedKeys.has(nodeKey),
        });

        node.elements?.forEach((element) => {
          const elementKey = createModelEntityKey(model.modelId, element.expressID);
          candidates.push({
            modelId: model.modelId,
            modelLabel: model.fileName,
            expressId: element.expressID,
            ifcType: element.ifcType,
            name: element.name ?? "",
            storeyName: storeyLookup.get(element.expressID) ?? "",
            changed: changedKeys.has(elementKey),
          });
        });

        visit(node.children);
      });
    };

    visit(model.spatialTree);
    return candidates;
  });
}

function matches(operator: "is" | "contains", source: string, value: string) {
  const normalizedSource = source.trim().toLowerCase();
  const normalizedValue = value.trim().toLowerCase();

  if (operator === "is") {
    return normalizedSource === normalizedValue;
  }

  return normalizedSource.includes(normalizedValue);
}

export function useLensEffects() {
  const loadedModels = useViewerStore((state) => state.loadedModels);
  const lensRules = useViewerStore((state) => state.lensRules);
  const trackedChanges = useViewerStore((state) => state.trackedChanges);

  return useMemo(() => {
    const changedKeys = new Set<ModelEntityKey>(
      trackedChanges.map((change) =>
        createModelEntityKey(change.modelId, change.entityExpressId),
      ),
    );
    const candidates = collectLensCandidates(loadedModels, changedKeys);
    const hiddenKeys = new Set<ModelEntityKey>();
    const colorOverrides = new Map<ModelEntityKey, string>();

    candidates.forEach((candidate) => {
      const entityKey = createModelEntityKey(candidate.modelId, candidate.expressId);

      lensRules.forEach((rule) => {
        if (!rule.enabled) {
          return;
        }
        if (rule.modelId !== null && rule.modelId !== candidate.modelId) {
          return;
        }

        const source =
          rule.field === "model"
            ? candidate.modelLabel
            : rule.field === "ifcType"
              ? candidate.ifcType
              : rule.field === "name"
                ? candidate.name
                : rule.field === "storey"
                  ? candidate.storeyName
                  : candidate.changed
                    ? "changed"
                    : "";

        if (!matches(rule.operator, source, rule.value)) {
          return;
        }

        if (rule.action === "hide") {
          hiddenKeys.add(entityKey);
          return;
        }

        colorOverrides.set(entityKey, rule.color);
      });
    });

    return {
      hiddenKeys,
      colorOverrides,
      matchedEntityCount: new Set([
        ...hiddenKeys,
        ...colorOverrides.keys(),
      ]).size,
    };
  }, [lensRules, loadedModels, trackedChanges]);
}
