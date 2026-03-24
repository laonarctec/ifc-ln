import { useEffect, useState } from "react";
import { PencilLine, X } from "lucide-react";
import type { TrackedIfcChange } from "@/stores/slices/changesSlice";
import type {
  IfcPropertyEntry,
  PropertySectionKind,
} from "@/types/worker-messages";

interface EditableEntryRowProps {
  entry: IfcPropertyEntry;
  sectionKind: PropertySectionKind;
  sectionTitle: string;
  change: TrackedIfcChange | null;
  disabled: boolean;
  onApply: (entry: IfcPropertyEntry, sectionKind: PropertySectionKind, sectionTitle: string, nextValue: string) => void;
  onRevert: (change: TrackedIfcChange) => void;
}

export function EditableEntryRow({
  entry,
  sectionKind,
  sectionTitle,
  change,
  disabled,
  onApply,
  onRevert,
}: EditableEntryRowProps) {
  const [draftValue, setDraftValue] = useState(change?.currentValue ?? entry.value);

  useEffect(() => {
    setDraftValue(change?.currentValue ?? entry.value);
  }, [change?.currentValue, entry.value]);

  const canApply =
    entry.editable &&
    !disabled &&
    draftValue.trim() !== "" &&
    draftValue !== (change?.currentValue ?? entry.value);

  if (!entry.editable || !entry.target) {
    return (
      <div className="prop-row">
        <span className="prop-key">{entry.key}</span>
        <strong className="prop-value">{entry.value}</strong>
      </div>
    );
  }

  return (
    <div className="grid gap-2 p-2.5 border border-border-subtle bg-white/80 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex items-center justify-between gap-2">
        <span className="prop-key">{entry.key}</span>
        <small className="prop-small">
          {entry.valueType ?? "value"}
          {change ? " · changed" : ""}
        </small>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          className="flex-1 min-w-[160px] px-2.5 py-2 border border-border bg-white text-[0.82rem] text-text dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          disabled={disabled}
        />
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-2 border border-border bg-bg text-[0.75rem] font-medium disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900"
          disabled={!canApply}
          onClick={() => onApply(entry, sectionKind, sectionTitle, draftValue)}
        >
          <PencilLine size={13} />
          <span>Apply</span>
        </button>
        {change ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-2 border border-border bg-bg text-[0.75rem] font-medium dark:border-slate-700 dark:bg-slate-900"
            onClick={() => onRevert(change)}
          >
            <X size={13} />
            <span>Revert</span>
          </button>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 text-[0.74rem] text-text-muted dark:text-slate-400">
        <span>Current: {change?.currentValue ?? entry.value}</span>
        {change ? <span>Original: {change.originalValue}</span> : null}
      </div>
    </div>
  );
}
