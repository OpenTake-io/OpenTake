import type { Span } from "dnd-timeline";
import { useCallback, useMemo } from "react";
import type {
	AnnotationRegion,
	AudioRegion,
	ClipRegion,
	SpeedRegion,
	TrimRegion,
	ZoomRegion,
} from "../../types";
import { getAnnotationTrackIndex, getAudioTrackIndex, isAnnotationTrackRowId, isAudioTrackRowId } from "../core/rows";
import { spansOverlap } from "../core/spans";
import { buildAllRegionSpans, buildTimelineItems, resolveDropRowId, type TimelineRenderItem } from "../model/timelineModel";

interface UseTimelineDndBindingsParams {
	zoomRegions: ZoomRegion[];
	trimRegions: TrimRegion[];
	clipRegions: ClipRegion[];
	annotationRegions: AnnotationRegion[];
	speedRegions: SpeedRegion[];
	audioRegions: AudioRegion[];
	onZoomSpanChange: (id: string, span: Span) => void;
	onTrimSpanChange?: (id: string, span: Span) => void;
	onClipSpanChange?: (id: string, span: Span) => void;
	onAnnotationSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onSpeedSpanChange?: (id: string, span: Span) => void;
	onAudioSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
}

export function useTimelineDndBindings({
	zoomRegions,
	trimRegions,
	clipRegions,
	annotationRegions,
	speedRegions,
	audioRegions,
	onZoomSpanChange,
	onTrimSpanChange,
	onClipSpanChange,
	onAnnotationSpanChange,
	onSpeedSpanChange,
	onAudioSpanChange,
}: UseTimelineDndBindingsParams) {
	const hasOverlap = useCallback(
		(newSpan: Span, excludeId?: string, rowId?: string): boolean => {
			const isZoomItem = zoomRegions.some((r) => r.id === excludeId);
			const isTrimItem = trimRegions.some((r) => r.id === excludeId);
			const isClipItem = clipRegions.some((r) => r.id === excludeId);
			const isAnnotationItem = annotationRegions.some((r) => r.id === excludeId);
			const isSpeedItem = speedRegions.some((r) => r.id === excludeId);
			const isAudioItem = audioRegions.some((r) => r.id === excludeId);

			if (isAnnotationItem) return false;

			const checkOverlap = (
				regions: (ZoomRegion | TrimRegion | ClipRegion | SpeedRegion | AudioRegion)[],
			) =>
				regions.some((region) => {
					if (region.id === excludeId) return false;
					return spansOverlap(newSpan, { start: region.startMs, end: region.endMs });
				});

			if (isZoomItem) return checkOverlap(zoomRegions);
			if (isTrimItem) return checkOverlap(trimRegions);
			if (isClipItem) return checkOverlap(clipRegions);
			if (isSpeedItem) return checkOverlap(speedRegions);

			if (isAudioItem) {
				const activeAudioRegion = audioRegions.find((region) => region.id === excludeId);
				const activeTrackIndex =
					rowId && isAudioTrackRowId(rowId)
						? getAudioTrackIndex(rowId)
						: (activeAudioRegion?.trackIndex ?? 0);
				return checkOverlap(
					audioRegions.filter((region) => (region.trackIndex ?? 0) === activeTrackIndex),
				);
			}

			return false;
		},
		[zoomRegions, trimRegions, clipRegions, annotationRegions, speedRegions, audioRegions],
	);

	const timelineItems = useMemo<TimelineRenderItem[]>(
		() =>
			buildTimelineItems({
				zoomRegions,
				clipRegions,
				annotationRegions,
				audioRegions,
			}),
		[zoomRegions, clipRegions, annotationRegions, audioRegions],
	);

	const allRegionSpans = useMemo(
		() =>
			buildAllRegionSpans({
				zoomRegions,
				clipRegions,
				audioRegions,
			}),
		[zoomRegions, clipRegions, audioRegions],
	);

	const getResolvedDropRowId = useCallback(
		(id: string, proposedRowId: string) => resolveDropRowId(id, proposedRowId, timelineItems),
		[timelineItems],
	);

	const handleItemSpanChange = useCallback(
		(id: string, span: Span, rowId?: string) => {
			if (zoomRegions.some((r) => r.id === id)) {
				onZoomSpanChange(id, span);
			} else if (trimRegions.some((r) => r.id === id)) {
				onTrimSpanChange?.(id, span);
			} else if (clipRegions.some((r) => r.id === id)) {
				onClipSpanChange?.(id, span);
			} else if (annotationRegions.some((r) => r.id === id)) {
				const nextTrackIndex =
					rowId && isAnnotationTrackRowId(rowId)
						? getAnnotationTrackIndex(rowId)
						: (annotationRegions.find((region) => region.id === id)?.trackIndex ?? 0);
				onAnnotationSpanChange?.(id, span, nextTrackIndex);
			} else if (speedRegions.some((r) => r.id === id)) {
				onSpeedSpanChange?.(id, span);
			} else if (audioRegions.some((r) => r.id === id)) {
				const nextTrackIndex =
					rowId && isAudioTrackRowId(rowId)
						? getAudioTrackIndex(rowId)
						: (audioRegions.find((region) => region.id === id)?.trackIndex ?? 0);
				onAudioSpanChange?.(id, span, nextTrackIndex);
			}
		},
		[
			zoomRegions,
			trimRegions,
			clipRegions,
			annotationRegions,
			speedRegions,
			audioRegions,
			onZoomSpanChange,
			onTrimSpanChange,
			onClipSpanChange,
			onAnnotationSpanChange,
			onSpeedSpanChange,
			onAudioSpanChange,
		],
	);

	return {
		hasOverlap,
		timelineItems,
		allRegionSpans,
		getResolvedDropRowId,
		handleItemSpanChange,
	};
}
