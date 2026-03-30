import { Database } from "lucide-react";
import { PanelCard } from "@/components/ui/PanelCard";

interface ModelMetadataPanelProps {
  fileName: string | null;
  modelId: number | null;
  schema: string | null;
  maxExpressId: number | null;
  entityCount?: number;
}

export function ModelMetadataPanel({
  fileName,
  modelId,
  schema,
  maxExpressId,
  entityCount,
}: ModelMetadataPanelProps) {
  if (!fileName) return null;

  return (
    <div className="prop-list">
      <div className="prop-header">
        <span className="prop-label">
          <Database
            size={12}
            style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }}
          />
          Model Metadata
        </span>
        <span className="prop-small">
          {fileName}
        </span>
      </div>
      <div className="prop-row">
        <span className="prop-key">File</span>
        <strong className="prop-value">{fileName}</strong>
      </div>
      <div className="prop-row">
        <span className="prop-key">Model ID</span>
        <strong className="prop-value">{modelId ?? "-"}</strong>
      </div>
      <div className="prop-row">
        <span className="prop-key">Schema</span>
        <strong className="prop-value">{schema ?? "-"}</strong>
      </div>
      <div className="prop-row">
        <span className="prop-key">Max Express ID</span>
        <strong className="prop-value">{maxExpressId ?? "-"}</strong>
      </div>
      {entityCount !== undefined ? (
        <div className="prop-row">
          <span className="prop-key">Entities</span>
          <strong className="prop-value">{entityCount.toLocaleString()}</strong>
        </div>
      ) : null}
    </div>
  );
}
