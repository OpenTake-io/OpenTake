import {
	Check,
	CaretDown as ChevronDown,
	Crop,
	ChatText as MessageSquare,
	MusicNote as Music,
	Plus,
	Scissors,
	MagicWand as WandSparkles,
	MagnifyingGlassPlus as ZoomIn,
} from "@phosphor-icons/react";
import type { Span } from "dnd-timeline";
import { useTimelineContext } from "dnd-timeline";
import {
	forwardRef,
	type KeyboardEvent as ReactKeyboardEvent,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useScopedT } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import { cn } from "@/lib/utils";
import {
	ASPECT_RATIOS,
	type AspectRatio,
	getAspectRatioLabel,
	isCustomAspectRatio,
} from "@/utils/aspectRatioUtils";
import { formatShortcut } from "@/utils/platformUtils";
import { loadEditorPreferences, saveEditorPreferences } from "../editorPreferences";
import type {
	AnnotationRegion,
	AudioRegion,
	ClipRegion,
	CursorTelemetryPoint,
	SpeedRegion,
	TrimRegion,
	ZoomFocus,
	ZoomRegion,
} from "../types";
import AudioWaveform from "./AudioWaveform";
import Item from "./Item";
import glassStyles from "./ItemGlass.module.css";
import KeyframeMarkers from "./KeyframeMarkers";
import Row from "./Row";
import TimelineWrapper from "./TimelineWrapper";
import {
	getTimelineContentMinHeightPx,
	getTimelineRowsMinHeightPx,
	getTimelineViewportStretchFactor,
	TIMELINE_AXIS_HEIGHT_PX,
} from "./timelineLayout";
import { type AudioPeaksData, useAudioPeaks } from "./useAudioPeaks";
import { CLIP_ROW_ID, ZOOM_ROW_ID } from "./core/constants";
import { getAnnotationTrackIndex, getAnnotationTrackRowId, getAudioTrackIndex, getAudioTrackRowId, isAnnotationTrackRowId, isAudioTrackRowId } from "./core/rows";
import { spansOverlap } from "./core/spans";
import { calculateAxisScale, calculateTimelineScale, formatPlayheadTime, formatTimeLabel } from "./core/time";
import { buildAllRegionSpans, buildTimelineItems, resolveDropRowId, type TimelineRenderItem } from "./model/timelineModel";
import { useTimelineAnnotationsActions } from "./hooks/useTimelineAnnotationsActions";
import { useTimelineAudioActions } from "./hooks/useTimelineAudioActions";
import { useTimelineKeyboardShortcuts } from "./hooks/useTimelineKeyboardShortcuts";
import { useTimelineNormalization } from "./hooks/useTimelineNormalization";
import { useTimelineRange } from "./hooks/useTimelineRange";
import { useTimelineSelection } from "./hooks/useTimelineSelection";
import { useTimelineZoomActions } from "./hooks/useTimelineZoomActions";

export interface TimelineEditorProps {
	videoDuration: number;
	currentTime: number;
	playheadTime?: number;
	onSeek?: (time: number) => void;
	cursorTelemetry?: CursorTelemetryPoint[];
	autoSuggestZoomsTrigger?: number;
	onAutoSuggestZoomsConsumed?: () => void;
	disableSuggestedZooms?: boolean;
	zoomRegions: ZoomRegion[];
	onZoomAdded: (span: Span) => void;
	onZoomSuggested?: (span: Span, focus: ZoomFocus) => void;
	onZoomSpanChange: (id: string, span: Span) => void;
	onZoomDelete: (id: string) => void;
	selectedZoomId: string | null;
	onSelectZoom: (id: string | null) => void;
	trimRegions?: TrimRegion[];
	onTrimAdded?: (span: Span) => void;
	onTrimSpanChange?: (id: string, span: Span) => void;
	onTrimDelete?: (id: string) => void;
	selectedTrimId?: string | null;
	onSelectTrim?: (id: string | null) => void;
	clipRegions?: ClipRegion[];
	onClipSplit?: (splitMs: number) => void;
	onClipSpanChange?: (id: string, span: Span) => void;
	onClipDelete?: (id: string) => void;
	selectedClipId?: string | null;
	onSelectClip?: (id: string | null) => void;
	annotationRegions?: AnnotationRegion[];
	onAnnotationAdded?: (span: Span, trackIndex?: number) => void;
	onAnnotationSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onAnnotationDelete?: (id: string) => void;
	selectedAnnotationId?: string | null;
	onSelectAnnotation?: (id: string | null) => void;
	speedRegions?: SpeedRegion[];
	onSpeedAdded?: (span: Span) => void;
	onSpeedSpanChange?: (id: string, span: Span) => void;
	onSpeedDelete?: (id: string) => void;
	selectedSpeedId?: string | null;
	onSelectSpeed?: (id: string | null) => void;
	audioRegions?: AudioRegion[];
	onAudioAdded?: (span: Span, audioPath: string, trackIndex?: number) => void;
	onAudioSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onAudioDelete?: (id: string) => void;
	selectedAudioId?: string | null;
	onSelectAudio?: (id: string | null) => void;
	aspectRatio?: AspectRatio;
	onAspectRatioChange?: (aspectRatio: AspectRatio) => void;
	onOpenCropEditor?: () => void;
	isCropped?: boolean;
	videoPath?: string | null;
	hideToolbar?: boolean;
}

