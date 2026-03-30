import { lazy, Suspense } from "react";
import type { BottomPanelMode, RightPanelMode } from "@/stores/slices/uiSlice";
import { PropertiesPanel } from "./PropertiesPanel";

const BCFPanel = lazy(() =>
  import("./BCFPanel").then((m) => ({ default: m.BCFPanel })),
);
const IDSPanel = lazy(() =>
  import("./IDSPanel").then((m) => ({ default: m.IDSPanel })),
);
const LensPanel = lazy(() =>
  import("./LensPanel").then((m) => ({ default: m.LensPanel })),
);
const ListPanel = lazy(() =>
  import("./lists/ListPanel").then((m) => ({ default: m.ListPanel })),
);
const ScriptPanel = lazy(() =>
  import("./ScriptPanel").then((m) => ({ default: m.ScriptPanel })),
);
const QuantitySplitPanel = lazy(() =>
  import("./QuantitySplitPanel").then((m) => ({ default: m.QuantitySplitPanel })),
);

export function PanelFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center text-text-muted text-sm">
      Loading...
    </div>
  );
}

export function RightPanelContent({ mode }: { mode: RightPanelMode }) {
  switch (mode) {
    case "bcf":
      return (
        <Suspense fallback={<PanelFallback />}>
          <BCFPanel />
        </Suspense>
      );
    case "ids":
      return (
        <Suspense fallback={<PanelFallback />}>
          <IDSPanel />
        </Suspense>
      );
    case "lens":
      return (
        <Suspense fallback={<PanelFallback />}>
          <LensPanel />
        </Suspense>
      );
    case "split":
      return (
        <Suspense fallback={<PanelFallback />}>
          <QuantitySplitPanel />
        </Suspense>
      );
    default:
      return <PropertiesPanel />;
  }
}

export function BottomPanelContent({ mode }: { mode: BottomPanelMode }) {
  switch (mode) {
    case "list":
      return (
        <Suspense fallback={<PanelFallback />}>
          <ListPanel />
        </Suspense>
      );
    case "script":
      return (
        <Suspense fallback={<PanelFallback />}>
          <ScriptPanel />
        </Suspense>
      );
    default:
      return null;
  }
}
