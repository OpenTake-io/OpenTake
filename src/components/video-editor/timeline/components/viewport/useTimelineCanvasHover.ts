import { useCallback, useState, type MouseEvent } from "react";

interface UseTimelineCanvasHoverParams {
	direction: string;
	sidebarWidth: number;
	rangeStart: number;
	rangeEnd: number;
	videoDurationMs: number;
	onAddZoomAtMs?: (startMs: number) => void;
	canPlaceZoomAtMs?: (startMs: number) => boolean;
	valueToPixels: (value: number) => number;
}

export function useTimelineCanvasHover({
	direction,
	sidebarWidth,
	rangeStart,
	rangeEnd,
	videoDurationMs,
	onAddZoomAtMs,
	canPlaceZoomAtMs,
	valueToPixels,
}: UseTimelineCanvasHoverParams) {
	const [isTimelineHovered, setIsTimelineHovered] = useState(false);
	const [timelineHoverMs, setTimelineHoverMs] = useState<number | null>(null);
	const [isZoomRowHovered, setIsZoomRowHovered] = useState(false);
	const [zoomRowHoverMs, setZoomRowHoverMs] = useState<number | null>(null);

	const visibleDurationMs = Math.max(1, rangeEnd - rangeStart);

	const updateTimelineHoverTime = useCallback(
		(clientX: number, rect: DOMRect) => {
			const contentWidth = Math.max(1, rect.width - sidebarWidth);
			const contentX =
				direction === "rtl" ? rect.right - sidebarWidth - clientX : clientX - rect.left - sidebarWidth;
			const clampedX = Math.max(0, Math.min(contentX, contentWidth));
			const ratio = clampedX / contentWidth;
			const nextMs = rangeStart + ratio * visibleDurationMs;
			setTimelineHoverMs(Math.max(0, Math.min(nextMs, videoDurationMs)));
		},
		[direction, rangeStart, sidebarWidth, videoDurationMs, visibleDurationMs],
	);

	const handleTimelineMouseEnter = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			setIsTimelineHovered(true);
			updateTimelineHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[updateTimelineHoverTime],
	);

	const handleTimelineMouseMove = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (!isTimelineHovered) setIsTimelineHovered(true);
			updateTimelineHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[isTimelineHovered, updateTimelineHoverTime],
	);

	const handleTimelineMouseLeave = useCallback(() => {
		setIsTimelineHovered(false);
		setTimelineHoverMs(null);
		setIsZoomRowHovered(false);
		setZoomRowHoverMs(null);
	}, []);

	const updateZoomRowHoverTime = useCallback(
		(clientX: number, rect: DOMRect) => {
			if (rect.width <= 0) return;
			const position =
				direction === "rtl"
					? Math.max(0, Math.min(rect.right - clientX, rect.width))
					: Math.max(0, Math.min(clientX - rect.left, rect.width));
			const ratio = position / rect.width;
			const nextMs = rangeStart + ratio * visibleDurationMs;
			setZoomRowHoverMs(Math.max(0, Math.min(nextMs, videoDurationMs)));
		},
		[direction, rangeStart, videoDurationMs, visibleDurationMs],
	);

	const handleZoomRowMouseEnter = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			setIsZoomRowHovered(true);
			updateZoomRowHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[updateZoomRowHoverTime],
	);
	const handleZoomRowMouseMove = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (!isZoomRowHovered) setIsZoomRowHovered(true);
			updateZoomRowHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[isZoomRowHovered, updateZoomRowHoverTime],
	);
	const handleZoomRowMouseLeave = useCallback(() => {
		setIsZoomRowHovered(false);
		setZoomRowHoverMs(null);
	}, []);
	const handleZoomRowClick = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			event.stopPropagation();
			if (!onAddZoomAtMs || zoomRowHoverMs === null) return;
			const startMs = Math.max(0, Math.min(zoomRowHoverMs, videoDurationMs));
			if (canPlaceZoomAtMs && !canPlaceZoomAtMs(startMs)) return;
			onAddZoomAtMs(startMs);
		},
		[canPlaceZoomAtMs, onAddZoomAtMs, videoDurationMs, zoomRowHoverMs],
	);

	const ghostStartMs =
		zoomRowHoverMs === null ? null : Math.max(0, Math.min(zoomRowHoverMs, videoDurationMs));
	const ghostDurationMs = Math.min(1000, videoDurationMs);
	const ghostEndMs =
		ghostStartMs === null
			? null
			: Math.max(ghostStartMs, Math.min(videoDurationMs, ghostStartMs + ghostDurationMs));
	const ghostStartOffsetPx =
		ghostStartMs === null ? 0 : valueToPixels(Math.max(0, ghostStartMs - rangeStart));
	const ghostEndOffsetPx = ghostEndMs === null ? 0 : valueToPixels(Math.max(0, ghostEndMs - rangeStart));
	const ghostWidthPx = Math.max(18, ghostEndOffsetPx - ghostStartOffsetPx);
	const timelineGhostOffsetPx =
		timelineHoverMs === null ? 0 : valueToPixels(Math.max(0, timelineHoverMs - rangeStart));
	const canShowGhostPlayhead = isTimelineHovered && timelineHoverMs !== null;
	const canShowGhostZoom =
		isZoomRowHovered &&
		ghostStartMs !== null &&
		(onAddZoomAtMs ? (canPlaceZoomAtMs?.(ghostStartMs) ?? true) : false);

	return {
		canShowGhostPlayhead,
		timelineGhostOffsetPx,
		handleTimelineMouseEnter,
		handleTimelineMouseMove,
		handleTimelineMouseLeave,
		canShowGhostZoom,
		ghostStartMs,
		ghostStartOffsetPx,
		ghostWidthPx,
		handleZoomRowMouseEnter,
		handleZoomRowMouseMove,
		handleZoomRowMouseLeave,
		handleZoomRowClick,
	};
}
