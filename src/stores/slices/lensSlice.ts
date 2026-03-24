import type { StateCreator } from "zustand";

export type LensField = "model" | "ifcType" | "name" | "storey" | "changed";
export type LensOperator = "is" | "contains";
export type LensAction = "hide" | "color";

export interface LensRule {
  id: string;
  enabled: boolean;
  modelId: number | null;
  field: LensField;
  operator: LensOperator;
  value: string;
  action: LensAction;
  color: string;
}

export interface LensSlice {
  lensRules: LensRule[];
  addLensRule: (rule?: Partial<LensRule>) => void;
  updateLensRule: (id: string, patch: Partial<LensRule>) => void;
  removeLensRule: (id: string) => void;
  toggleLensRule: (id: string) => void;
  clearLensRules: () => void;
}

function createLensRuleId() {
  return `lens-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultRule(overrides?: Partial<LensRule>): LensRule {
  return {
    id: createLensRuleId(),
    enabled: true,
    modelId: null,
    field: "ifcType",
    operator: "is",
    value: "IFCWALL",
    action: "color",
    color: "#f59e0b",
    ...overrides,
  };
}

export const createLensSlice: StateCreator<LensSlice, [], [], LensSlice> = (
  set,
) => ({
  lensRules: [],
  addLensRule: (rule) =>
    set((state) => ({
      lensRules: [...state.lensRules, createDefaultRule(rule)],
    })),
  updateLensRule: (id, patch) =>
    set((state) => ({
      lensRules: state.lensRules.map((rule) =>
        rule.id === id ? { ...rule, ...patch } : rule,
      ),
    })),
  removeLensRule: (id) =>
    set((state) => ({
      lensRules: state.lensRules.filter((rule) => rule.id !== id),
    })),
  toggleLensRule: (id) =>
    set((state) => ({
      lensRules: state.lensRules.map((rule) =>
        rule.id === id ? { ...rule, enabled: !rule.enabled } : rule,
      ),
    })),
  clearLensRules: () => set({ lensRules: [] }),
});
