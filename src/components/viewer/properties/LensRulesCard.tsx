import { Layers3, Trash2 } from "lucide-react";
import { useViewerStore } from "@/stores";
import type { LensAction, LensField, LensOperator } from "@/stores/slices/lensSlice";

const fieldOptions: Array<{ value: LensField; label: string }> = [
  { value: "ifcType", label: "IfcType" },
  { value: "name", label: "Name" },
  { value: "storey", label: "Storey" },
  { value: "model", label: "Model" },
  { value: "changed", label: "Changed" },
];
const operatorOptions: Array<{ value: LensOperator; label: string }> = [
  { value: "is", label: "is" },
  { value: "contains", label: "contains" },
];
const actionOptions: Array<{ value: LensAction; label: string }> = [
  { value: "color", label: "Color" },
  { value: "hide", label: "Hide" },
];

export function LensRulesCard() {
  const loadedModels = useViewerStore((state) => state.loadedModels);
  const lensRules = useViewerStore((state) => state.lensRules);
  const addLensRule = useViewerStore((state) => state.addLensRule);
  const updateLensRule = useViewerStore((state) => state.updateLensRule);
  const toggleLensRule = useViewerStore((state) => state.toggleLensRule);
  const removeLensRule = useViewerStore((state) => state.removeLensRule);
  const clearLensRules = useViewerStore((state) => state.clearLensRules);

  return (
    <div className="prop-section">
      <div className="flex items-center justify-between gap-2">
        <div>
          <strong className="block text-text text-[0.92rem] dark:text-slate-100">
            Lens
          </strong>
          <small className="text-text-muted text-[0.72rem] dark:text-slate-400">
            규칙 기반 필터/컬러링
          </small>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border bg-bg text-[0.72rem] font-medium dark:border-slate-700 dark:bg-slate-900"
            onClick={() => addLensRule()}
          >
            <Layers3 size={13} />
            <span>Add Rule</span>
          </button>
          {lensRules.length > 0 ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-border bg-bg text-[0.72rem] font-medium dark:border-slate-700 dark:bg-slate-900"
              onClick={clearLensRules}
            >
              <Trash2 size={13} />
              <span>Clear</span>
            </button>
          ) : null}
        </div>
      </div>
      {lensRules.length === 0 ? (
        <div className="prop-empty">활성 Lens 규칙이 없습니다.</div>
      ) : (
        <div className="grid gap-2.5">
          {lensRules.map((rule) => (
            <div
              key={rule.id}
              className="grid gap-2 p-2.5 border border-border bg-white/80 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-[0.78rem] text-text dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => toggleLensRule(rule.id)}
                  />
                  <span>{rule.enabled ? "Enabled" : "Disabled"}</span>
                </label>
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-7 h-7 border border-border bg-bg dark:border-slate-700 dark:bg-slate-900"
                  onClick={() => removeLensRule(rule.id)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <select
                  value={rule.modelId ?? "all"}
                  onChange={(event) =>
                    updateLensRule(rule.id, {
                      modelId:
                        event.target.value === "all"
                          ? null
                          : Number(event.target.value),
                    })
                  }
                  className="px-2.5 py-2 border border-border bg-white text-[0.78rem] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option value="all">All models</option>
                  {loadedModels.map((model) => (
                    <option key={model.modelId} value={model.modelId}>
                      {model.fileName}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.field}
                  onChange={(event) =>
                    updateLensRule(rule.id, {
                      field: event.target.value as LensField,
                      value:
                        event.target.value === "changed"
                          ? "changed"
                          : rule.value,
                    })
                  }
                  className="px-2.5 py-2 border border-border bg-white text-[0.78rem] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  {fieldOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.operator}
                  onChange={(event) =>
                    updateLensRule(rule.id, {
                      operator: event.target.value as LensOperator,
                    })
                  }
                  className="px-2.5 py-2 border border-border bg-white text-[0.78rem] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  {operatorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={rule.action}
                  onChange={(event) =>
                    updateLensRule(rule.id, {
                      action: event.target.value as LensAction,
                    })
                  }
                  className="px-2.5 py-2 border border-border bg-white text-[0.78rem] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  {actionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={rule.value}
                  onChange={(event) =>
                    updateLensRule(rule.id, { value: event.target.value })
                  }
                  className="flex-1 px-2.5 py-2 border border-border bg-white text-[0.78rem] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  disabled={rule.field === "changed"}
                />
                {rule.action === "color" ? (
                  <input
                    type="color"
                    value={rule.color}
                    onChange={(event) =>
                      updateLensRule(rule.id, { color: event.target.value })
                    }
                    className="w-12 h-10 border border-border bg-white dark:border-slate-700 dark:bg-slate-950"
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
