import { X } from "lucide-react";
import type { StatusBarDebugCard } from "./statusBarViewModel";

interface StatusDebugPanelProps {
  cards: StatusBarDebugCard[];
  onClose: () => void;
}

export function StatusDebugPanel({
  cards,
  onClose,
}: StatusDebugPanelProps) {
  return (
    <div className="debug-popup">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.72rem] font-bold text-text dark:text-slate-200">
          Debug Info
        </span>
        <button
          type="button"
          className="inline-flex items-center justify-center w-5 h-5 p-0 border-0 rounded bg-transparent text-text-subtle cursor-pointer hover:bg-slate-100 hover:text-text dark:hover:bg-slate-800"
          onClick={onClose}
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 max-[720px]:grid-cols-1">
        {cards.map((card) => (
          <div key={card.id} className="meta-card">
            <span className="meta-label">{card.label}</span>
            <span className="meta-value">{card.value}</span>
            <span className="meta-sub">{card.subValue}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
