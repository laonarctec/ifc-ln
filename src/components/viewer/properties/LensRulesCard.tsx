import { Layers3, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldControl } from "@/components/ui/FieldControl";
import { IconActionButton } from "@/components/ui/IconActionButton";
import { PanelCard } from "@/components/ui/PanelCard";
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
    <PanelCard
      title="Lens"
      description="규칙 기반 필터/컬러링"
      actions={
        <>
          <IconActionButton
            icon={<Layers3 size={13} />}
            label="Add Rule"
            onClick={() => addLensRule()}
          >
            Add Rule
          </IconActionButton>
          {lensRules.length > 0 ? (
            <IconActionButton
              icon={<Trash2 size={13} />}
              label="Clear"
              onClick={clearLensRules}
            >
              Clear
            </IconActionButton>
          ) : null}
        </>
      }
    >
      {lensRules.length === 0 ? (
        <EmptyState description="활성 Lens 규칙이 없습니다." />
      ) : (
        <div className="grid gap-2.5">
          {lensRules.map((rule) => (
            <PanelCard key={rule.id} variant="soft" className="gap-2">
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-[0.78rem] text-text dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => toggleLensRule(rule.id)}
                  />
                  <span>{rule.enabled ? "Enabled" : "Disabled"}</span>
                </label>
                <IconActionButton
                  icon={<Trash2 size={13} />}
                  label="규칙 삭제"
                  iconOnly
                  variant="danger"
                  onClick={() => removeLensRule(rule.id)}
                />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <FieldControl
                  as="select"
                  value={rule.modelId ?? "all"}
                  onChange={(event) =>
                    updateLensRule(rule.id, {
                      modelId:
                        event.target.value === "all"
                          ? null
                          : Number(event.target.value),
                    })
                  }
                >
                  <option value="all">All models</option>
                  {loadedModels.map((model) => (
                    <option key={model.modelId} value={model.modelId}>
                      {model.fileName}
                    </option>
                  ))}
                </FieldControl>
                <FieldControl
                  as="select"
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
                >
                  {fieldOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FieldControl>
                <FieldControl
                  as="select"
                  value={rule.operator}
                  onChange={(event) =>
                    updateLensRule(rule.id, {
                      operator: event.target.value as LensOperator,
                    })
                  }
                >
                  {operatorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FieldControl>
                <FieldControl
                  as="select"
                  value={rule.action}
                  onChange={(event) =>
                    updateLensRule(rule.id, {
                      action: event.target.value as LensAction,
                    })
                  }
                >
                  {actionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </FieldControl>
              </div>
              <div className="flex items-center gap-2">
                <FieldControl
                  value={rule.value}
                  onChange={(event) =>
                    updateLensRule(rule.id, { value: event.target.value })
                  }
                  className="flex-1"
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
            </PanelCard>
          ))}
        </div>
      )}
    </PanelCard>
  );
}
