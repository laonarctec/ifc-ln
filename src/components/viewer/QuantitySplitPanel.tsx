import { useCallback, useEffect, useMemo } from "react";
import { Trash2, Download } from "lucide-react";
import { useViewerStore } from "@/stores";
import { useViewportGeometry } from "@/services/viewportGeometryStore";
import {
  computeRegionsFromLines,
  assignEntitiesToRegions,
} from "@/utils/splitRegionComputer";
import { formatMetric } from "@/utils/geometryMetrics";
import type { SplitRegion } from "@/stores/slices/quantitySplitSlice";

export function QuantitySplitPanel() {
  const quantitySplit = useViewerStore((s) => s.quantitySplit);
  const removeSplitLine = useViewerStore((s) => s.removeSplitLine);
  const updateRegions = useViewerStore((s) => s.updateRegions);
  const clearQuantitySplit = useViewerStore((s) => s.clearQuantitySplit);
  const setInteractionMode = useViewerStore((s) => s.setInteractionMode);
  const startQuantitySplit = useViewerStore((s) => s.startQuantitySplit);
  const { meshes } = useViewportGeometry();

  const activeModelId = useViewerStore((s) => s.selectedModelId);

  // Recompute regions when lines change
  useEffect(() => {
    if (!quantitySplit.active || !quantitySplit.bounds) return;

    const polygons = computeRegionsFromLines(
      quantitySplit.bounds,
      quantitySplit.lines,
    );

    const modelId = activeModelId ?? 0;
    const regions = assignEntitiesToRegions(polygons, meshes, modelId);
    updateRegions(regions);
  }, [
    quantitySplit.active,
    quantitySplit.bounds,
    quantitySplit.lines,
    meshes,
    activeModelId,
    updateRegions,
  ]);

  const aggregate = useMemo(() => {
    let volume = 0;
    let surfaceArea = 0;
    let entityCount = 0;
    for (const region of quantitySplit.regions) {
      if (region.metrics) {
        volume += region.metrics.volume;
        surfaceArea += region.metrics.surfaceArea;
      }
      entityCount += region.entityKeys.length;
    }
    return { volume, surfaceArea, entityCount };
  }, [quantitySplit.regions]);

  const handleExportCSV = useCallback(() => {
    const rows = [
      ["영역", "색상", "체적(m³)", "표면적(m²)", "엔티티수"],
      ...quantitySplit.regions.map((r, i) => [
        `영역 ${i + 1}`,
        r.color,
        r.metrics?.volume.toFixed(2) ?? "0",
        r.metrics?.surfaceArea.toFixed(2) ?? "0",
        String(r.entityKeys.length),
      ]),
      [
        "합계",
        "",
        aggregate.volume.toFixed(2),
        aggregate.surfaceArea.toFixed(2),
        String(aggregate.entityCount),
      ],
    ];

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quantity-split.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [quantitySplit.regions, aggregate]);

  const handleClear = useCallback(() => {
    clearQuantitySplit();
    setInteractionMode("select");
  }, [clearQuantitySplit, setInteractionMode]);

  if (!quantitySplit.active) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-text-primary">물량 분할</span>
        <button
          onClick={handleClear}
          className="rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-hover"
        >
          초기화
        </button>
      </div>

      {/* Split Lines */}
      {quantitySplit.lines.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-text-muted">
            분할선 ({quantitySplit.lines.length}개)
          </span>
          {quantitySplit.lines.map((line, i) => (
            <div
              key={line.id}
              className="flex items-center justify-between rounded bg-bg-secondary px-2 py-1"
            >
              <span className="text-xs text-text-secondary">선 {i + 1}</span>
              <button
                onClick={() => removeSplitLine(line.id)}
                className="text-text-muted hover:text-red-500"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {quantitySplit.lines.length === 0 && (
        <div className="rounded bg-bg-secondary px-3 py-4 text-center text-xs text-text-muted">
          뷰포트를 클릭하여 분할선을 그려주세요
        </div>
      )}

      {/* Regions */}
      {quantitySplit.regions.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-text-muted">
            영역별 물량 ({quantitySplit.regions.length}개)
          </span>
          {quantitySplit.regions.map((region, i) => (
            <RegionCard key={region.id} region={region} index={i} />
          ))}

          {/* Aggregate */}
          <div className="rounded border border-border-primary bg-bg-secondary px-3 py-2">
            <div className="mb-1 text-xs font-semibold text-text-primary">합계</div>
            <div className="grid grid-cols-3 gap-1 text-xs text-text-secondary">
              <div>체적: {formatMetric(aggregate.volume, "m³")}</div>
              <div>면적: {formatMetric(aggregate.surfaceArea, "m²")}</div>
              <div>엔티티: {aggregate.entityCount}개</div>
            </div>
          </div>
        </div>
      )}

      {/* Export */}
      {quantitySplit.regions.length > 0 && (
        <button
          onClick={handleExportCSV}
          className="flex items-center justify-center gap-1 rounded bg-bg-secondary px-3 py-2 text-xs text-text-secondary hover:bg-bg-hover"
        >
          <Download size={12} />
          CSV 내보내기
        </button>
      )}
    </div>
  );
}

function RegionCard({ region, index }: { region: SplitRegion; index: number }) {
  return (
    <div className="rounded border border-border-primary bg-bg-primary px-3 py-2">
      <div className="mb-1 flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-sm"
          style={{ backgroundColor: region.color }}
        />
        <span className="text-xs font-medium text-text-primary">
          영역 {index + 1}
        </span>
        <span className="ml-auto text-xs text-text-muted">
          {region.entityKeys.length}개
        </span>
      </div>
      {region.metrics ? (
        <div className="grid grid-cols-2 gap-1 text-xs text-text-secondary">
          <div>체적: {formatMetric(region.metrics.volume, "m³")}</div>
          <div>면적: {formatMetric(region.metrics.surfaceArea, "m²")}</div>
        </div>
      ) : (
        <div className="text-xs text-text-muted">엔티티 없음</div>
      )}
    </div>
  );
}
