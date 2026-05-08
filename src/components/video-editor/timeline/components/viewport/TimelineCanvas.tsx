import { useTimelineContext } from "dnd-timeline";
import { useCallback, useMemo, useRef } from "react";
import type { MouseEvent } from "react";
import {
	getTimelineContentMinHeightPx,
	getTimelineRowsMinHeightPx,
	getTimelineViewportStretchFactor,
	TIMELINE_AXIS_HEIGHT_PX,
} from "../../timelineLayout";
import type { AudioPeaksData } from "../../useAudioPeaks";
import type { TimelineRenderItem } from "../../model/timelineModel";
import TimelineAxis from "../axis/TimelineAxis";
import PlaybackCursor from "../playhead/PlaybackCursor";
import { TimelineCanvasRows } from "./TimelineCanvasRows";
import { useTimelineCanvasHover } from "./useTimelineCanvasHover";

interface TimelineCanvasProps {
	items: TimelineRenderItem[];
	videoDurationMs: number;
	currentTimeMs: number;
	onSeek?: (time: number) => void;
	canPlaceZoomAtMs?: (startMs: number) => boolean;
	onSelectZoom?: (id: string | null) => void;
	onSelectTrim?: (id: string | null) => void;
	onSelectClip?: (id: string | null) => void;
	onSelectAnnotation?: (id: string | null) => void;
	onSelectSpeed?: (id: string | null) => void;
	onSelectAudio?: (id: string | null) => void;
	onAddZoomAtMs?: (startMs: number) => void;
	selectedZoomId: string | null;
	selectedTrimId?: string | null;
	selectedClipId?: string | null;
	selectedAnnotationId?: string | null;
	selectedSpeedId?: string | null;
	selectedAudioId?: string | null;
	selectAllBlocksActive?: boolean;
	onClearBlockSelection?: () => void;
	keyframes?: { id: string; time: number }[];
	audioPeaks?: AudioPeaksData | null;
}

export default function TimelineCanvas({
	items,
	videoDurationMs,
	currentTimeMs,
	onSeek,
	onAddZoomAtMs,
	canPlaceZoomAtMs,
	onSelectZoom,
	onSelectTrim,
	onSelectClip,
	onSelectAnnotation,
	onSelectSpeed,
	onSelectAudio,
	selectedZoomId,
	selectedTrimId: _selectedTrimId,
	selectedClipId,
	selectedAnnotationId,
	selectedSpeedId: _selectedSpeedId,
	selectedAudioId,
	selectAllBlocksActive = false,
	onClearBlockSelection,
	keyframes = [],
	audioPeaks,
}: TimelineCanvasProps) {
	const { setTimelineRef, style, sidebarWidth, direction, range, valueToPixels, pixelsToValue } =
		useTimelineContext();
	const localTimelineRef = useRef<HTMLDivElement | null>(null);

	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			setTimelineRef(node);
			localTimelineRef.current = node;
		},
		[setTimelineRef],
	);

	const handleTimelineClick = useCallback(
		(e: MouseEvent<HTMLDivElement>) => {
			if (!onSeek || videoDurationMs <= 0) return;

			onSelectZoom?.(null);
			onSelectTrim?.(null);
			onSelectClip?.(null);
			onSelectAnnotation?.(null);
			onSelectSpeed?.(null);
			onSelectAudio?.(null);
			onClearBlockSelection?.();

			const rect = e.currentTarget.getBoundingClientRect();
			const clickX = e.clientX - rect.left - sidebarWidth;
			if (clickX < 0) return;
			const relativeMs = pixelsToValue(clickX);
			const absoluteMs = Math.max(0, Math.min(range.start + relativeMs, videoDurationMs));
			onSeek(absoluteMs / 1000);
		},
		[
			onSeek,
			onSelectZoom,
			onSelectTrim,
			onSelectClip,
			onSelectAnnotation,
			onSelectSpeed,
			onSelectAudio,
			onClearBlockSelection,
			videoDurationMs,
			sidebarWidth,
			range.start,
			pixelsToValue,
		],
	);

	const audioRowIds = useMemo(
		() => new Set(items.map((item) => item.rowId)).size,
		[items],
	);

	const timelineRowCount = Math.max(2, audioRowIds);
	const timelineRowsMinHeightPx = getTimelineRowsMinHeightPx(timelineRowCount);
	const timelineContentMinHeightPx = getTimelineContentMinHeightPx(timelineRowCount);
	const timelineViewportStretchFactor = getTimelineViewportStretchFactor(timelineRowCount);
	const sideProperty = direction === "rtl" ? "right" : "left";
	const {
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
	} = useTimelineCanvasHover({
		direction,
		sidebarWidth,
		rangeStart: range.start,
		rangeEnd: range.end,
		videoDurationMs,
		onAddZoomAtMs,
		canPlaceZoomAtMs,
		valueToPixels,
	});

	return (
		<div
			ref={setRefs}
			style={{
				...style,
				height: `max(100%, ${timelineContentMinHeightPx}px, calc(${TIMELINE_AXIS_HEIGHT_PX}px + (100% - ${TIMELINE_AXIS_HEIGHT_PX}px) * ${timelineViewportStretchFactor}))`,
			}}
			className="select-none bg-editor-bg relative cursor-pointer group flex flex-col"
			onClick={handleTimelineClick}
			onMouseEnter={handleTimelineMouseEnter}
			onMouseMove={handleTimelineMouseMove}
			onMouseLeave={handleTimelineMouseLeave}
		>
			<TimelineAxis videoDurationMs={videoDurationMs} currentTimeMs={currentTimeMs} />
			<PlaybackCursor
				currentTimeMs={currentTimeMs}
				videoDurationMs={videoDurationMs}
				onSeek={onSeek}
				timelineRef={localTimelineRef}
				keyframes={keyframes}
			/>
			{canShowGhostPlayhead && (
				<div
					className="absolute top-0 bottom-0 z-[45] pointer-events-none"
					style={{
						[sideProperty === "right" ? "marginRight" : "marginLeft"]: `${sidebarWidth - 1}px`,
					}}
				>
					<div className="absolute top-0 bottom-0 w-px bg-foreground/35" style={{ [sideProperty]: `${timelineGhostOffsetPx}px` }} />
				</div>
			)}

			<div className="relative z-10 flex flex-1 min-h-0 flex-col" style={{ minHeight: timelineRowsMinHeightPx }}>
				<TimelineCanvasRows
					items={items}
					videoDurationMs={videoDurationMs}
					selectAllBlocksActive={selectAllBlocksActive}
					selectedZoomId={selectedZoomId}
					selectedClipId={selectedClipId}
					selectedAnnotationId={selectedAnnotationId}
					selectedAudioId={selectedAudioId}
					onSelectZoom={onSelectZoom}
					onSelectClip={onSelectClip}
					onSelectAnnotation={onSelectAnnotation}
					onSelectAudio={onSelectAudio}
					audioPeaks={audioPeaks}
					direction={direction}
					canShowGhostZoom={canShowGhostZoom}
					ghostStartMs={ghostStartMs}
					ghostStartOffsetPx={ghostStartOffsetPx}
					ghostWidthPx={ghostWidthPx}
					onZoomRowMouseEnter={handleZoomRowMouseEnter}
					onZoomRowMouseMove={handleZoomRowMouseMove}
					onZoomRowMouseLeave={handleZoomRowMouseLeave}
					onZoomRowClick={handleZoomRowClick}
				/>
			</div>
		</div>
	);
}
