import { useMemo, useState } from "react";
import {
  Bookmark,
  Layers3,
  Palette,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldControl } from "@/components/ui/FieldControl";
import { IconActionButton } from "@/components/ui/IconActionButton";
import { PanelCard } from "@/components/ui/PanelCard";
import { useViewerStore } from "@/stores";
import type {
  LensAction,
  LensField,
  LensOperator,
  LensRule,
} from "@/stores/slices/lensSlice";

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

const PRESETS: { name: string; rules: Partial<LensRule>[] }[] = [
  {
    name: "Walls (Orange)",
    rules: [{ field: "ifcType", operator: "is", value: "IFCWALL", action: "color", color: "#f59e0b" }],
  },
  {
    name: "Doors (Blue)",
    rules: [{ field: "ifcType", operator: "is", value: "IFCDOOR", action: "color", color: "#3b82f6" }],
  },
  {
    name: "Windows (Cyan)",
    rules: [{ field: "ifcType", operator: "is", value: "IFCWINDOW", action: "color", color: "#06b6d4" }],
  },
  {
    name: "Slabs (Green)",
    rules: [{ field: "ifcType", operator: "is", value: "IFCSLAB", action: "color", color: "#22c55e" }],
  },
  {
    name: "Hide Spaces",
    rules: [{ field: "ifcType", operator: "is", value: "IFCSPACE", action: "hide", color: "#888" }],
  },
];

export function LensPanel() {
  const loadedModels = useViewerStore((state) => state.loadedModels);
  const lensRules = useViewerStore((state) => state.lensRules);
  const addLensRule = useViewerStore((state) => state.addLensRule);
  const updateLensRule = useViewerStore((state) => state.updateLensRule);
  const toggleLensRule = useViewerStore((state) => state.toggleLensRule);
  const removeLensRule = useViewerStore((state) => state.removeLensRule);
  const clearLensRules = useViewerStore((state) => state.clearLensRules);

  const [showPresets, setShowPresets] = useState(false);

  const colorLegend = useMemo(
    () =>
      lensRules
        .filter((r) => r.enabled && r.action === "color")
        .map((r) => ({ label: `${r.field}: ${r.value}`, color: r.color })),
    [lensRules],
  );

  return (
    <aside className="panel panel-right">
      <div className="panel-header">
        <div className="flex items-center justify-between gap-3">
          <span>Lens</span>
          <small className="text-text-muted text-[0.7rem] normal-case tracking-normal dark:text-slate-400">
            {lensRules.length} rules · {lensRules.filter((r) => r.enabled).length} active
          </small>
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden p-3.5 pr-2 text-text-secondary">
        <div className="grid min-h-0 gap-3.5 overflow-auto pr-1.5 align-content-start">
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <IconActionButton icon={<Plus size={14} />} onClick={() => addLensRule()}>
              Add Rule
            </IconActionButton>
            <IconActionButton
              icon={<Bookmark size={14} />}
              onClick={() => setShowPresets((p) => !p)}
            >
              Presets
            </IconActionButton>
            {lensRules.length > 0 ? (
              <IconActionButton
                icon={<Trash2 size={14} />}
                onClick={clearLensRules}
                variant="danger"
              >
                Clear All
              </IconActionButton>
            ) : null}
          </div>

          {/* Presets */}
          {showPresets ? (
            <PanelCard title="Presets" variant="accent">
              <div className="grid gap-1">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-[0.78rem] text-text transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                    onClick={() => {
                      for (const rule of preset.rules) addLensRule(rule);
                      setShowPresets(false);
                    }}
                  >
                    {preset.rules[0]?.action === "color" ? (
                      <span
                        className="inline-block h-3 w-3 rounded-full border border-border-subtle"
                        style={{ background: preset.rules[0].color }}
                      />
                    ) : (
                      <SlidersHorizontal size={12} />
                    )}
                    {preset.name}
                  </button>
                ))}
              </div>
            </PanelCard>
          ) : null}

          {/* Color Legend */}
          {colorLegend.length > 0 ? (
            <PanelCard title="Color Legend" variant="soft">
              <div className="grid gap-1.5">
                {colorLegend.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full border border-border-subtle"
                      style={{ background: item.color }}
                    />
                    <span className="truncate text-[0.76rem] text-text">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </PanelCard>
          ) : null}

          {/* Rules */}
          {lensRules.length === 0 ? (
            <EmptyState
              icon={<SlidersHorizontal size={16} />}
              title="Lens Rules"
              description="속성 기반 필터링과 컬러링 규칙을 추가합니다. 프리셋을 사용하면 빠르게 시작할 수 있습니다."
            />
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
                      onChange={(e) =>
                        updateLensRule(rule.id, {
                          modelId: e.target.value === "all" ? null : Number(e.target.value),
                        })
                      }
                    >
                      <option value="all">All models</option>
                      {loadedModels.map((m) => (
                        <option key={m.modelId} value={m.modelId}>{m.fileName}</option>
                      ))}
                    </FieldControl>
                    <FieldControl
                      as="select"
                      value={rule.field}
                      onChange={(e) =>
                        updateLensRule(rule.id, {
                          field: e.target.value as LensField,
                          value: e.target.value === "changed" ? "changed" : rule.value,
                        })
                      }
                    >
                      {fieldOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </FieldControl>
                    <FieldControl
                      as="select"
                      value={rule.operator}
                      onChange={(e) =>
                        updateLensRule(rule.id, { operator: e.target.value as LensOperator })
                      }
                    >
                      {operatorOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </FieldControl>
                    <FieldControl
                      as="select"
                      value={rule.action}
                      onChange={(e) =>
                        updateLensRule(rule.id, { action: e.target.value as LensAction })
                      }
                    >
                      {actionOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </FieldControl>
                  </div>
                  <div className="flex items-center gap-2">
                    <FieldControl
                      value={rule.value}
                      onChange={(e) => updateLensRule(rule.id, { value: e.target.value })}
                      className="flex-1"
                      disabled={rule.field === "changed"}
                    />
                    {rule.action === "color" ? (
                      <input
                        type="color"
                        value={rule.color}
                        onChange={(e) => updateLensRule(rule.id, { color: e.target.value })}
                        className="h-10 w-12 border border-border bg-white dark:border-slate-700 dark:bg-slate-950"
                      />
                    ) : null}
                  </div>
                </PanelCard>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel-footer">
        <span>Lens</span>
        <span>{lensRules.filter((r) => r.enabled).length} active rules</span>
      </div>
    </aside>
  );
}
