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
      className="hover-tooltip"
      style={{
        left: x + 14,
        top: y + 14,
      }}
    >
      <span className="hover-tooltip__type">{ifcType}</span>
      {name && <span className="hover-tooltip__name">{name}</span>}
      <span className="hover-tooltip__id">#{entityId}</span>
    </div>
  );
}
