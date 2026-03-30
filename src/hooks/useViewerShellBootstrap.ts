import { useEffect } from "react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useThemeSync } from "@/hooks/useThemeSync";
import { useWebIfc } from "@/hooks/useWebIfc";
import { useWebIfcPropertySync } from "@/hooks/useWebIfcPropertySync";

export function useViewerShellBootstrap(theme: "light" | "dark") {
  const { initEngine } = useWebIfc();

  useWebIfcPropertySync();
  useKeyboardShortcuts();
  useThemeSync(theme);

  useEffect(() => {
    void initEngine();
  }, [initEngine]);
}
