import { useTimelineContext } from "dnd-timeline";
import { useCallback, useMemo, useRef, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import glassStyles from "../../ItemGlass.module.css";
import Item from "../../Item";
import Row from "../../Row";
import {
	getTimelineContentMinHeightPx,
	getTimelineRowsMinHeightPx,
	getTimelineViewportStretchFactor,
	TIMELINE_AXIS_HEIGHT_PX,
} from "../../timelineLayout";
import type { AudioPeaksData } from "../../useAudioPeaks";
import AudioWaveform from "../../AudioWaveform";
import { CLIP_ROW_ID, ZOOM_ROW_ID } from "../../core/constants";
import {
	getAnnotationTrackIndex,
	getAnnotationTrackRowId,
	getAudioTrackIndex,
	getAudioTrackRowId,
	isAnnotationTrackRowId,
	isAudioTrackRowId,
} from "../../core/rows";
import type { TimelineRenderItem } from "../../model/timelineModel";
import TimelineAxis from "../axis/TimelineAxis";
import ClipMarkerOverlay from "../overlays/ClipMarkerOverlay";
import PlaybackCursor from "../playhead/PlaybackCursor";

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
	const [isTimelineHovered, setIsTimelineHovered] = useState(false);
	const [timelineHoverMs, setTimelineHoverMs] = useState<number | null>(null);
	const [isZoomRowHovered, setIsZoomRowHovered] = useState(false);
	const [zoomRowHoverMs, setZoomRowHoverMs] = useState<number | null>(null);

	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			setTimelineRef(node);
			localTimelineRef.current = node;
		},
		[setTimelineRef],
	);

	const handleTimelineClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
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

	const zoomItems = items.filter((item) => item.rowId === ZOOM_ROW_ID);
	const clipItems = items.filter((item) => item.rowId === CLIP_ROW_ID);
	const annotationItems = items.filter((item) => isAnnotationTrackRowId(item.rowId));
	const audioItems = items.filter((item) => isAudioTrackRowId(item.rowId));
	const audioRowIds = useMemo(
		() =>
			Array.from(new Set(audioItems.map((item) => getAudioTrackRowId(getAudioTrackIndex(item.rowId))))).sort(
				(left, right) => getAudioTrackIndex(left) - getAudioTrackIndex(right),
			),
		[audioItems],
	);
	const annotationRowIds = useMemo(
		() =>
			Array.from(
				new Set(annotationItems.map((item) => getAnnotationTrackRowId(getAnnotationTrackIndex(item.rowId)))),
			).sort((left, right) => getAnnotationTrackIndex(left) - getAnnotationTrackIndex(right)),
		[annotationItems],
	);

	const timelineRowCount = 2 + annotationRowIds.length + audioRowIds.length;
	const timelineRowsMinHeightPx = getTimelineRowsMinHeightPx(timelineRowCount);
	const timelineContentMinHeightPx = getTimelineContentMinHeightPx(timelineRowCount);
	const timelineViewportStretchFactor = getTimelineViewportStretchFactor(timelineRowCount);
	const sideProperty = direction === "rtl" ? "right" : "left";
	const visibleDurationMs = Math.max(1, range.end - range.start);

	const ghostStartMs = zoomRowHoverMs === null ? null : Math.max(0, Math.min(zoomRowHoverMs, videoDurationMs));
	const ghostDurationMs = Math.min(1000, videoDurationMs);
	const ghostEndMs =
		ghostStartMs === null
			? null
			: Math.max(ghostStartMs, Math.min(videoDurationMs, ghostStartMs + ghostDurationMs));
	const ghostStartOffsetPx = ghostStartMs === null ? 0 : valueToPixels(Math.max(0, ghostStartMs - range.start));
	const ghostEndOffsetPx = ghostEndMs === null ? 0 : valueToPixels(Math.max(0, ghostEndMs - range.start));
	const ghostWidthPx = Math.max(18, ghostEndOffsetPx - ghostStartOffsetPx);
	const timelineGhostOffsetPx = timelineHoverMs === null ? 0 : valueToPixels(Math.max(0, timelineHoverMs - range.start));
	const canShowGhostPlayhead = isTimelineHovered && timelineHoverMs !== null;
	const canShowGhostZoom =
		isZoomRowHovered && ghostStartMs !== null && (onAddZoomAtMs ? (canPlaceZoomAtMs?.(ghostStartMs) ?? true) : false);

	const updateTimelineHoverTime = useCallback(
		(clientX: number, rect: DOMRect) => {
			const contentWidth = Math.max(1, rect.width - sidebarWidth);
			const contentX =
				direction === "rtl" ? rect.right - sidebarWidth - clientX : clientX - rect.left - sidebarWidth;
			const clampedX = Math.max(0, Math.min(contentX, contentWidth));
			const ratio = clampedX / contentWidth;
			const nextMs = range.start + ratio * visibleDurationMs;
			setTimelineHoverMs(Math.max(0, Math.min(nextMs, videoDurationMs)));
		},
		[direction, range.start, sidebarWidth, videoDurationMs, visibleDurationMs],
	);

	const handleTimelineMouseEnter = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			setIsTimelineHovered(true);
			updateTimelineHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[updateTimelineHoverTime],
	);

	const handleTimelineMouseMove = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
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
			const nextMs = range.start + ratio * visibleDurationMs;
			setZoomRowHoverMs(Math.max(0, Math.min(nextMs, videoDurationMs)));
		},
		[direction, range.start, videoDurationMs, visibleDurationMs],
	);

	const handleZoomRowMouseEnter = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			setIsZoomRowHovered(true);
			updateZoomRowHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[updateZoomRowHoverTime],
	);
	const handleZoomRowMouseMove = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
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
		(event: React.MouseEvent<HTMLDivElement>) => {
			event.stopPropagation();
			if (!onAddZoomAtMs || zoomRowHoverMs === null) return;
			const startMs = Math.max(0, Math.min(zoomRowHoverMs, videoDurationMs));
			if (canPlaceZoomAtMs && !canPlaceZoomAtMs(startMs)) return;
			onAddZoomAtMs(startMs);
		},
		[canPlaceZoomAtMs, onAddZoomAtMs, videoDurationMs, zoomRowHoverMs],
	);

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
				<Row id={CLIP_ROW_ID} isEmpty={clipItems.length === 0} hint="Press C to split clip">
					{audioPeaks && <AudioWaveform peaks={audioPeaks} />}
					<ClipMarkerOverlay videoDurationMs={videoDurationMs} />
					{clipItems.map((item) => (
						<Item
							id={item.id}
							key={item.id}
							rowId={item.rowId}
							span={item.span}
							isSelected={selectAllBlocksActive || item.id === selectedClipId}
							onSelect={() => onSelectClip?.(item.id)}
							variant="clip"
						>
							{item.label}
						</Item>
					))}
				</Row>

				<Row
					id={ZOOM_ROW_ID}
					isEmpty={zoomItems.length === 0}
					onMouseEnter={handleZoomRowMouseEnter}
					onMouseMove={handleZoomRowMouseMove}
					onMouseLeave={handleZoomRowMouseLeave}
					onClick={handleZoomRowClick}
				>
					{canShowGhostZoom && ghostStartMs !== null && (
						<div className="absolute inset-0 z-[3] pointer-events-none">
							<div
								className="absolute top-1/2 -translate-y-1/2 h-[85%] min-h-[22px]"
								style={
									direction === "rtl"
										? { right: `${ghostStartOffsetPx}px`, width: `${ghostWidthPx}px` }
										: { left: `${ghostStartOffsetPx}px`, width: `${ghostWidthPx}px` }
								}
							>
								<div
									className={cn(
										glassStyles.glassPurple,
										"w-full h-full overflow-hidden flex items-center justify-center cursor-default relative opacity-80",
									)}
								>
									<div className={cn(glassStyles.zoomEndCap, glassStyles.left)} />
									<div className={cn(glassStyles.zoomEndCap, glassStyles.right)} />
									<div className="relative z-10 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/45 bg-white/15 text-white">
										<Plus className="h-2.5 w-2.5" />
									</div>
								</div>
							</div>
						</div>
					)}
					{zoomItems.map((item) => (
						<Item
							id={item.id}
							key={item.id}
							rowId={item.rowId}
							span={item.span}
							isSelected={selectAllBlocksActive || item.id === selectedZoomId}
							onSelect={() => onSelectZoom?.(item.id)}
							zoomDepth={item.zoomDepth}
							zoomMode={item.zoomMode}
							variant="zoom"
						>
							{item.label}
						</Item>
					))}
				</Row>

				{annotationRowIds.map((rowId, index) => {
					const rowItems = annotationItems.filter(
						(item) => getAnnotationTrackRowId(getAnnotationTrackIndex(item.rowId)) === rowId,
					);
					return (
						<Row key={rowId} id={rowId} isEmpty={rowItems.length === 0} hint={index === 0 ? "Press A to add annotation" : undefined}>
							{rowItems.map((item) => (
								<Item
									id={item.id}
									key={item.id}
									rowId={item.rowId}
									span={item.span}
									isSelected={selectAllBlocksActive || item.id === selectedAnnotationId}
									onSelect={() => onSelectAnnotation?.(item.id)}
									variant="annotation"
								>
									{item.label}
								</Item>
							))}
						</Row>
					);
				})}

				{audioRowIds.map((rowId, index) => {
					const rowItems = audioItems.filter(
						(item) => getAudioTrackRowId(getAudioTrackIndex(item.rowId)) === rowId,
					);
					return (
						<Row key={rowId} id={rowId} isEmpty={rowItems.length === 0} hint={index === 0 ? "Click music icon to add audio" : undefined}>
							{rowItems.map((item) => (
								<Item
									id={item.id}
									key={item.id}
									rowId={item.rowId}
									span={item.span}
									isSelected={selectAllBlocksActive || item.id === selectedAudioId}
									onSelect={() => onSelectAudio?.(item.id)}
									variant="audio"
								>
									{item.label}
								</Item>
							))}
						</Row>
					);
				})}
			</div>
		</div>
	);
}
