import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { Search } from "lucide-react";
import { PanelBadge } from "@/components/ui/PanelBadge";
import type { BcfTopic } from "@/services/bcfService";

const STATUS_VARIANT: Record<string, "default" | "success" | "error" | "warning" | "info"> = {
  Open: "info",
  Active: "warning",
  Closed: "success",
  Resolved: "success",
};

interface BCFTopicListProps {
  topics: BcfTopic[];
  selectedGuid: string | null;
  onSelect: (guid: string) => void;
}

export function BCFTopicList({ topics, selectedGuid, onSelect }: BCFTopicListProps) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search) return topics;
    const lower = search.toLowerCase();
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        t.creationAuthor.toLowerCase().includes(lower),
    );
  }, [topics, search]);

  return (
    <div className="grid gap-0">
      <div className="field-control mx-3 mt-1 mb-2">
        <Search size={14} className="field-control-prefix" />
        <input
          type="text"
          className="field-control-element"
          placeholder="토픽 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="px-3.5 py-3 text-[0.78rem] text-text-muted">
          {topics.length === 0 ? "토픽이 없습니다." : "검색 결과가 없습니다."}
        </p>
      ) : (
        <div className="grid gap-1 px-2">
          {filtered.map((topic) => (
            <button
              key={topic.guid}
              type="button"
              className={clsx(
                "grid gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                selectedGuid === topic.guid
                  ? "border-blue-500/45 bg-blue-50/70 dark:border-blue-500/55 dark:bg-slate-800"
                  : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60",
              )}
              onClick={() => onSelect(topic.guid)}
            >
              <div className="flex items-center justify-between gap-2">
                <strong className="truncate text-[0.82rem] text-text">
                  {topic.title}
                </strong>
                <PanelBadge variant={STATUS_VARIANT[topic.topicStatus] ?? "default"}>
                  {topic.topicStatus || "Open"}
                </PanelBadge>
              </div>
              <div className="flex items-center gap-2 text-[0.68rem] text-text-muted">
                <span>{topic.creationAuthor}</span>
                <span>·</span>
                <span>{new Date(topic.creationDate).toLocaleDateString()}</span>
                <span>·</span>
                <span>{topic.comments.length} comments</span>
                <span>·</span>
                <span>{topic.viewpoints.length} viewpoints</span>
              </div>
              {topic.description ? (
                <p className="line-clamp-2 text-[0.74rem] text-text-secondary">
                  {topic.description}
                </p>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
