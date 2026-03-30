import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { Check, Copy } from "lucide-react";
import type { GeometryMetrics } from "@/utils/geometryMetrics";

interface CoordValProps {
  axis: string;
  value: number;
}

function CoordVal({ axis, value }: CoordValProps) {
  return (
    <span className="inline-flex items-baseline gap-1 font-mono text-[0.78rem]">
      <span className="text-text-muted opacity-60">{axis}</span>
      <span className="text-text dark:text-slate-200">{value.toFixed(3)}</span>
    </span>
  );
}

interface CoordRowProps {
  label: string;
  values: { axis: string; value: number }[];
  copiedLabel: string | null;
  onCopy: (label: string, text: string) => void;
}

function CoordRow({ label, values, copiedLabel, onCopy }: CoordRowProps) {
  const isCopied = copiedLabel === label;
  const copyText = values.map((v) => v.value.toFixed(3)).join(", ");

  return (
    <div className="prop-row group">
      <span className="prop-key shrink-0">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          {values.map((v) => (
            <CoordVal key={v.axis} axis={v.axis} value={v.value} />
          ))}
        </div>
        <button
          type="button"
          className={clsx(
            "inline-flex h-5 w-5 items-center justify-center rounded bg-transparent text-text-subtle transition-opacity",
            isCopied ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          onClick={() => onCopy(label, copyText)}
          aria-label={`${label} 좌표 복사`}
        >
          {isCopied ? (
            <Check size={12} className="text-green-600" />
          ) : (
            <Copy size={12} />
          )}
        </button>
      </div>
    </div>
  );
}

interface CoordinateDisplayProps {
  metrics: GeometryMetrics;
}

export function CoordinateDisplay({ metrics }: CoordinateDisplayProps) {
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const handleCopy = useCallback((label: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 1500);
  }, []);

  const { min, max, size } = metrics.boundingBox;
  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];

  // Y-up (Three.js) → Z-up (IFC) conversion: IFC_X = X, IFC_Y = -Z, IFC_Z = Y
  const ifcCenter = { x: center[0], y: -center[2], z: center[1] };

  return (
    <div className="prop-list">
      <div className="prop-header">
        <span className="prop-label">Coordinates</span>
        <span className="prop-small">선택 엔티티 좌표 정보</span>
      </div>
      <CoordRow
        label="Center"
        values={[
          { axis: "X", value: center[0] },
          { axis: "Y", value: center[1] },
          { axis: "Z", value: center[2] },
        ]}
        copiedLabel={copiedLabel}
        onCopy={handleCopy}
      />
      <CoordRow
        label="IFC (Z-up)"
        values={[
          { axis: "E", value: ifcCenter.x },
          { axis: "N", value: ifcCenter.y },
          { axis: "Z", value: ifcCenter.z },
        ]}
        copiedLabel={copiedLabel}
        onCopy={handleCopy}
      />
      <CoordRow
        label="Size"
        values={[
          { axis: "W", value: size[0] },
          { axis: "H", value: size[1] },
          { axis: "D", value: size[2] },
        ]}
        copiedLabel={copiedLabel}
        onCopy={handleCopy}
      />
    </div>
  );
}