export interface TimelineEditorHandle {
	addZoom: () => void;
	suggestZooms: () => void;
	splitClip: () => void;
	addAnnotation: (trackIndex?: number) => void;
	addAudio: (trackIndex?: number) => Promise<void>;
	keyframes: { id: string; time: number }[];
}


function PlaybackCursor({
	currentTimeMs,
	videoDurationMs,
	onSeek,
	timelineRef,
	keyframes = [],
}: {
	currentTimeMs: number;
	videoDurationMs: number;
	onSeek?: (time: number) => void;
	timelineRef: React.RefObject<HTMLDivElement>;
	keyframes?: { id: string; time: number }[];
}) {
	const { sidebarWidth, direction, range, valueToPixels, pixelsToValue } = useTimelineContext();
	const sideProperty = direction === "rtl" ? "right" : "left";
	const [isDragging, setIsDragging] = useState(false);

	useEffect(() => {
		if (!isDragging) return;

		const handleMouseMove = (e: MouseEvent) => {
			if (!timelineRef.current || !onSeek) return;

			const rect = timelineRef.current.getBoundingClientRect();
			const clickX = e.clientX - rect.left - sidebarWidth;

			// Allow dragging outside to 0 or max, but clamp the value
			const relativeMs = pixelsToValue(clickX);
			let absoluteMs = Math.max(0, Math.min(range.start + relativeMs, videoDurationMs));

			// Snap to nearby keyframe if within threshold (150ms)
			const snapThresholdMs = 150;
			const nearbyKeyframe = keyframes.find(
				(kf) =>
					Math.abs(kf.time - absoluteMs) <= snapThresholdMs &&
					kf.time >= range.start &&
					kf.time <= range.end,
			);

			if (nearbyKeyframe) {
				absoluteMs = nearbyKeyframe.time;
			}

			onSeek(absoluteMs / 1000);
		};

		const handleMouseUp = () => {
			setIsDragging(false);
			document.body.style.cursor = "";
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		document.body.style.cursor = "ew-resize";

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
			document.body.style.cursor = "";
		};
	}, [
		isDragging,
		onSeek,
		timelineRef,
		sidebarWidth,
		range.start,
		range.end,
		videoDurationMs,
		pixelsToValue,
		keyframes,
	]);

	if (videoDurationMs <= 0 || currentTimeMs < 0) {
		return null;
	}

	const clampedTime = Math.min(currentTimeMs, videoDurationMs);

	if (clampedTime < range.start || clampedTime > range.end) {
		return null;
	}

	const offset = valueToPixels(clampedTime - range.start);

	return (
		<div
			className="absolute top-0 bottom-0 z-50 group/cursor"
			style={{
				[sideProperty === "right" ? "marginRight" : "marginLeft"]: `${sidebarWidth - 1}px`,
				pointerEvents: "none", // Allow clicks to pass through to timeline, but we'll enable pointer events on the handle
			}}
		>
			<div
				className="absolute top-0 bottom-0 w-[2px] bg-[#2563EB] shadow-[0_0_10px_rgba(37,99,235,0.5)] cursor-ew-resize pointer-events-auto hover:shadow-[0_0_15px_rgba(37,99,235,0.7)] transition-shadow"
				style={{
					[sideProperty]: `${offset}px`,
				}}
				onMouseDown={(e) => {
					e.stopPropagation(); // Prevent timeline click
					setIsDragging(true);
				}}
			>
				<div
					className="absolute -top-1 left-1/2 -translate-x-1/2 hover:scale-125 transition-transform"
					style={{ width: "16px", height: "16px" }}
				>
					<div className="w-3 h-3 mx-auto mt-[2px] bg-[#2563EB] rotate-45 rounded-sm shadow-lg border border-foreground/20" />
				</div>
				<div
					className={cn(
						"absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] text-white/90 font-medium tabular-nums whitespace-nowrap border border-foreground/10 shadow-lg pointer-events-none",
						isDragging ? "opacity-100" : "opacity-0",
					)}
				>
					<span className="leading-5">{formatPlayheadTime(clampedTime)}</span>
				</div>
			</div>
		</div>
	);
}

