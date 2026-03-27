import { useCallback } from "react";
import { ifcWorkerClient } from "@/services/IfcWorkerClient";
import {
  exportIfcBuffer,
  exportElementPropertiesCSV,
  exportSpatialTreeCSV,
  exportSpatialTreeJSON,
} from "@/utils/exportUtils";
import { captureViewportScreenshot } from "@/utils/screenshot";
import type { IfcSpatialNode, PropertySectionKind } from "@/types/worker-messages";
import type { TrackedIfcChange } from "@/stores/slices/changesSlice";
import type { LoadedViewerModel } from "@/stores/slices/dataSlice";
import {
  type ToolbarExportActions,
  type ViewerNotificationPort,
  viewerNotificationPort,
} from "./viewerPorts";

const PROPERTY_EXPORT_SECTIONS: PropertySectionKind[] = [
  "attributes",
  "propertySets",
  "quantitySets",
  "typeProperties",
  "materials",
  "documents",
  "classifications",
  "metadata",
  "relations",
  "inverseRelations",
];

interface ToolbarExportContext {
  currentFileName: string | null;
  currentModelId: number | null;
  currentModelSchema: string | null;
  selectedEntityId: number | null;
  spatialTree: IfcSpatialNode[];
  trackedChanges: TrackedIfcChange[];
  loadedModels: LoadedViewerModel[];
  hasSpatialTree: boolean;
  hasRenderableGeometry: boolean;
  notificationPort?: ViewerNotificationPort;
}

export function useToolbarExportActions(
  ctx: ToolbarExportContext,
): ToolbarExportActions {
  const {
    currentFileName,
    currentModelId,
    currentModelSchema,
    selectedEntityId,
    spatialTree,
    trackedChanges,
    loadedModels,
    hasSpatialTree,
    notificationPort = viewerNotificationPort,
  } = ctx;

  const handleScreenshot = useCallback(() => {
    const viewport = document.querySelector(".viewer-viewport__canvas");
    if (!viewport) {
      notificationPort.error("캡처할 뷰포트가 없습니다");
      return;
    }

    const result = captureViewportScreenshot(viewport as HTMLElement);
    if (result) {
      notificationPort.success("스크린샷이 저장되었습니다");
      return;
    }

    notificationPort.error("캡처할 뷰포트가 없습니다");
  }, [notificationPort]);

  const handleExportJSON = useCallback(() => {
    if (!hasSpatialTree) return;
    exportSpatialTreeJSON(
      spatialTree,
      `${currentFileName ?? "model"}-spatial.json`,
      {
        fileName: currentFileName,
        modelId: currentModelId,
        modelSchema: currentModelSchema,
        primarySelectedEntityId: selectedEntityId,
        exportedAt: new Date().toISOString(),
      },
    );
    notificationPort.success("JSON 파일이 저장되었습니다");
  }, [
    currentFileName,
    currentModelId,
    currentModelSchema,
    hasSpatialTree,
    notificationPort,
    selectedEntityId,
    spatialTree,
  ]);

  const handleExportSpatialCSV = useCallback(() => {
    if (!hasSpatialTree) return;
    exportSpatialTreeCSV(
      spatialTree,
      `${currentFileName ?? "model"}-spatial.csv`,
      {
        fileName: currentFileName,
        modelId: currentModelId,
        modelSchema: currentModelSchema,
        primarySelectedEntityId: selectedEntityId,
        exportedAt: new Date().toISOString(),
      },
    );
    notificationPort.success("공간 트리 CSV 파일이 저장되었습니다");
  }, [
    currentFileName,
    currentModelId,
    currentModelSchema,
    hasSpatialTree,
    notificationPort,
    selectedEntityId,
    spatialTree,
  ]);

  const handleExportPropertiesCSV = useCallback(async () => {
    if (currentModelId === null || selectedEntityId === null) {
      return;
    }

    try {
      const result = await ifcWorkerClient.getPropertiesSections(
        currentModelId,
        selectedEntityId,
        PROPERTY_EXPORT_SECTIONS,
      );
      exportElementPropertiesCSV(
        result.properties,
        `${currentFileName ?? "model"}-entity-${selectedEntityId}-properties.csv`,
        {
          fileName: currentFileName,
          modelId: currentModelId,
          modelSchema: currentModelSchema,
          primarySelectedEntityId: selectedEntityId,
          exportedAt: new Date().toISOString(),
        },
      );
      notificationPort.success("선택 객체 속성 CSV 파일이 저장되었습니다");
    } catch (error) {
      console.error(error);
      notificationPort.error(
        `속성 CSV 내보내기 실패: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`,
      );
    }
  }, [
    currentFileName,
    currentModelId,
    currentModelSchema,
    notificationPort,
    selectedEntityId,
  ]);

  const handleExportActiveIfc = useCallback(async () => {
    if (currentModelId === null) {
      return;
    }

    try {
      const result = await ifcWorkerClient.exportModel(currentModelId);
      exportIfcBuffer(
        result.data,
        `${currentFileName ?? `model-${currentModelId}`}-changed.ifc`,
      );
      notificationPort.success("현재 모델 IFC를 저장했습니다");
    } catch (error) {
      console.error(error);
      notificationPort.error(
        `IFC 저장 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      );
    }
  }, [currentFileName, currentModelId, notificationPort]);

  const handleExportChangedModels = useCallback(async () => {
    const changedModelIds = [
      ...new Set(trackedChanges.map((change) => change.modelId)),
    ];
    if (changedModelIds.length === 0) {
      return;
    }

    try {
      for (const modelId of changedModelIds) {
        const result = await ifcWorkerClient.exportModel(modelId);
        const modelLabel =
          loadedModels.find((model) => model.modelId === modelId)?.fileName ??
          `model-${modelId}`;
        exportIfcBuffer(result.data, `${modelLabel}-changed.ifc`);
      }
      notificationPort.success(
        `${changedModelIds.length}개 변경 IFC를 저장했습니다`,
      );
    } catch (error) {
      console.error(error);
      notificationPort.error(
        `변경 IFC 저장 실패: ${
          error instanceof Error ? error.message : "알 수 없는 오류"
        }`,
      );
    }
  }, [loadedModels, notificationPort, trackedChanges]);

  const handleExportIfcb = useCallback(async () => {
    if (currentModelId === null) return;

    try {
      const result = await ifcWorkerClient.exportIfcb(currentModelId);
      exportIfcBuffer(
        result.data,
        `${currentFileName ?? `model-${currentModelId}`}.ifcb`,
      );
      notificationPort.success("IFCB 파일이 저장되었습니다");
    } catch (error) {
      console.error(error);
      notificationPort.error(
        `IFCB 저장 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      );
    }
  }, [currentFileName, currentModelId, notificationPort]);

  return {
    handleScreenshot,
    handleExportJSON,
    handleExportSpatialCSV,
    handleExportPropertiesCSV,
    handleExportActiveIfc,
    handleExportChangedModels,
    handleExportIfcb,
  };
}
