import type { TrackedIfcChange } from "@/stores/slices/changesSlice";
import type {
  IfcPropertyEntry,
  IfcPropertySection,
  PropertySectionKind,
} from "@/types/worker-messages";
import { EditableEntryRow } from "./EditableEntryRow";
import { getChangeKey } from "./propertyChangeUtils";

interface PropertySectionListProps {
  title: string;
  description: string;
  sections: IfcPropertySection[];
  emptyMessage: string;
  sectionKind: PropertySectionKind;
  changeMap: Map<string, TrackedIfcChange>;
  disabled: boolean;
  onApplyEntryChange: (entry: IfcPropertyEntry, sectionKind: PropertySectionKind, sectionTitle: string, nextValue: string) => void;
  onRevertChange: (change: TrackedIfcChange) => void;
}

export function PropertySectionList({
  title,
  description,
  sections,
  emptyMessage,
  sectionKind,
  changeMap,
  disabled,
  onApplyEntryChange,
  onRevertChange,
}: PropertySectionListProps) {
  if (sections.length === 0) {
    return (
      <div className="prop-list">
        <div className="prop-header">
          <span className="prop-label">{title}</span>
          <small className="prop-small">{description}</small>
        </div>
        <div className="prop-empty">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {sections.map((section) => (
        <div
          key={`${section.title}-${section.expressID ?? "none"}`}
          className="prop-list"
        >
          <div className="prop-header">
            <span className="prop-label">{section.title}</span>
            <small className="prop-small">
              {section.ifcType ?? "IFC"} · {section.entries.length}개 항목
            </small>
          </div>
          <div className="grid gap-2">
            {section.entries.map((entry) => (
              <EditableEntryRow
                key={`${section.title}-${entry.key}`}
                entry={entry}
                sectionKind={sectionKind}
                sectionTitle={section.title}
                change={entry.target ? changeMap.get(getChangeKey(entry) ?? "") ?? null : null}
                disabled={disabled}
                onApply={onApplyEntryChange}
                onRevert={onRevertChange}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
