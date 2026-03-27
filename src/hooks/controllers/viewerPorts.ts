import { addToast } from "@/components/ui/Toast";
import type { TrackedIfcChange } from "@/stores/slices/changesSlice";
import type {
  IfcPropertyEntry,
  PropertySectionKind,
} from "@/types/worker-messages";

export interface ViewerNotificationPort {
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
}

export interface PropertyMutationActions {
  applyEntryChange: (
    entry: IfcPropertyEntry,
    sectionKind: PropertySectionKind,
    sectionTitle: string,
    nextValue: string,
  ) => Promise<void>;
  revertChange: (change: TrackedIfcChange) => Promise<void>;
}

export interface ToolbarExportActions {
  handleScreenshot: () => void;
  handleExportJSON: () => void;
  handleExportSpatialCSV: () => void;
  handleExportPropertiesCSV: () => Promise<void>;
  handleExportActiveIfc: () => Promise<void>;
  handleExportChangedModels: () => Promise<void>;
  handleExportIfcb: () => Promise<void>;
}

export const viewerNotificationPort: ViewerNotificationPort = {
  success: (message, durationMs) => addToast("success", message, durationMs),
  error: (message, durationMs) => addToast("error", message, durationMs),
  info: (message, durationMs) => addToast("info", message, durationMs),
};
