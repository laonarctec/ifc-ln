import { useEffect } from "react";
import { ifcWorkerClient } from "@/services/IfcWorkerClient";
import { useViewerStore } from "@/stores";

export function useWebIfcPropertySync() {
	const currentModelId = useViewerStore((state) => state.currentModelId);
	const selectedEntityId = useViewerStore((state) => state.selectedEntityId);
	const clearSelectedProperties = useViewerStore(
		(state) => state.clearSelectedProperties,
	);
	const setPropertiesState = useViewerStore(
		(state) => state.setPropertiesState,
	);
	const setSelectedProperties = useViewerStore(
		(state) => state.setSelectedProperties,
	);

	useEffect(() => {
		if (currentModelId === null || selectedEntityId === null) {
			clearSelectedProperties();
			return;
		}

		let cancelled = false;
		setPropertiesState(true, null, ["attributes"]);

		void ifcWorkerClient
			.getPropertiesSections(currentModelId, selectedEntityId, [
				"attributes",
			])
			.then((result) => {
				if (cancelled) {
					return;
				}

				setSelectedProperties(result.properties);
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}

				setPropertiesState(
					false,
					error instanceof Error ? error.message : "속성 조회 실패",
				);
			});

		return () => {
			cancelled = true;
		};
	}, [
		clearSelectedProperties,
		currentModelId,
		selectedEntityId,
		setPropertiesState,
		setSelectedProperties,
	]);
}
