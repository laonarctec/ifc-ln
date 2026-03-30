import { useCallback } from "react";
import type { ThreadMode } from "@/types/worker-messages";

interface ToolbarEngineActionsContext {
  initEngine: (threadMode?: ThreadMode) => Promise<void>;
}

export interface ToolbarEngineActions {
  handleInitEngine: () => Promise<void>;
  handleInitEngineST: () => void;
  handleInitEngineMT: () => void;
}

export function useToolbarEngineActions(
  ctx: ToolbarEngineActionsContext,
): ToolbarEngineActions {
  const { initEngine } = ctx;

  const handleInitEngine = useCallback(async () => {
    await initEngine();
  }, [initEngine]);

  const handleInitEngineST = useCallback(() => {
    void initEngine("single");
  }, [initEngine]);

  const handleInitEngineMT = useCallback(() => {
    void initEngine("multi");
  }, [initEngine]);

  return {
    handleInitEngine,
    handleInitEngineST,
    handleInitEngineMT,
  };
}