function TimelineAxis({
	videoDurationMs,
	currentTimeMs,
}: {
	videoDurationMs: number;
	currentTimeMs: number;
}) {
	const { sidebarWidth, direction, range, valueToPixels } = useTimelineContext();
	const sideProperty = direction === "rtl" ? "right" : "left";

	const { intervalMs } = useMemo(
		() => calculateAxisScale(range.end - range.start),
		[range.end, range.start],
	);

	const markers = useMemo(() => {
		if (intervalMs <= 0) {
			return { markers: [], minorTicks: [] };
		}

		const maxTime = videoDurationMs > 0 ? videoDurationMs : range.end;
		const visibleStart = Math.max(0, Math.min(range.start, maxTime));
		const visibleEnd = Math.min(range.end, maxTime);
		const markerTimes = new Set<number>();

		const firstMarker = Math.ceil(visibleStart / intervalMs) * intervalMs;

		for (let time = firstMarker; time <= maxTime; time += intervalMs) {
			if (time >= visibleStart && time <= visibleEnd) {
				markerTimes.add(Math.round(time));
			}
		}

		if (visibleStart <= maxTime) {
			markerTimes.add(Math.round(visibleStart));
		}

		if (videoDurationMs > 0) {
			markerTimes.add(Math.round(videoDurationMs));
		}

		const sorted = Array.from(markerTimes)
			.filter((time) => time <= maxTime)
			.sort((a, b) => a - b);

		// Generate minor ticks (4 ticks between major intervals)
		const minorTicks = [];
		const minorInterval = intervalMs / 5;

		for (let time = firstMarker; time <= maxTime; time += minorInterval) {
			if (time >= visibleStart && time <= visibleEnd) {
				// Skip if it's close to a major marker
				const isMajor = Math.abs(time % intervalMs) < 1;
				if (!isMajor) {
					minorTicks.push(time);
				}
			}
		}

		return {
			markers: sorted.map((time) => ({
				time,
				label: formatTimeLabel(time, intervalMs),
			})),
			minorTicks,
		};
	}, [intervalMs, range.end, range.start, videoDurationMs]);

	return (
		<div
			className="h-8 bg-editor-bg border-b border-foreground/10 relative overflow-hidden select-none"
			style={{
				[sideProperty === "right" ? "marginRight" : "marginLeft"]: `${sidebarWidth}px`,
			}}
		>
			{/* Minor Ticks */}
			{markers.minorTicks.map((time) => {
				const offset = valueToPixels(time - range.start);
				return (
					<div
						key={`minor-${time}`}
						className="absolute bottom-1 h-1 w-[1px] bg-foreground/5"
						style={{ [sideProperty]: `${offset}px` }}
					/>
				);
			})}

			{/* Major Markers */}
			{markers.markers.map((marker) => {
				const offset = valueToPixels(marker.time - range.start);
				const markerStyle: React.CSSProperties = {
					position: "absolute",
					bottom: 0,
					height: "100%",
					display: "flex",
					flexDirection: "row",
					alignItems: "flex-end",
					[sideProperty]: `${offset}px`,
					transform: "translateX(-50%)",
				};

				return (
					<div key={marker.time} style={markerStyle}>
						<div className="flex flex-col items-center pb-1">
							<div className="mb-1.5 h-[5px] w-[5px] rounded-full bg-foreground/30" />
							<span
								className={cn(
									"text-[10px] font-medium tabular-nums tracking-tight",
									marker.time === currentTimeMs
										? "text-[#2563EB]"
										: "text-foreground/40",
								)}
							>
								{marker.label}
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
}

function ClipMarkerOverlay({ videoDurationMs }: { videoDurationMs: number }) {
	const { direction, range, valueToPixels } = useTimelineContext();
	const sideProperty = direction === "rtl" ? "right" : "left";

	const { intervalMs } = useMemo(
		() => calculateAxisScale(range.end - range.start),
		[range.end, range.start],
	);

	const markers = useMemo(() => {
		if (intervalMs <= 0) return [];
		const maxTime = videoDurationMs > 0 ? videoDurationMs : range.end;
		const visibleStart = Math.max(0, range.start);
		const visibleEnd = Math.min(range.end, maxTime);
		const firstMarker = Math.ceil(visibleStart / intervalMs) * intervalMs;
		const result: { time: number; offset: number }[] = [];
		for (let time = firstMarker; time <= maxTime; time += intervalMs) {
			if (time > visibleStart && time < visibleEnd) {
				result.push({
					time: Math.round(time),
					offset: valueToPixels(Math.round(time) - range.start),
				});
			}
		}
		return result;
	}, [intervalMs, range.start, range.end, videoDurationMs, valueToPixels]);

	return (
		<div className="pointer-events-none absolute inset-0 z-[1]">
			{markers.map(({ time, offset }) => (
				<div
					key={time}
					className="absolute w-px"
					style={{
						top: "7.5%",
						bottom: "7.5%",
						[sideProperty]: `${offset}px`,
						background:
							"linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.32) 35%, rgba(255,255,255,0.32) 65%, transparent 100%)",
					}}
				/>
			))}
		</div>
	);
}

function Timeline({
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
}: {
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
}) {
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

			// Only clear selection if clicking on empty space (not on items)
			// This is handled by event propagation - items stop propagation
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
			const timeInSeconds = absoluteMs / 1000;

			onSeek(timeInSeconds);
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
			Array.from(
				new Set(
					audioItems.map((item) => getAudioTrackRowId(getAudioTrackIndex(item.rowId))),
				),
			).sort((left, right) => getAudioTrackIndex(left) - getAudioTrackIndex(right)),
		[audioItems],
	);
	const annotationRowIds = useMemo(
		() =>
			Array.from(
				new Set(
					annotationItems.map((item) =>
						getAnnotationTrackRowId(getAnnotationTrackIndex(item.rowId)),
					),
				),
			).sort((left, right) => getAnnotationTrackIndex(left) - getAnnotationTrackIndex(right)),
		[annotationItems],
	);
	const timelineRowCount = 2 + annotationRowIds.length + audioRowIds.length;
	const timelineRowsMinHeightPx = getTimelineRowsMinHeightPx(timelineRowCount);
	const timelineContentMinHeightPx = getTimelineContentMinHeightPx(timelineRowCount);
	const timelineViewportStretchFactor = getTimelineViewportStretchFactor(timelineRowCount);
	const sideProperty = direction === "rtl" ? "right" : "left";
	const visibleDurationMs = Math.max(1, range.end - range.start);
	const ghostStartMs =
		zoomRowHoverMs === null ? null : Math.max(0, Math.min(zoomRowHoverMs, videoDurationMs));
	const ghostDurationMs = Math.min(1000, videoDurationMs);
	const ghostEndMs =
		ghostStartMs === null
			? null
			: Math.max(ghostStartMs, Math.min(videoDurationMs, ghostStartMs + ghostDurationMs));
	const ghostStartOffsetPx =
		ghostStartMs === null ? 0 : valueToPixels(Math.max(0, ghostStartMs - range.start));
	const ghostEndOffsetPx =
		ghostEndMs === null ? 0 : valueToPixels(Math.max(0, ghostEndMs - range.start));
	const ghostWidthPx = Math.max(18, ghostEndOffsetPx - ghostStartOffsetPx);
	const timelineGhostOffsetPx =
		timelineHoverMs === null ? 0 : valueToPixels(Math.max(0, timelineHoverMs - range.start));
	const canShowGhostPlayhead = isTimelineHovered && timelineHoverMs !== null;
	const canShowGhostZoom =
		isZoomRowHovered &&
		ghostStartMs !== null &&
		(onAddZoomAtMs ? (canPlaceZoomAtMs?.(ghostStartMs) ?? true) : false);

	const updateTimelineHoverTime = useCallback(
		(clientX: number, rect: DOMRect) => {
			const contentWidth = Math.max(1, rect.width - sidebarWidth);

			const contentX =
				direction === "rtl"
					? rect.right - sidebarWidth - clientX
					: clientX - rect.left - sidebarWidth;
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
			if (!isTimelineHovered) {
				setIsTimelineHovered(true);
			}
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
			if (rect.width <= 0) {
				return;
			}

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
			if (!isZoomRowHovered) {
				setIsZoomRowHovered(true);
			}
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
			if (!onAddZoomAtMs || zoomRowHoverMs === null) {
				return;
			}

			const startMs = Math.max(0, Math.min(zoomRowHoverMs, videoDurationMs));
			if (canPlaceZoomAtMs && !canPlaceZoomAtMs(startMs)) {
				return;
			}

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
						[sideProperty === "right" ? "marginRight" : "marginLeft"]:
							`${sidebarWidth - 1}px`,
					}}
				>
					<div
						className="absolute top-0 bottom-0 w-px bg-foreground/35"
						style={{ [sideProperty]: `${timelineGhostOffsetPx}px` }}
					/>
				</div>
			)}

			<div
				className="relative z-10 flex flex-1 min-h-0 flex-col"
				style={{ minHeight: timelineRowsMinHeightPx }}
			>
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
										? {
												right: `${ghostStartOffsetPx}px`,
												width: `${ghostWidthPx}px`,
											}
										: {
												left: `${ghostStartOffsetPx}px`,
												width: `${ghostWidthPx}px`,
											}
								}
							>
								<div
									className={cn(
										glassStyles.glassPurple,
										"w-full h-full overflow-hidden flex items-center justify-center cursor-default relative opacity-80",
									)}
								>
									<div className={cn(glassStyles.zoomEndCap, glassStyles.left)} />
									<div
										className={cn(glassStyles.zoomEndCap, glassStyles.right)}
									/>
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
						(item) =>
							getAnnotationTrackRowId(getAnnotationTrackIndex(item.rowId)) === rowId,
					);

					return (
						<Row
							key={rowId}
							id={rowId}
							isEmpty={rowItems.length === 0}
							hint={index === 0 ? "Press A to add annotation" : undefined}
						>
							{rowItems.map((item) => (
								<Item
									id={item.id}
									key={item.id}
									rowId={item.rowId}
									span={item.span}
									isSelected={
										selectAllBlocksActive || item.id === selectedAnnotationId
									}
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
						<Row
							key={rowId}
							id={rowId}
							isEmpty={rowItems.length === 0}
							hint={index === 0 ? "Click music icon to add audio" : undefined}
						>
							{rowItems.map((item) => (
								<Item
									id={item.id}
									key={item.id}
									rowId={item.rowId}
									span={item.span}
									isSelected={
										selectAllBlocksActive || item.id === selectedAudioId
									}
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

const TimelineEditor = forwardRef<TimelineEditorHandle, TimelineEditorProps>(
	function TimelineEditor(
		{
			videoDuration,
			currentTime,
			playheadTime,
			onSeek,
			cursorTelemetry = [],
			autoSuggestZoomsTrigger = 0,
			onAutoSuggestZoomsConsumed,
			disableSuggestedZooms = false,
			zoomRegions,
			onZoomAdded,
			onZoomSuggested,
			onZoomSpanChange,
			onZoomDelete,
			selectedZoomId,
			onSelectZoom,
			trimRegions = [],
			onTrimAdded: _onTrimAdded,
			onTrimSpanChange,
			onTrimDelete: _onTrimDelete,
			selectedTrimId: _selectedTrimId,
			onSelectTrim: _onSelectTrim,
			clipRegions = [],
			onClipSplit,
			onClipSpanChange,
			onClipDelete,
			selectedClipId,
			onSelectClip,
			annotationRegions = [],
			onAnnotationAdded,
			onAnnotationSpanChange,
			onAnnotationDelete,
			selectedAnnotationId,
			onSelectAnnotation,
			speedRegions = [],
			onSpeedAdded: _onSpeedAdded,
			onSpeedSpanChange,
			onSpeedDelete: _onSpeedDelete,
			selectedSpeedId: _selectedSpeedId,
			onSelectSpeed: _onSelectSpeed,
			audioRegions = [],
			onAudioAdded,
			onAudioSpanChange,
			onAudioDelete,
			selectedAudioId,
			onSelectAudio,
			aspectRatio = "native",
			onAspectRatioChange,
			onOpenCropEditor,
			isCropped = false,
			videoPath,
			hideToolbar = false,
		},
		ref,
	) {
		const t = useScopedT("settings");
		const initialEditorPreferences = useMemo(() => loadEditorPreferences(), []);
		const totalMs = useMemo(
			() => Math.max(0, Math.round(videoDuration * 1000)),
			[videoDuration],
		);
		const currentTimeMs = useMemo(
			() => Math.round((playheadTime ?? currentTime) * 1000),
			[currentTime, playheadTime],
		);
		const timelineScale = useMemo(() => calculateTimelineScale(videoDuration), [videoDuration]);
		const safeMinDurationMs = useMemo(
			() =>
				totalMs > 0
					? Math.min(timelineScale.minItemDurationMs, totalMs)
					: timelineScale.minItemDurationMs,
			[timelineScale.minItemDurationMs, totalMs],
		);

		const timelineContainerRef = useRef<HTMLDivElement>(null);
		const isTimelineFocusedRef = useRef(false);
		const { setRange, clampedRange, handleTimelineWheel } = useTimelineRange({
			totalMs,
			timelineContainerRef,
		});
		const [customAspectWidth, setCustomAspectWidth] = useState(
			initialEditorPreferences.customAspectWidth,
		);
		const [customAspectHeight, setCustomAspectHeight] = useState(
			initialEditorPreferences.customAspectHeight,
		);
		const [scrollLabels, setScrollLabels] = useState({
			pan: "Shift + Ctrl + Scroll",
			zoom: "Ctrl + Scroll",
		});
		const { shortcuts: keyShortcuts, isMac } = useShortcuts();
		const audioPeaks = useAudioPeaks(videoPath);

		useEffect(() => {
			if (aspectRatio === "native") {
				return;
			}
			const [width, height] = aspectRatio.split(":");
			if (width && height) {
				setCustomAspectWidth(width);
				setCustomAspectHeight(height);
			}
		}, [aspectRatio]);

		useEffect(() => {
			saveEditorPreferences({
				customAspectWidth,
				customAspectHeight,
			});
		}, [customAspectHeight, customAspectWidth]);

		const applyCustomAspectRatio = useCallback(() => {
			const width = Number.parseInt(customAspectWidth, 10);
			const height = Number.parseInt(customAspectHeight, 10);
			if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
				toast.error("Custom aspect ratio must be positive numbers.");
				return;
			}
			onAspectRatioChange?.(`${width}:${height}` as AspectRatio);
		}, [customAspectHeight, customAspectWidth, onAspectRatioChange]);

		const handleCustomAspectRatioKeyDown = useCallback(
			(event: ReactKeyboardEvent<HTMLInputElement>) => {
				// Prevent Radix DropdownMenu typeahead from selecting preset items while typing.
				event.stopPropagation();
				if (event.key === "Enter") {
					event.preventDefault();
					applyCustomAspectRatio();
				}
			},
			[applyCustomAspectRatio],
		);

		useEffect(() => {
			formatShortcut(["shift", "mod", "Scroll"]).then((pan) => {
				formatShortcut(["mod", "Scroll"]).then((zoom) => {
					setScrollLabels({ pan, zoom });
				});
			});
		}, []);
		const {
			keyframes,
			selectedKeyframeId,
			setSelectedKeyframeId,
			selectAllBlocksActive,
			setSelectAllBlocksActive,
			hasAnyTimelineBlocks,
			addKeyframe,
			deleteSelectedKeyframe,
			handleKeyframeMove,
			deleteSelectedZoom,
			deleteSelectedClip,
			deleteSelectedAnnotation,
			deleteSelectedAudio,
			clearSelectedBlocks,
			deleteAllBlocks,
			handleSelectZoom,
			handleSelectClip,
			handleSelectAnnotation,
			handleSelectAudio,
			cycleAnnotationsAtCurrentTime,
		} = useTimelineSelection({
			totalMs,
			currentTimeMs,
			zoomRegions,
			clipRegions,
			annotationRegions,
			audioRegions,
			selectedZoomId,
			selectedClipId,
			selectedAnnotationId,
			selectedAudioId,
			onZoomDelete,
			onClipDelete,
			onAnnotationDelete,
			onAudioDelete,
			onSelectZoom,
			onSelectClip,
			onSelectAnnotation,
			onSelectAudio,
		});

		useTimelineNormalization({
			totalMs,
			safeMinDurationMs,
			zoomRegions,
			trimRegions,
			speedRegions,
			audioRegions,
			onZoomSpanChange,
			onTrimSpanChange,
			onSpeedSpanChange,
			onAudioSpanChange,
		});

		const hasOverlap = useCallback(
			(newSpan: Span, excludeId?: string, rowId?: string): boolean => {
				// Determine which row the item belongs to
				const isZoomItem = zoomRegions.some((r) => r.id === excludeId);
				const isTrimItem = trimRegions.some((r) => r.id === excludeId);
				const isClipItem = clipRegions.some((r) => r.id === excludeId);
				const isAnnotationItem = annotationRegions.some((r) => r.id === excludeId);
				const isSpeedItem = speedRegions.some((r) => r.id === excludeId);
				const isAudioItem = audioRegions.some((r) => r.id === excludeId);

				if (isAnnotationItem) {
					return false;
				}

				// Helper to check overlap against a specific set of regions
				const checkOverlap = (
					regions: (ZoomRegion | TrimRegion | ClipRegion | SpeedRegion | AudioRegion)[],
				) => {
					return regions.some((region) => {
						if (region.id === excludeId) return false;
						// True overlap: regions actually intersect (not just adjacent)
						return spansOverlap(newSpan, {
							start: region.startMs,
							end: region.endMs,
						});
					});
				};

				if (isZoomItem) {
					return checkOverlap(zoomRegions);
				}

				if (isTrimItem) {
					return checkOverlap(trimRegions);
				}

				if (isClipItem) {
					return checkOverlap(clipRegions);
				}

				if (isSpeedItem) {
					return checkOverlap(speedRegions);
				}

				if (isAudioItem) {
					const activeAudioRegion = audioRegions.find(
						(region) => region.id === excludeId,
					);
					const activeTrackIndex =
						rowId && isAudioTrackRowId(rowId)
							? getAudioTrackIndex(rowId)
							: (activeAudioRegion?.trackIndex ?? 0);
					return checkOverlap(
						audioRegions.filter(
							(region) => (region.trackIndex ?? 0) === activeTrackIndex,
						),
					);
				}

				return false;
			},
			[zoomRegions, trimRegions, clipRegions, annotationRegions, speedRegions, audioRegions],
		);

		// Keep newly added timeline regions at the original short default instead of
		// scaling them with the full recording length.
		const {
			defaultRegionDurationMs,
			canPlaceZoomAtMs,
			addZoomAtMs,
			handleAddZoom,
			handleSuggestZooms,
		} = useTimelineZoomActions({
			videoDuration,
			totalMs,
			currentTimeMs,
			zoomRegions,
			clipRegions,
			cursorTelemetry,
			disableSuggestedZooms,
			autoSuggestZoomsTrigger,
			onAutoSuggestZoomsConsumed,
			onZoomAdded,
			onZoomSuggested,
		});

		const handleSplitClip = useCallback(() => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onClipSplit) {
				return;
			}
			onClipSplit(currentTimeMs);
		}, [videoDuration, totalMs, currentTimeMs, onClipSplit]);

		const { handleAddAudio } = useTimelineAudioActions({
			videoDuration,
			totalMs,
			currentTimeMs,
			audioRegions,
			onAudioAdded,
		});

		const { handleAddAnnotation } = useTimelineAnnotationsActions({
			videoDuration,
			totalMs,
			currentTimeMs,
			defaultRegionDurationMs,
			onAnnotationAdded,
		});

		useTimelineKeyboardShortcuts({
			isMac,
			keyShortcuts,
			isTimelineFocusedRef,
			hasAnyTimelineBlocks,
			annotationCount: annotationRegions.length,
			selectedKeyframeId,
			selectedZoomId,
			selectedClipId,
			selectedAnnotationId,
			selectedAudioId,
			selectAllBlocksActive,
			setSelectAllBlocksActive,
			setSelectedKeyframeId,
			addKeyframe,
			handleAddZoom,
			handleSplitClip,
			handleAddAnnotation: () => handleAddAnnotation(),
			deleteAllBlocks,
			deleteSelectedKeyframe,
			deleteSelectedZoom,
			deleteSelectedClip,
			deleteSelectedAnnotation,
			deleteSelectedAudio,
			cycleAnnotationsAtCurrentTime,
		});

		useImperativeHandle(
			ref,
			() => ({
				addZoom: handleAddZoom,
				suggestZooms: handleSuggestZooms,
				splitClip: handleSplitClip,
				addAnnotation: handleAddAnnotation,
				addAudio: handleAddAudio,
				keyframes,
			}),
			[
				handleAddAnnotation,
				handleAddAudio,
				handleAddZoom,
				handleSuggestZooms,
				handleSplitClip,
				keyframes,
			],
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

		// Flat list of draggable row spans for neighbour-clamping during drag/resize.
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
			(id: string, proposedRowId: string) =>
				resolveDropRowId(id, proposedRowId, timelineItems),
			[timelineItems],
		);

		const handleItemSpanChange = useCallback(
			(id: string, span: Span, rowId?: string) => {
				// Check if it's a zoom, trim, clip, speed, or annotation item
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
							: (annotationRegions.find((region) => region.id === id)?.trackIndex ??
								0);
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


		if (!videoDuration || videoDuration === 0) {
			return (
				<div className="flex-1 flex flex-col items-center justify-center rounded-lg bg-editor-surface gap-3">
					<div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center">
						<Plus className="w-6 h-6 text-muted-foreground" />
					</div>
					<div className="text-center">
						<p className="text-sm font-medium text-muted-foreground">No Video Loaded</p>
						<p className="text-xs text-muted-foreground/70 mt-1">
							Drag and drop a video to start editing
						</p>
					</div>
				</div>
			);
		}

		return (
			<div className="flex-1 min-h-0 flex flex-col bg-editor-bg overflow-hidden">
				{hideToolbar ? null : (
					<div className="flex items-center gap-2 px-4 py-2 border-b border-foreground/10 bg-editor-panel">
						<div className="flex items-center gap-1">
							<Button
								onClick={handleAddZoom}
								variant="ghost"
								size="icon"
								className="h-7 w-7 text-muted-foreground hover:text-[#2563EB] hover:bg-[#2563EB]/10 transition-all"
								title="Add Zoom (Z)"
							>
								<ZoomIn className="w-4 h-4" />
							</Button>
							<Button
								onClick={handleSuggestZooms}
								variant="ghost"
								size="icon"
								className="h-7 w-7 text-muted-foreground hover:text-[#2563EB] hover:bg-[#2563EB]/10 transition-all"
								title="Suggest Zooms from Cursor"
							>
								<WandSparkles className="w-4 h-4" />
							</Button>
							<Button
								onClick={() => handleAddAnnotation()}
								variant="ghost"
								size="icon"
								className="h-7 w-7 text-muted-foreground hover:text-[#B4A046] hover:bg-[#B4A046]/10 transition-all"
								title="Add Annotation (A)"
							>
								<MessageSquare className="w-4 h-4" />
							</Button>
							<Button
								onClick={() => {
									void handleAddAudio();
								}}
								variant="ghost"
								size="icon"
								className="h-7 w-7 text-muted-foreground hover:text-[#a855f7] hover:bg-[#a855f7]/10 transition-all"
								title="Add Audio"
							>
								<Music className="w-4 h-4" />
							</Button>
							<Button
								onClick={handleSplitClip}
								variant="ghost"
								size="icon"
								className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all"
								title="Split Clip (C)"
							>
								<Scissors className="w-4 h-4" />
							</Button>
						</div>
						<div className="flex items-center gap-2">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all gap-1"
									>
										<span className="font-medium">
											{getAspectRatioLabel(aspectRatio)}
										</span>
										<ChevronDown className="w-3 h-3" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									className="bg-editor-surface-alt border-foreground/10"
								>
									{ASPECT_RATIOS.map((ratio) => (
										<DropdownMenuItem
											key={ratio}
											onClick={() => onAspectRatioChange?.(ratio)}
											className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 cursor-pointer flex items-center justify-between gap-3"
										>
											<span>{getAspectRatioLabel(ratio)}</span>
											{aspectRatio === ratio && (
												<Check className="w-3 h-3 text-[#2563EB]" />
											)}
										</DropdownMenuItem>
									))}
									<div className="mx-1 my-1 h-px bg-foreground/10" />
									<div className="px-2 py-1.5 flex items-center gap-2 text-muted-foreground">
										<span className="text-sm">Custom</span>
										<input
											type="text"
											inputMode="numeric"
											value={customAspectWidth}
											onChange={(event) =>
												setCustomAspectWidth(
													event.target.value.replace(/\D/g, ""),
												)
											}
											onKeyDown={handleCustomAspectRatioKeyDown}
											className="w-12 h-7 rounded border border-foreground/10 bg-foreground/5 px-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
											aria-label="Custom aspect width"
										/>
										<span className="text-muted-foreground/70">:</span>
										<input
											type="text"
											inputMode="numeric"
											value={customAspectHeight}
											onChange={(event) =>
												setCustomAspectHeight(
													event.target.value.replace(/\D/g, ""),
												)
											}
											onKeyDown={handleCustomAspectRatioKeyDown}
											className="w-12 h-7 rounded border border-foreground/10 bg-foreground/5 px-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
											aria-label="Custom aspect height"
										/>
										<Button
											variant="ghost"
											size="sm"
											onClick={applyCustomAspectRatio}
											className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10"
										>
											Set
										</Button>
										{isCustomAspectRatio(aspectRatio) && (
											<Check className="w-3 h-3 text-[#2563EB] ml-auto" />
										)}
									</div>
								</DropdownMenuContent>
							</DropdownMenu>
							<div className="w-[1px] h-4 bg-foreground/10" />
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onOpenCropEditor?.()}
								className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all gap-1.5"
							>
								<Crop className="w-3.5 h-3.5" />
								<span className="font-medium">{t("sections.crop", "Crop")}</span>
								{isCropped ? (
									<span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
								) : null}
							</Button>
						</div>
						<div className="flex-1" />
						<div className="flex items-center gap-4 text-[10px] text-muted-foreground/70 font-medium">
							<span className="flex items-center gap-1.5">
								<kbd className="px-1.5 py-0.5 bg-foreground/5 border border-foreground/10 rounded text-[#2563EB] font-sans">
									Side Scroll
								</kbd>
								<span>Pan</span>
							</span>
							<span className="flex items-center gap-1.5">
								<kbd className="px-1.5 py-0.5 bg-foreground/5 border border-foreground/10 rounded text-[#2563EB] font-sans">
									{scrollLabels.pan}
								</kbd>
								<span>Pan</span>
							</span>
							<span className="flex items-center gap-1.5">
								<kbd className="px-1.5 py-0.5 bg-foreground/5 border border-foreground/10 rounded text-[#2563EB] font-sans">
									{scrollLabels.zoom}
								</kbd>
								<span>Zoom</span>
							</span>
						</div>
					</div>
				)}
				<div
					ref={timelineContainerRef}
					className="flex-1 min-h-0 overflow-auto bg-editor-bg relative"
					tabIndex={0}
					onFocus={() => {
						isTimelineFocusedRef.current = true;
					}}
					onBlur={() => {
						isTimelineFocusedRef.current = false;
					}}
					onMouseDown={() => {
						timelineContainerRef.current?.focus();
						isTimelineFocusedRef.current = true;
					}}
					onClick={() => {
						setSelectedKeyframeId(null);
						setSelectAllBlocksActive(false);
					}}
					onWheel={handleTimelineWheel}
				>
					<TimelineWrapper
						range={clampedRange}
						videoDuration={videoDuration}
						hasOverlap={hasOverlap}
						onRangeChange={setRange}
						minItemDurationMs={timelineScale.minItemDurationMs}
						minVisibleRangeMs={timelineScale.minVisibleRangeMs}
						onItemSpanChange={handleItemSpanChange}
						resolveTargetRowId={getResolvedDropRowId}
						allRegionSpans={allRegionSpans}
					>
						<KeyframeMarkers
							keyframes={keyframes}
							selectedKeyframeId={selectedKeyframeId}
							setSelectedKeyframeId={setSelectedKeyframeId}
							onKeyframeMove={handleKeyframeMove}
							videoDurationMs={totalMs}
							timelineRef={timelineContainerRef}
						/>
						<Timeline
							items={timelineItems}
							videoDurationMs={totalMs}
							currentTimeMs={currentTimeMs}
							onSeek={onSeek}
							onAddZoomAtMs={addZoomAtMs}
							canPlaceZoomAtMs={canPlaceZoomAtMs}
							onSelectZoom={handleSelectZoom}
							onSelectClip={handleSelectClip}
							onSelectAnnotation={handleSelectAnnotation}
							onSelectAudio={handleSelectAudio}
							selectedZoomId={selectedZoomId}
							selectedClipId={selectedClipId}
							selectedAnnotationId={selectedAnnotationId}
							selectedAudioId={selectedAudioId}
							selectAllBlocksActive={selectAllBlocksActive}
							onClearBlockSelection={clearSelectedBlocks}
							keyframes={keyframes}
							audioPeaks={audioPeaks}
						/>
					</TimelineWrapper>
				</div>
			</div>
		);
	},
);

TimelineEditor.displayName = "TimelineEditor";

export default TimelineEditor;
