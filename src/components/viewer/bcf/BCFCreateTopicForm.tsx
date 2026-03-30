import { useState } from "react";
import { Plus, X } from "lucide-react";
import { IconActionButton } from "@/components/ui/IconActionButton";
import { PanelCard } from "@/components/ui/PanelCard";

interface BCFCreateTopicFormProps {
  onSubmit: (title: string, description: string) => void;
  onCancel: () => void;
}

export function BCFCreateTopicForm({ onSubmit, onCancel }: BCFCreateTopicFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    onSubmit(trimmedTitle, description.trim());
  };

  return (
    <PanelCard title="새 토픽 만들기" variant="accent">
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <label className="text-[0.72rem] font-bold uppercase tracking-wide text-text-muted">
            Title
          </label>
          <input
            type="text"
            className="w-full rounded border border-border-subtle px-2.5 py-1.5 text-[0.82rem] text-text dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            placeholder="토픽 제목..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-[0.72rem] font-bold uppercase tracking-wide text-text-muted">
            Description
          </label>
          <textarea
            className="w-full resize-none rounded border border-border-subtle px-2.5 py-1.5 text-[0.78rem] text-text dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            placeholder="설명 (선택)..."
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <IconActionButton
            icon={<Plus size={14} />}
            onClick={handleSubmit}
            disabled={!title.trim()}
          >
            Create
          </IconActionButton>
          <IconActionButton icon={<X size={14} />} onClick={onCancel}>
            Cancel
          </IconActionButton>
        </div>
      </div>
    </PanelCard>
  );
}
