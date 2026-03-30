import { useCallback, useMemo, useRef } from "react";
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconActionButton } from "@/components/ui/IconActionButton";
import { PanelCard } from "@/components/ui/PanelCard";
import { PanelBadge } from "@/components/ui/PanelBadge";
import { PanelProgress } from "@/components/ui/PanelProgress";
import { useViewerStore } from "@/stores";
import { parseIdsXml } from "@/services/idsParser";
import type { IdsValidationStatus } from "@/stores/slices/idsSlice";

const STATUS_ICON = {
  pass: <Check size={12} className="text-green-600" />,
  fail: <X size={12} className="text-red-600" />,
  "not-applicable": <AlertTriangle size={12} className="text-amber-500" />,
};

const STATUS_LABEL: Record<IdsValidationStatus, string> = {
  pass: "Pass",
  fail: "Fail",
  "not-applicable": "N/A",
};

export function IDSPanel() {
  const idsDocument = useViewerStore((s) => s.idsDocument);
  const idsResults = useViewerStore((s) => s.idsResults);
  const selectedSpecIndex = useViewerStore((s) => s.idsSelectedSpecIndex);
  const validating = useViewerStore((s) => s.idsValidating);
  const statusFilter = useViewerStore((s) => s.idsStatusFilter);
  const setIdsDocument = useViewerStore((s) => s.setIdsDocument);
  const setSelectedSpecIndex = useViewerStore((s) => s.setIdsSelectedSpecIndex);
  const setStatusFilter = useViewerStore((s) => s.setIdsStatusFilter);
  const clearIds = useViewerStore((s) => s.clearIds);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const doc = parseIdsXml(text);
      setIdsDocument(doc);
    } catch (err) {
      console.error("IDS parse error:", err);
    }
    e.target.value = "";
  }, [setIdsDocument]);

  const selectedResult = useMemo(
    () => (selectedSpecIndex !== null ? idsResults[selectedSpecIndex] ?? null : null),
    [idsResults, selectedSpecIndex],
  );

  const filteredEntities = useMemo(() => {
    if (!selectedResult) return [];
    if (statusFilter === "all") return selectedResult.entityResults;
    return selectedResult.entityResults.filter((er) => er.status === statusFilter);
  }, [selectedResult, statusFilter]);

  const totalPass = idsResults.reduce((sum, r) => sum + r.passCount, 0);
  const totalFail = idsResults.reduce((sum, r) => sum + r.failCount, 0);

  return (
    <aside className="panel panel-right">
      <input
        ref={fileInputRef}
        type="file"
        accept=".ids,.xml"
        className="hidden"
        onChange={(e) => { void handleImport(e); }}
      />
      <div className="panel-header">
        <div className="flex items-center justify-between gap-3">
          <span>IDS</span>
          <small className="text-text-muted text-[0.7rem] normal-case tracking-normal dark:text-slate-400">
            {idsDocument?.info.title ?? "No specification"}
          </small>
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden p-3.5 pr-2 text-text-secondary">
        <div className="grid min-h-0 gap-3.5 overflow-auto pr-1.5 align-content-start">
          <div className="flex flex-wrap gap-2">
            <IconActionButton
              icon={<Upload size={14} />}
              onClick={() => fileInputRef.current?.click()}
            >
              Import IDS
            </IconActionButton>
            {idsDocument ? (
              <IconActionButton
                icon={<X size={14} />}
                onClick={clearIds}
                variant="danger"
              >
                Clear
              </IconActionButton>
            ) : null}
          </div>

          {validating ? (
            <PanelCard title="Validating..." variant="accent">
              <div className="flex items-center gap-2 py-2">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-[0.78rem]">모델을 검증하는 중...</span>
              </div>
              <PanelProgress value={50} label="Progress" />
            </PanelCard>
          ) : null}

          {!idsDocument && !validating ? (
            <EmptyState
              icon={<ShieldCheck size={16} />}
              title="Information Delivery Specification"
              description="IDS 파일을 가져와 모델의 데이터 품질을 검증합니다."
            />
          ) : null}

          {idsDocument ? (
            <>
              {/* Info card */}
              <PanelCard title={idsDocument.info.title} variant="soft">
                {idsDocument.info.description ? (
                  <p className="text-[0.76rem] text-text-secondary">
                    {idsDocument.info.description}
                  </p>
                ) : null}
                <div className="grid gap-1 text-[0.72rem]">
                  {idsDocument.info.author ? (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Author</span>
                      <span>{idsDocument.info.author}</span>
                    </div>
                  ) : null}
                  {idsDocument.info.version ? (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Version</span>
                      <span>{idsDocument.info.version}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span className="text-text-muted">Specifications</span>
                    <span>{idsDocument.specifications.length}개</span>
                  </div>
                </div>
              </PanelCard>

              {/* Results summary */}
              {idsResults.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="stat-card">
                    <span className="stat-card-label">Pass</span>
                    <strong className="stat-card-value text-green-600">{totalPass}</strong>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-label">Fail</span>
                    <strong className="stat-card-value text-red-600">{totalFail}</strong>
                  </div>
                </div>
              ) : null}

              {/* Specification list */}
              <PanelCard title="Specifications">
                <div className="grid gap-1">
                  {idsDocument.specifications.map((spec, index) => {
                    const result = idsResults[index];
                    const isSelected = selectedSpecIndex === index;

                    return (
                      <button
                        key={index}
                        type="button"
                        className={`grid gap-1 rounded-lg border px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? "border-blue-500/45 bg-blue-50/70 dark:border-blue-500/55 dark:bg-slate-800"
                            : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60"
                        }`}
                        onClick={() =>
                          setSelectedSpecIndex(isSelected ? null : index)
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <strong className="truncate text-[0.8rem] text-text">
                            {spec.name}
                          </strong>
                          {result ? (
                            <div className="flex items-center gap-1.5">
                              <PanelBadge variant="success">
                                {result.passCount}
                              </PanelBadge>
                              {result.failCount > 0 ? (
                                <PanelBadge variant="error">
                                  {result.failCount}
                                </PanelBadge>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {spec.description ? (
                          <p className="line-clamp-1 text-[0.7rem] text-text-muted">
                            {spec.description}
                          </p>
                        ) : null}
                        <div className="flex gap-2 text-[0.66rem] text-text-subtle">
                          <span>{spec.applicability.length} applicability</span>
                          <span>·</span>
                          <span>{spec.requirements.length} requirements</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PanelCard>

              {/* Selected spec detail */}
              {selectedResult ? (
                <PanelCard
                  title="Entity Results"
                  description={`${selectedResult.entityResults.length}개 엔티티`}
                  actions={
                    <div className="flex gap-1">
                      {(["all", "pass", "fail"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          className={`rounded px-2 py-0.5 text-[0.66rem] font-bold transition-colors ${
                            statusFilter === f
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                              : "text-text-muted hover:text-text"
                          }`}
                          onClick={() => setStatusFilter(f)}
                        >
                          {f === "all" ? "All" : STATUS_LABEL[f]}
                        </button>
                      ))}
                    </div>
                  }
                >
                  {filteredEntities.length === 0 ? (
                    <p className="text-[0.76rem] text-text-muted">
                      해당 필터에 맞는 결과가 없습니다.
                    </p>
                  ) : (
                    <div className="grid gap-1">
                      {filteredEntities.slice(0, 100).map((er) => (
                        <div
                          key={er.entityExpressId}
                          className="flex items-center gap-2 rounded border border-border-subtle px-2.5 py-1.5"
                        >
                          {STATUS_ICON[er.status]}
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-[0.78rem] text-text">
                              {er.entityName || `#${er.entityExpressId}`}
                            </span>
                            <span className="text-[0.66rem] text-text-muted">
                              {er.entityType} · #{er.entityExpressId}
                            </span>
                          </div>
                        </div>
                      ))}
                      {filteredEntities.length > 100 ? (
                        <p className="text-center text-[0.72rem] text-text-muted">
                          ...{filteredEntities.length - 100}개 더 있습니다
                        </p>
                      ) : null}
                    </div>
                  )}
                </PanelCard>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <div className="panel-footer">
        <span>IDS</span>
        <span>
          {idsDocument
            ? `${idsDocument.specifications.length} specs`
            : "No specification"}
        </span>
      </div>
    </aside>
  );
}
