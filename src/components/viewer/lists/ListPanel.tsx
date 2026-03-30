import { useCallback, useMemo, useState } from "react";
import {
  Download,
  Plus,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconActionButton } from "@/components/ui/IconActionButton";
import { FieldControl } from "@/components/ui/FieldControl";
import { useViewerStore } from "@/stores";
import type { ListDefinition } from "@/stores/slices/listSlice";

const PRESETS: { name: string; entityType: string; columns: { field: string; label: string }[] }[] = [
  {
    name: "All Walls",
    entityType: "IFCWALL",
    columns: [
      { field: "Name", label: "Name" },
      { field: "GlobalId", label: "GlobalId" },
      { field: "ObjectType", label: "Type" },
    ],
  },
  {
    name: "All Doors",
    entityType: "IFCDOOR",
    columns: [
      { field: "Name", label: "Name" },
      { field: "GlobalId", label: "GlobalId" },
      { field: "OverallWidth", label: "Width" },
      { field: "OverallHeight", label: "Height" },
    ],
  },
  {
    name: "All Spaces",
    entityType: "IFCSPACE",
    columns: [
      { field: "Name", label: "Name" },
      { field: "LongName", label: "Long Name" },
      { field: "GlobalId", label: "GlobalId" },
    ],
  },
];

export function ListPanel() {
  const listDefinitions = useViewerStore((s) => s.listDefinitions);
  const activeListId = useViewerStore((s) => s.activeListId);
  const listResults = useViewerStore((s) => s.listResults);
  const addListDefinition = useViewerStore((s) => s.addListDefinition);
  const removeListDefinition = useViewerStore((s) => s.removeListDefinition);
  const setActiveListId = useViewerStore((s) => s.setActiveListId);

  const [showBuilder, setShowBuilder] = useState(false);
  const [builderType, setBuilderType] = useState("IFCWALL");
  const [builderName, setBuilderName] = useState("");

  const activeList = useMemo(
    () => listDefinitions.find((d) => d.id === activeListId) ?? null,
    [listDefinitions, activeListId],
  );

  const handleCreateList = useCallback(() => {
    const id = `list-${Date.now()}`;
    const def: ListDefinition = {
      id,
      name: builderName || builderType,
      entityTypeFilter: builderType,
      columns: [
        { field: "Name", label: "Name" },
        { field: "GlobalId", label: "GlobalId" },
      ],
    };
    addListDefinition(def);
    setShowBuilder(false);
    setBuilderName("");
  }, [addListDefinition, builderName, builderType]);

  const handlePreset = useCallback(
    (preset: (typeof PRESETS)[0]) => {
      const id = `list-${Date.now()}`;
      addListDefinition({
        id,
        name: preset.name,
        entityTypeFilter: preset.entityType,
        columns: preset.columns,
      });
    },
    [addListDefinition],
  );

  const handleExportCsv = useCallback(() => {
    if (!activeList || listResults.length === 0) return;
    const header = activeList.columns.map((c) => c.label).join(",");
    const rows = listResults.map((r) =>
      activeList.columns.map((c) => `"${r.values[c.field] ?? ""}"`).join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeList.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeList, listResults]);

  return (
    <div className="flex h-full w-full flex-col bg-white/88 dark:bg-slate-800/88">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-2">
        <Table2 size={16} className="text-text-muted" />
        <span className="text-[0.78rem] font-bold uppercase tracking-wide text-text-secondary">
          Lists
        </span>
        <div className="flex flex-1 items-center justify-end gap-2">
          <IconActionButton icon={<Plus size={13} />} onClick={() => setShowBuilder(true)}>
            New
          </IconActionButton>
          {activeList ? (
            <>
              <IconActionButton
                icon={<Download size={13} />}
                onClick={handleExportCsv}
                disabled={listResults.length === 0}
              >
                CSV
              </IconActionButton>
              <IconActionButton
                icon={<Trash2 size={13} />}
                variant="danger"
                iconOnly
                onClick={() => removeListDefinition(activeList.id)}
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left: definitions */}
        <div className="flex w-[200px] shrink-0 flex-col border-r border-border-subtle">
          {/* Presets */}
          <div className="border-b border-border-subtle px-3 py-2">
            <span className="text-[0.66rem] font-bold uppercase tracking-wide text-text-muted">
              Presets
            </span>
            <div className="mt-1 grid gap-0.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className="rounded px-2 py-1 text-left text-[0.74rem] text-text transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  onClick={() => handlePreset(preset)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Saved lists */}
          <div className="flex-1 overflow-auto px-2 py-2">
            {listDefinitions.length === 0 ? (
              <p className="px-1 text-[0.72rem] text-text-muted">저장된 리스트가 없습니다.</p>
            ) : (
              <div className="grid gap-0.5">
                {listDefinitions.map((def) => (
                  <button
                    key={def.id}
                    type="button"
                    className={`flex items-center justify-between rounded px-2 py-1.5 text-left text-[0.76rem] transition-colors ${
                      activeListId === def.id
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "text-text hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                    onClick={() => setActiveListId(def.id)}
                  >
                    <span className="truncate">{def.name}</span>
                    <button
                      type="button"
                      className="ml-1 shrink-0 opacity-50 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeListDefinition(def.id);
                      }}
                    >
                      <X size={12} />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: results or builder */}
        <div className="flex flex-1 items-center justify-center overflow-auto p-4">
          {showBuilder ? (
            <div className="grid w-full max-w-sm gap-3">
              <h3 className="text-[0.88rem] font-bold text-text">새 리스트 만들기</h3>
              <FieldControl
                value={builderName}
                onChange={(e) => setBuilderName(e.target.value)}
                placeholder="리스트 이름 (선택)"
              />
              <FieldControl
                value={builderType}
                onChange={(e) => setBuilderType(e.target.value)}
                placeholder="IFC 타입 (e.g., IFCWALL)"
              />
              <div className="flex gap-2">
                <IconActionButton icon={<Plus size={14} />} onClick={handleCreateList}>
                  Create
                </IconActionButton>
                <IconActionButton icon={<X size={14} />} onClick={() => setShowBuilder(false)}>
                  Cancel
                </IconActionButton>
              </div>
            </div>
          ) : activeList ? (
            listResults.length > 0 ? (
              <div className="w-full overflow-auto">
                <table className="w-full text-[0.76rem]">
                  <thead>
                    <tr className="border-b border-border-subtle">
                      <th className="px-2 py-1.5 text-left font-bold text-text-muted">#</th>
                      {activeList.columns.map((col) => (
                        <th
                          key={col.field}
                          className="px-2 py-1.5 text-left font-bold text-text-muted"
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listResults.map((row) => (
                      <tr
                        key={row.entityExpressId}
                        className="border-b border-slate-100 dark:border-slate-700"
                      >
                        <td className="px-2 py-1.5 font-mono text-text-muted">
                          {row.entityExpressId}
                        </td>
                        {activeList.columns.map((col) => (
                          <td key={col.field} className="px-2 py-1.5 text-text">
                            {row.values[col.field] ?? "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={<Table2 size={16} />}
                title={activeList.name}
                description={`${activeList.entityTypeFilter} 타입 엔티티를 쿼리합니다. 쿼리 실행은 워커 확장 후 지원됩니다.`}
              />
            )
          ) : (
            <EmptyState
              icon={<Table2 size={16} />}
              title="Query Builder"
              description="리스트를 선택하거나 새로 만들어 IFC 데이터를 테이블 형태로 확인합니다."
            />
          )}
        </div>
      </div>
    </div>
  );
}
