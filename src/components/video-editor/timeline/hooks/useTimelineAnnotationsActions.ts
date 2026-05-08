import { useCallback } from "react";

interface UseTimelineAnnotationsActionsParams {
	videoDuration: number;
	totalMs: number;
	currentTimeMs: number;
	defaultRegionDurationMs: number;
	onAnnotationAdded?: (span: { start: number; end: number }, trackIndex?: number) => void;
}

export function useTimelineAnnotationsActions({
	videoDuration,
	totalMs,
	currentTimeMs,
	defaultRegionDurationMs,
	onAnnotationAdded,
}: UseTimelineAnnotationsActionsParams) {
	const handleAddAnnotation = useCallback(
		(trackIndex = 0) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onAnnotationAdded) {
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			const startPos = Math.max(0, Math.min(currentTimeMs, totalMs));
			const endPos = Math.min(startPos + defaultDuration, totalMs);
			onAnnotationAdded({ start: startPos, end: endPos }, trackIndex);
		},
		[videoDuration, totalMs, currentTimeMs, defaultRegionDurationMs, onAnnotationAdded],
	);

	return { handleAddAnnotation };
}
