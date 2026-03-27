import { useCallback } from "react";
import { ifcWorkerClient } from "@/services/IfcWorkerClient";
import type { TrackedIfcChange } from "@/stores/slices/changesSlice";
import type { IfcElementProperties, IfcPropertyEntry, PropertySectionKind } from "@/types/worker-messages";
import { getChangeKey } from "@/components/viewer/properties/propertyChangeUtils";
import {
  type PropertyMutationActions,
  type ViewerNotificationPort,
  viewerNotificationPort,
} from "./viewerPorts";

interface PropertyMutationContext {
  currentModelId: number | null;
  selectedEntityId: number | null;
  selectedEntityChangeMap: Map<string, TrackedIfcChange>;
  mergeSelectedProperties: (selectedProperties: IfcElementProperties) => void;
  upsertTrackedChange: (change: TrackedIfcChange) => void;
  removeTrackedChange: (
    modelId: number,
    change: Parameters<(typeof ifcWorkerClient)["updatePropertyValue"]>[1],
  ) => void;
  notificationPort?: ViewerNotificationPort;
}

export function usePropertyMutationActions(
  ctx: PropertyMutationContext,
): PropertyMutationActions {
  const {
    currentModelId,
    selectedEntityId,
    selectedEntityChangeMap,
    mergeSelectedProperties,
    upsertTrackedChange,
    removeTrackedChange,
    notificationPort = viewerNotificationPort,
  } = ctx;

  const applyEntryChange = useCallback(
    async (
      entry: IfcPropertyEntry,
      sectionKind: PropertySectionKind,
      sectionTitle: string,
      nextValue: string,
    ) => {
      if (
        currentModelId === null ||
        selectedEntityId === null ||
        !entry.target ||
        !entry.editable
      ) {
        return;
      }

      try {
        const existingChange =
          selectedEntityChangeMap.get(getChangeKey(entry) ?? "") ?? null;
        const change = {
          entityExpressId: selectedEntityId,
          sectionKind,
          sectionTitle,
          entryKey: entry.key,
          target: entry.target,
          valueType: entry.valueType ?? "string",
          nextValue,
        } as const;
        const result = await ifcWorkerClient.updatePropertyValue(
          currentModelId,
          change,
        );
        mergeSelectedProperties(result.properties);
        upsertTrackedChange({
          modelId: currentModelId,
          ...change,
          originalValue: existingChange?.originalValue ?? entry.value,
          currentValue: nextValue,
          updatedAt: new Date().toISOString(),
        });
        notificationPort.success(`${entry.key} 값을 갱신했습니다`);
      } catch (error) {
        console.error(error);
        notificationPort.error(
          `속성 수정 실패: ${
            error instanceof Error ? error.message : "알 수 없는 오류"
          }`,
        );
      }
    },
    [
      currentModelId,
      mergeSelectedProperties,
      notificationPort,
      selectedEntityChangeMap,
      selectedEntityId,
      upsertTrackedChange,
    ],
  );

  const revertChange = useCallback(
    async (change: TrackedIfcChange) => {
      try {
        const result = await ifcWorkerClient.updatePropertyValue(change.modelId, {
          entityExpressId: change.entityExpressId,
          sectionKind: change.sectionKind,
          sectionTitle: change.sectionTitle,
          entryKey: change.entryKey,
          target: change.target,
          valueType: change.valueType,
          nextValue: change.originalValue,
        });
        if (change.modelId === currentModelId) {
          mergeSelectedProperties(result.properties);
        }
        removeTrackedChange(change.modelId, change);
        notificationPort.success(`${change.entryKey} 변경을 되돌렸습니다`);
      } catch (error) {
        console.error(error);
        notificationPort.error(
          `변경 되돌리기 실패: ${
            error instanceof Error ? error.message : "알 수 없는 오류"
          }`,
        );
      }
    },
    [currentModelId, mergeSelectedProperties, notificationPort, removeTrackedChange],
  );

  return {
    applyEntryChange,
    revertChange,
  };
}
