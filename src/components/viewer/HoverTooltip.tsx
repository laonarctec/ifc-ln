interface HoverTooltipProps {
  entityId: number;
  ifcType: string;
  name: string | null;
  x: number;
  y: number;
}

export function HoverTooltip({ entityId, ifcType, name, x, y }: HoverTooltipProps) {
  return (
    <div
      className="tooltip"
      style={{ left: x + 14, top: y + 14 }}
    >
      <span className="font-bold text-[#1e40af] dark:text-blue-300">{ifcType}</span>
      {name && <span className="text-text font-medium dark:text-slate-200">{name}</span>}
      <span className="text-text-subtle text-[0.65rem]">#{entityId}</span>
    </div>
  );
}
