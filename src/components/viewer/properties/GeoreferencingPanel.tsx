import { Globe, MapPin } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

interface GeoreferencingPanelProps {
  modelId: number | null;
}

/**
 * Georeferencing panel. Displays IfcProjectedCRS and IfcMapConversion data.
 * TODO: Implement worker-based extraction of georeferencing entities.
 */
export function GeoreferencingPanel({ modelId }: GeoreferencingPanelProps) {
  if (modelId === null) {
    return (
      <EmptyState
        icon={<Globe size={16} />}
        title="Georeferencing"
        description="모델을 로드한 뒤 지오레퍼런싱 데이터를 확인할 수 있습니다."
      />
    );
  }

  return (
    <EmptyState
      icon={<MapPin size={16} />}
      title="Georeferencing"
      description="이 모델의 지오레퍼런싱 정보를 추출하려면 워커 확장이 필요합니다. IfcProjectedCRS, IfcMapConversion 엔티티가 모델에 포함되어 있으면 여기에 표시됩니다."
    />
  );
}
