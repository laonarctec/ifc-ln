import { Ruler, X } from "lucide-react";
import type { InteractionMode, MeasurementState } from "@/stores/slices/toolsSlice";
import { formatMetric } from "@/utils/geometryMetrics";

interface ViewportToolCardsProps {
  interactionMode: InteractionMode;
  measurement: MeasurementState;
  onToggleMeasurementMode: () => void;
  onClearMeasurement: () => void;
}

function getMeasurementMessage(measurement: MeasurementState, interactionMode: InteractionMode) {
  if (interactionMode !== "measure-distance" && measurement.mode === "idle") {
    return "측정 도구를 켜면 2점 거리 측정을 시작합니다.";
  }
  if (measurement.mode === "placing-first") {
    return "첫 번째 점을 클릭하세요.";
  }
  if (measurement.mode === "placing-second") {
    return "두 번째 점을 클릭하세요.";
  }
  if (measurement.mode === "complete" && measurement.distance !== null) {
    return `거리: ${formatMetric(measurement.distance, "m", 3)}`;
  }
  return "측정 대기 중";
}

export function ViewportToolCards({
  interactionMode,
  measurement,
  onToggleMeasurementMode,
  onClearMeasurement,
}: ViewportToolCardsProps) {
  const showMeasurementCard =
    interactionMode === "measure-distance" || measurement.start !== null || measurement.end !== null;

  return (
    <div className="viewport-tool-stack">
      {showMeasurementCard ? (
        <section className="viewport-tool-card">
          <div className="viewport-tool-card__header">
            <div className="viewport-tool-card__title-wrap">
              <span className="viewport-tool-card__icon">
                <Ruler size={14} strokeWidth={2} />
              </span>
              <div>
                <strong className="viewport-tool-card__title">Measure</strong>
                <p className="viewport-tool-card__subtitle">{getMeasurementMessage(measurement, interactionMode)}</p>
              </div>
            </div>
            <button type="button" className="viewport-tool-card__ghost" onClick={onClearMeasurement} title="측정 초기화">
              <X size={14} strokeWidth={2} />
            </button>
          </div>

          <div className="viewport-tool-card__body">
            <button
              type="button"
              className={`viewport-tool-card__button ${interactionMode === "measure-distance" ? "is-active" : ""}`}
              onClick={onToggleMeasurementMode}
            >
              {interactionMode === "measure-distance" ? "측정 모드 끄기" : "측정 모드 켜기"}
            </button>

            <div className="viewport-tool-card__meta">
              <span>Start</span>
              <strong>
                {measurement.start
                  ? measurement.start.point.map((value) => value.toFixed(2)).join(", ")
                  : "-"}
              </strong>
            </div>
            <div className="viewport-tool-card__meta">
              <span>End</span>
              <strong>
                {measurement.end
                  ? measurement.end.point.map((value) => value.toFixed(2)).join(", ")
                  : "-"}
              </strong>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
