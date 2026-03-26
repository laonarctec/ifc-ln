import { useCallback } from "react";
import { ifcWorkerClient } from "@/services/IfcWorkerClient";
import { addToast } from "@/components/ui/Toast";
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

interface ExportContext {
  currentFileName: string | null;
  currentModelId: number | null;
  currentModelSchema: string | null;
  selectedEntityId: number | null;
  spatialTree: IfcSpatialNode[];
  trackedChanges: TrackedIfcChange[];
  loadedModels: LoadedViewerModel[];
  hasSpatialTree: boolean;
  hasRenderableGeometry: boolean;
}

export function useToolbarExport(ctx: ExportContext) {
  const {
    currentFileName,
    currentModelId,
    currentModelSchema,
    selectedEntityId,
    spatialTree,
    trackedChanges,
    loadedModels,
    hasSpatialTree,
    hasRenderableGeometry,
  } = ctx;

  const handleScreenshot = useCallback(() => {
    const viewport = document.querySelector(".viewer-viewport__canvas");
    if (!viewport) {
      addToast("error", "캡처할 뷰포트가 없습니다");
      return;
    }

    const result = captureViewportScreenshot(viewport as HTMLElement);
    if (result) {
      addToast("success", "스크린샷이 저장되었습니다");
      return;
    }

    addToast("error", "캡처할 뷰포트가 없습니다");
  }, []);

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
    addToast("success", "JSON 파일이 저장되었습니다");
  }, [currentFileName, currentModelId, currentModelSchema, hasSpatialTree, selectedEntityId, spatialTree]);

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
    addToast("success", "공간 트리 CSV 파일이 저장되었습니다");
  }, [currentFileName, currentModelId, currentModelSchema, hasSpatialTree, selectedEntityId, spatialTree]);

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
      addToast("success", "선택 객체 속성 CSV 파일이 저장되었습니다");
    } catch (error) {
      console.error(error);
      addToast("error", `속성 CSV 내보내기 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    }
  }, [currentFileName, currentModelId, currentModelSchema, selectedEntityId]);

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
      addToast("success", "현재 모델 IFC를 저장했습니다");
    } catch (error) {
      console.error(error);
      addToast("error", `IFC 저장 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    }
  }, [currentFileName, currentModelId]);

  const handleExportChangedModels = useCallback(async () => {
    const changedModelIds = [...new Set(trackedChanges.map((change) => change.modelId))];
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
      addToast("success", `${changedModelIds.length}개 변경 IFC를 저장했습니다`);
    } catch (error) {
      console.error(error);
      addToast("error", `변경 IFC 저장 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    }
  }, [loadedModels, trackedChanges]);

  const handleExportIfcb = useCallback(async () => {
    if (currentModelId === null) return;

    try {
      const result = await ifcWorkerClient.exportIfcb(currentModelId);
      exportIfcBuffer(
        result.data,
        `${currentFileName ?? `model-${currentModelId}`}.ifcb`,
      );
      addToast("success", "IFCB 파일이 저장되었습니다");
    } catch (error) {
      console.error(error);
      addToast("error", `IFCB 저장 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    }
  }, [currentFileName, currentModelId]);

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
