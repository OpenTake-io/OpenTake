import type { Range, Span } from "dnd-timeline";
import { useTimelineContext } from "dnd-timeline";
import {
	CaretDown as ChevronDown,
	CaretUp as ChevronUp,
	MagicWand as WandSparkles,
	MagnifyingGlassPlus as ZoomIn,
	Pause,
	Play,
	Plus,
	Scissors,
	SkipBack,
	SkipForward,
	SpeakerHigh as Volume2,
	SpeakerLow as Volume1,
	SpeakerX as VolumeX,
} from "@phosphor-icons/react";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
	type WheelEvent,
} from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useShortcuts } from "@/contexts/ShortcutsContext";
import { matchesShortcut } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import type { AspectRatio } from "@/utils/aspectRatioUtils";

import { toFileUrl } from "../projectPersistence";
import type {
	AnnotationRegion,
	AudioRegion,
	ClipRegion,
	CursorTelemetryPoint,
	SpeedRegion,
	TrimRegion,
	ZoomFocus,
	ZoomMode,
	ZoomRegion,
} from "../types";
import AudioWaveform from "./AudioWaveform";
import Item from "./Item";
import KeyframeMarkers from "./KeyframeMarkers";
import timelineStyles from "./Timeline.module.css";
import TimelineWrapper from "./TimelineWrapper";
import Track from "./Track";
import { type AudioPeaksData, useAudioPeaks } from "./useAudioPeaks";
import { buildInteractionZoomSuggestions } from "./zoomSuggestionUtils";

const ZOOM_ROW_ID = "row-zoom";
const CLIP_ROW_ID = "row-clip";
const ANNOTATION_ROW_ID = "row-annotation";
const AUDIO_ROW_ID = "row-audio";
const ANNOTATION_ROW_PREFIX = `${ANNOTATION_ROW_ID}-`;
const AUDIO_ROW_PREFIX = "row-audio-";
const FALLBACK_RANGE_MS = 1000;
const TARGET_MARKER_COUNT = 12;

function getAnnotationTrackRowId(trackIndex: number) {
	return `${ANNOTATION_ROW_ID}-${Math.max(0, Math.floor(trackIndex))}`;
}

function isAnnotationTrackRowId(rowId: string) {
	return rowId === ANNOTATION_ROW_ID || rowId.startsWith(ANNOTATION_ROW_PREFIX);
}

function getAnnotationTrackIndex(rowId: string) {
	if (rowId === ANNOTATION_ROW_ID) {
		return 0;
	}

	const parsed = Number.parseInt(rowId.slice(ANNOTATION_ROW_PREFIX.length), 10);
	return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getAudioTrackRowId(trackIndex: number) {
	return `${AUDIO_ROW_PREFIX}${Math.max(0, Math.floor(trackIndex))}`;
}

function isAudioTrackRowId(rowId: string) {
	return rowId === AUDIO_ROW_ID || rowId.startsWith(AUDIO_ROW_PREFIX);
}

function getAudioTrackIndex(rowId: string) {
	if (rowId === AUDIO_ROW_ID) {
		return 0;
	}

	const parsed = Number.parseInt(rowId.slice(AUDIO_ROW_PREFIX.length), 10);
	return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

interface TimelineEditorProps {
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
	onAnnotationSpanChange?: (id: string, span: Span) => void;
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
	onAudioSpanChange?: (id: string, span: Span) => void;
	onAudioDelete?: (id: string) => void;
	selectedAudioId?: string | null;
	onSelectAudio?: (id: string | null) => void;
	aspectRatio?: AspectRatio;
	onAspectRatioChange?: (aspectRatio: AspectRatio) => void;
	onOpenCropEditor?: () => void;
	isCropped?: boolean;
	videoPath?: string | null;
	isPlaying?: boolean;
	onTogglePlayPause?: () => void;
	volume?: number;
	onVolumeChange?: (volume: number) => void;
	hideToolbar?: boolean;
}

export interface TimelineEditorHandle {
	addZoom: () => void;
	suggestZooms: () => void;
	splitClip: () => void;
	addAnnotation: (trackIndex?: number) => void;
	addAudio: () => void;
	isCollapsed: boolean;
	toggleCollapsed: () => void;
	keyframes: { id: string; time: number }[];
	formatTime: (seconds: number) => string;
}

interface TimelineScaleConfig {
	minItemDurationMs: number;
	defaultItemDurationMs: number;
	minVisibleRangeMs: number;
}

interface TimelineRenderItem {
	id: string;
	rowId: string;
	span: Span;
	label: string;
	zoomDepth?: number;
	zoomMode?: ZoomMode;
	speedValue?: number;
	variant: "zoom" | "trim" | "clip" | "annotation" | "speed" | "audio";
}

const SCALE_CANDIDATES = [
	{ intervalSeconds: 0.05, gridSeconds: 0.01 },
	{ intervalSeconds: 0.1, gridSeconds: 0.02 },
	{ intervalSeconds: 0.25, gridSeconds: 0.05 },
	{ intervalSeconds: 0.5, gridSeconds: 0.1 },
	{ intervalSeconds: 1, gridSeconds: 0.25 },
	{ intervalSeconds: 2, gridSeconds: 0.5 },
	{ intervalSeconds: 5, gridSeconds: 1 },
	{ intervalSeconds: 10, gridSeconds: 2 },
	{ intervalSeconds: 15, gridSeconds: 3 },
	{ intervalSeconds: 30, gridSeconds: 5 },
	{ intervalSeconds: 60, gridSeconds: 10 },
	{ intervalSeconds: 120, gridSeconds: 20 },
	{ intervalSeconds: 300, gridSeconds: 30 },
	{ intervalSeconds: 600, gridSeconds: 60 },
	{ intervalSeconds: 900, gridSeconds: 120 },
	{ intervalSeconds: 1800, gridSeconds: 180 },
	{ intervalSeconds: 3600, gridSeconds: 300 },
];

function calculateAxisScale(visibleRangeMs: number): { intervalMs: number; gridMs: number } {
	const visibleSeconds = visibleRangeMs / 1000;
	const candidate =
		SCALE_CANDIDATES.find((scaleCandidate) => {
			if (visibleSeconds <= 0) {
				return true;
			}
			return visibleSeconds / scaleCandidate.intervalSeconds <= TARGET_MARKER_COUNT;
		}) ?? SCALE_CANDIDATES[SCALE_CANDIDATES.length - 1];

	return {
		intervalMs: Math.round(candidate.intervalSeconds * 1000),
		gridMs: Math.round(candidate.gridSeconds * 1000),
	};
}

function calculateTimelineScale(durationSeconds: number): TimelineScaleConfig {
	const totalMs = Math.max(0, Math.round(durationSeconds * 1000));

	const minItemDurationMs = 100;

	const defaultItemDurationMs =
		totalMs > 0
			? Math.max(minItemDurationMs, Math.min(Math.round(totalMs * 0.05), 30000))
			: Math.max(minItemDurationMs, 1000);

	const minVisibleRangeMs = 300;

	return {
		minItemDurationMs,
		defaultItemDurationMs,
		minVisibleRangeMs,
	};
}

function createInitialRange(totalMs: number): Range {
	if (totalMs > 0) {
		return { start: 0, end: totalMs };
	}

	return { start: 0, end: FALLBACK_RANGE_MS };
}

function normalizeWheelDeltaToPixels(delta: number, deltaMode: number) {
	if (deltaMode === 1) {
		return delta * 16;
	}

	if (deltaMode === 2) {
		return delta * 240;
	}

	return delta;
}

function formatTimeLabel(milliseconds: number, intervalMs: number) {
	const totalSeconds = milliseconds / 1000;
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const fractionalDigits = intervalMs < 250 ? 2 : intervalMs < 1000 ? 1 : 0;

	if (hours > 0) {
		const minutesString = minutes.toString().padStart(2, "0");
		const secondsString = Math.floor(seconds).toString().padStart(2, "0");
		return `${hours}:${minutesString}:${secondsString}`;
	}

	if (fractionalDigits > 0) {
		const secondsWithFraction = seconds.toFixed(fractionalDigits);
		const [wholeSeconds, fraction] = secondsWithFraction.split(".");
		return `${minutes}:${wholeSeconds.padStart(2, "0")}.${fraction}`;
	}

	return `${minutes}:${Math.floor(seconds).toString().padStart(2, "0")}`;
}

function formatPlayheadTime(ms: number): string {
	const s = ms / 1000;
	const min = Math.floor(s / 60);
	const sec = s % 60;
	if (min > 0) return `${min}:${sec.toFixed(1).padStart(4, "0")}`;
	return `${sec.toFixed(1)}s`;
}

function PlaybackCursor({
	currentTimeMs,
	videoDurationMs,
	onSeek,
	timelineRef,
	keyframes = [],
	onPanTimeline,
}: {
	currentTimeMs: number;
	videoDurationMs: number;
	onSeek?: (time: number) => void;
	timelineRef: React.RefObject<HTMLDivElement>;
	keyframes?: { id: string; time: number }[];
	onPanTimeline?: (deltaMs: number) => void;
}) {
	const { sidebarWidth, direction, range, valueToPixels, pixelsToValue } = useTimelineContext();
	const sideProperty = direction === "rtl" ? "right" : "left";
	const [isDragging, setIsDragging] = useState(false);
	const edgeScrubRef = useRef<number | null>(null);
	const lastMouseXRef = useRef(0);

	useEffect(() => {
		if (!isDragging) return;

		const edgeZone = 60; // px from edge to trigger scrub
		const scrubSpeed = 0.015; // fraction of visible range per frame

		const startEdgeScrub = () => {
			if (edgeScrubRef.current !== null) return;
			const tick = () => {
				const el = timelineRef.current;
				if (!el || !onPanTimeline || !onSeek) {
					edgeScrubRef.current = null;
					return;
				}
				const rect = el.getBoundingClientRect();
				const x = lastMouseXRef.current;
				const leftEdge = rect.left + sidebarWidth;
				const rightEdge = rect.right;
				const visibleMs = range.end - range.start;
				let delta = 0;
				if (x < leftEdge + edgeZone) {
					delta = -scrubSpeed * visibleMs * (1 - Math.max(0, x - leftEdge) / edgeZone);
				} else if (x > rightEdge - edgeZone) {
					delta = scrubSpeed * visibleMs * (1 - Math.max(0, rightEdge - x) / edgeZone);
				}
				if (delta !== 0) {
					onPanTimeline(delta);
					// Also move the playhead to track the edge
					const clickX = lastMouseXRef.current - rect.left - sidebarWidth;
					const relativeMs = pixelsToValue(clickX);
					const absoluteMs = Math.max(
						0,
						Math.min(range.start + delta + relativeMs, videoDurationMs),
					);
					onSeek(absoluteMs / 1000);
				}
				edgeScrubRef.current = requestAnimationFrame(tick);
			};
			edgeScrubRef.current = requestAnimationFrame(tick);
		};

		const stopEdgeScrub = () => {
			if (edgeScrubRef.current !== null) {
				cancelAnimationFrame(edgeScrubRef.current);
				edgeScrubRef.current = null;
			}
		};

		const handleMouseMove = (e: MouseEvent) => {
			if (!timelineRef.current || !onSeek) return;
			lastMouseXRef.current = e.clientX;

			const rect = timelineRef.current.getBoundingClientRect();
			const clickX = e.clientX - rect.left - sidebarWidth;
			const leftEdge = rect.left + sidebarWidth;
			const rightEdge = rect.right;

			// Start/stop edge scrubbing
			if (
				onPanTimeline &&
				(e.clientX < leftEdge + edgeZone || e.clientX > rightEdge - edgeZone)
			) {
				startEdgeScrub();
			} else {
				stopEdgeScrub();
			}

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
			stopEdgeScrub();
			document.body.style.cursor = "";
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		document.body.style.cursor = "ew-resize";

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
			stopEdgeScrub();
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
		onPanTimeline,
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
				className="absolute top-0 bottom-0 w-[2px] bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.15)] cursor-ew-resize pointer-events-auto hover:shadow-[0_0_12px_rgba(255,255,255,0.25)] transition-shadow group/handle"
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
					<div className="w-3 h-3 mx-auto mt-[2px] bg-white rotate-45 rounded-sm shadow-lg border border-white/30" />
				</div>
				<div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md bg-white text-[10px] text-black font-medium tabular-nums whitespace-nowrap shadow-lg pointer-events-none opacity-0 group-hover/handle:opacity-100 transition-opacity">
					{formatPlayheadTime(clampedTime)}
				</div>
				{isDragging && (
					<div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md bg-white text-[10px] text-black font-medium tabular-nums whitespace-nowrap shadow-lg pointer-events-none">
						{formatPlayheadTime(clampedTime)}
					</div>
				)}
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
		<div className="relative h-9 overflow-hidden border-b border-[rgba(255,255,255,0.06)] bg-transparent select-none">
			{sidebarWidth > 0 ? (
				<div
					className="absolute inset-y-0 z-[1] border-r border-[rgba(255,255,255,0.06)] bg-transparent"
					style={{ width: `${sidebarWidth}px`, [sideProperty]: 0 }}
				/>
			) : null}
			<div
				className="relative h-full"
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
							className="absolute bottom-1 h-1 w-[1px] bg-white/5"
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
								<div className="mb-1.5 h-[5px] w-[5px] rounded-full bg-white/30" />
								<span
									className={cn(
										"text-[10px] font-medium tabular-nums tracking-tight",
										marker.time === currentTimeMs
											? "text-[#2563EB]"
											: "text-white/40",
									)}
								>
									{marker.label}
								</span>
							</div>
						</div>
					);
				})}
			</div>
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
				result.push({ time: Math.round(time), offset: valueToPixels(Math.round(time) - range.start) });
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
							"linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.10) 35%, rgba(255,255,255,0.10) 65%, transparent 100%)",
					}}
				/>
			))}
		</div>
	);
}

function HoverCursor({ hoverX }: { hoverX: number }) {
	const { sidebarWidth, direction, range, pixelsToValue } = useTimelineContext();
	const sideProperty = direction === "rtl" ? "right" : "left";
	const timeMs = range.start + pixelsToValue(hoverX);
	return (
		<div
			className="pointer-events-none absolute top-0 bottom-0 z-40"
			style={{ [sideProperty === "right" ? "marginRight" : "marginLeft"]: `${sidebarWidth - 1}px` }}
		>
			<div
				className="absolute top-0 bottom-0 w-[2px] bg-white/30"
				style={{ [sideProperty]: `${hoverX}px` }}
			>
				<div
					className="absolute -top-1 left-1/2 -translate-x-1/2"
					style={{ width: "16px", height: "16px" }}
				>
					<div className="w-3 h-3 mx-auto mt-[2px] bg-white/30 rotate-45 rounded-sm border border-white/20" />
				</div>
				<div className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] text-white/60 font-medium tabular-nums whitespace-nowrap">
					{formatPlayheadTime(timeMs)}
				</div>
			</div>
		</div>
	);
}

function Timeline({
	items,
	videoDurationMs,
	currentTimeMs,
	onSeek,
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
	onPanTimeline,
	hiddenTrackIds,
}: {
	items: TimelineRenderItem[];
	videoDurationMs: number;
	currentTimeMs: number;
	onSeek?: (time: number) => void;
	onSelectZoom?: (id: string | null) => void;
	onSelectTrim?: (id: string | null) => void;
	onSelectClip?: (id: string | null) => void;
	onSelectAnnotation?: (id: string | null) => void;
	onSelectSpeed?: (id: string | null) => void;
	onSelectAudio?: (id: string | null) => void;
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
	onPanTimeline?: (deltaMs: number) => void;
	hiddenTrackIds?: Set<string>;
}) {
	const { setTimelineRef, style, sidebarWidth, range, pixelsToValue } = useTimelineContext();
	const localTimelineRef = useRef<HTMLDivElement | null>(null);
	const [hoverX, setHoverX] = useState<number | null>(null);

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
			videoDurationMs,
			sidebarWidth,
			range.start,
			pixelsToValue,
			onClearBlockSelection,
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

	return (
		<div
			ref={setRefs}
			style={style}
			className="group relative flex h-full min-h-0 cursor-pointer flex-col overflow-hidden select-none bg-transparent"
			onClick={handleTimelineClick}
			onMouseMove={(e) => {
				const rect = e.currentTarget.getBoundingClientRect();
				const x = e.clientX - rect.left - sidebarWidth;
				if (x >= 0) setHoverX(x);
				else setHoverX(null);
			}}
			onMouseLeave={() => setHoverX(null)}
		>
			<TimelineAxis videoDurationMs={videoDurationMs} currentTimeMs={currentTimeMs} />
			<PlaybackCursor
				currentTimeMs={currentTimeMs}
				videoDurationMs={videoDurationMs}
				onSeek={onSeek}
				timelineRef={localTimelineRef}
				keyframes={keyframes}
				onPanTimeline={onPanTimeline}
			/>
			{hoverX !== null && <HoverCursor hoverX={hoverX} />}

			<div className="relative z-10 flex flex-1 min-h-0 flex-col">
				<Track
					id={CLIP_ROW_ID}
					isEmpty={clipItems.length === 0}
					hint="Press C to split clip"
					trackStyle={{ background: "rgba(255,255,255,0)" }}
				>
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
				</Track>

				{!hiddenTrackIds?.has(ZOOM_ROW_ID) && (
					<Track
						id={ZOOM_ROW_ID}
						isEmpty={zoomItems.length === 0}
						hint="Press Z to add zoom"
						trackStyle={{ background: "transparent" }}
					>
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
					</Track>
				)}

				{!hiddenTrackIds?.has(ANNOTATION_ROW_ID) &&
					annotationRowIds.map((rowId) => {
						const rowItems = annotationItems.filter(
							(item) =>
								getAnnotationTrackRowId(getAnnotationTrackIndex(item.rowId)) ===
								rowId,
						);

						return (
							<Track key={rowId} id={rowId} isEmpty={false}>
								{rowItems.map((item) => (
									<Item
										id={item.id}
										key={item.id}
										rowId={item.rowId}
										span={item.span}
										isSelected={
											selectAllBlocksActive ||
											item.id === selectedAnnotationId
										}
										onSelect={() => onSelectAnnotation?.(item.id)}
										variant="annotation"
									>
										{item.label}
									</Item>
								))}
							</Track>
						);
					})}

				{!hiddenTrackIds?.has(AUDIO_ROW_ID) &&
					audioRowIds.map((rowId) => {
						const rowItems = audioItems.filter(
							(item) => getAudioTrackRowId(getAudioTrackIndex(item.rowId)) === rowId,
						);
						return (
							<Track
								key={rowId}
								id={rowId}
								isEmpty={false}
								trackStyle={{ background: "rgba(255,255,255,0.054)" }}
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
							</Track>
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
			onTrimAdded,
			onTrimSpanChange,
			onTrimDelete,
			selectedTrimId,
			onSelectTrim,
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
			onSpeedAdded,
			onSpeedSpanChange,
			onSpeedDelete,
			selectedSpeedId,
			onSelectSpeed,
			audioRegions = [],
			onAudioAdded,
			onAudioSpanChange,
			onAudioDelete,
			selectedAudioId,
			onSelectAudio,
			videoPath,
			isPlaying = false,
			onTogglePlayPause,
			volume = 1,
			onVolumeChange,
			hideToolbar = false,
		},
		ref,
	) {
		const totalMs = useMemo(
			() => Math.max(0, Math.round(videoDuration * 1000)),
			[videoDuration],
		);
		const playheadTimeMs = useMemo(
			() => Math.round((playheadTime ?? currentTime) * 1000),
			[playheadTime, currentTime],
		);
		const timelineCurrentTimeMs = playheadTimeMs;
		const timelineScale = useMemo(() => calculateTimelineScale(videoDuration), [videoDuration]);
		const safeMinDurationMs = useMemo(
			() =>
				totalMs > 0
					? Math.min(timelineScale.minItemDurationMs, totalMs)
					: timelineScale.minItemDurationMs,
			[timelineScale.minItemDurationMs, totalMs],
		);

		const [range, setRange] = useState<Range>(() => createInitialRange(totalMs));
		const [keyframes, setKeyframes] = useState<{ id: string; time: number }[]>([]);
		const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
		const [selectAllBlocksActive, setSelectAllBlocksActive] = useState(false);
		const [isCollapsed, setIsCollapsed] = useState(false);
		const [hiddenTrackIds, setHiddenTrackIds] = useState<Set<string>>(() => new Set());
		const isTimelineFocusedRef = useRef(false);
		const timelineContainerRef = useRef<HTMLDivElement>(null);
		const { shortcuts: keyShortcuts, isMac } = useShortcuts();
		const audioPeaks = useAudioPeaks(videoPath);

		function formatTime(seconds: number) {
			if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "0:00";
			const mins = Math.floor(seconds / 60);
			const secs = Math.floor(seconds % 60);
			return `${mins}:${secs.toString().padStart(2, "0")}`;
		}

		useEffect(() => {
			if (totalMs === 0) {
				setRange({ start: 0, end: FALLBACK_RANGE_MS });
				return;
			}
			if (videoPath) {
				try {
					const saved = localStorage.getItem(`timeline-zoom:${videoPath}`);
					if (saved) {
						const parsed: Range = JSON.parse(saved);
						if (
							typeof parsed.start === "number" &&
							typeof parsed.end === "number" &&
							parsed.start >= 0 &&
							parsed.end > parsed.start
						) {
							setRange({
								start: Math.max(0, parsed.start),
								end: Math.min(totalMs, parsed.end),
							});
							return;
						}
					}
				} catch {
					// ignore malformed storage
				}
			}
			setRange(createInitialRange(totalMs));
		}, [totalMs, videoPath]);

		useEffect(() => {
			if (!videoPath || totalMs === 0) return;
			try {
				localStorage.setItem(`timeline-zoom:${videoPath}`, JSON.stringify(range));
			} catch {
				// ignore storage errors
			}
		}, [range, videoPath, totalMs]);

		useEffect(() => {
			if (!videoPath) {
				setHiddenTrackIds(new Set());
				return;
			}
			try {
				const saved = localStorage.getItem(`timeline-hidden-tracks:${videoPath}`);
				if (saved) {
					setHiddenTrackIds(new Set(JSON.parse(saved) as string[]));
					return;
				}
			} catch {
				// ignore
			}
			setHiddenTrackIds(new Set());
		}, [videoPath]);

		useEffect(() => {
			if (!videoPath) return;
			try {
				localStorage.setItem(
					`timeline-hidden-tracks:${videoPath}`,
					JSON.stringify([...hiddenTrackIds]),
				);
			} catch {
				// ignore
			}
		}, [hiddenTrackIds, videoPath]);

		// Add keyframe at current playhead position
		const addKeyframe = useCallback(() => {
			if (totalMs === 0) return;
			const time = Math.max(0, Math.min(timelineCurrentTimeMs, totalMs));
			if (keyframes.some((kf) => Math.abs(kf.time - time) < 1)) return;
			setKeyframes((prev) => [...prev, { id: uuidv4(), time }]);
		}, [timelineCurrentTimeMs, totalMs, keyframes]);

		// Delete selected keyframe
		const deleteSelectedKeyframe = useCallback(() => {
			if (!selectedKeyframeId) return;
			setKeyframes((prev) => prev.filter((kf) => kf.id !== selectedKeyframeId));
			setSelectedKeyframeId(null);
		}, [selectedKeyframeId]);

		// Move keyframe to new time position
		const handleKeyframeMove = useCallback(
			(id: string, newTime: number) => {
				setKeyframes((prev) =>
					prev.map((kf) =>
						kf.id === id
							? { ...kf, time: Math.max(0, Math.min(newTime, totalMs)) }
							: kf,
					),
				);
			},
			[totalMs],
		);

		// Delete selected zoom item
		const deleteSelectedZoom = useCallback(() => {
			if (!selectedZoomId) return;
			onZoomDelete(selectedZoomId);
			onSelectZoom(null);
		}, [selectedZoomId, onZoomDelete, onSelectZoom]);

		// Delete selected trim item
		const deleteSelectedTrim = useCallback(() => {
			if (!selectedTrimId || !onTrimDelete || !onSelectTrim) return;
			onTrimDelete(selectedTrimId);
			onSelectTrim(null);
		}, [selectedTrimId, onTrimDelete, onSelectTrim]);

		const deleteSelectedClip = useCallback(() => {
			if (!selectedClipId || !onClipDelete || !onSelectClip) return;
			onClipDelete(selectedClipId);
			onSelectClip(null);
		}, [selectedClipId, onClipDelete, onSelectClip]);

		const deleteSelectedAnnotation = useCallback(() => {
			if (!selectedAnnotationId || !onAnnotationDelete || !onSelectAnnotation) return;
			onAnnotationDelete(selectedAnnotationId);
			onSelectAnnotation(null);
		}, [selectedAnnotationId, onAnnotationDelete, onSelectAnnotation]);

		const deleteSelectedSpeed = useCallback(() => {
			if (!selectedSpeedId || !onSpeedDelete || !onSelectSpeed) return;
			onSpeedDelete(selectedSpeedId);
			onSelectSpeed(null);
		}, [selectedSpeedId, onSpeedDelete, onSelectSpeed]);

		const deleteSelectedAudio = useCallback(() => {
			if (!selectedAudioId || !onAudioDelete || !onSelectAudio) return;
			onAudioDelete(selectedAudioId);
			onSelectAudio(null);
		}, [selectedAudioId, onAudioDelete, onSelectAudio]);

		const clearSelectedBlocks = useCallback(() => {
			onSelectZoom(null);
			onSelectTrim?.(null);
			onSelectClip?.(null);
			onSelectAnnotation?.(null);
			onSelectSpeed?.(null);
			onSelectAudio?.(null);
			setSelectAllBlocksActive(false);
		}, [
			onSelectAnnotation,
			onSelectAudio,
			onSelectClip,
			onSelectSpeed,
			onSelectTrim,
			onSelectZoom,
		]);

		const hasAnyTimelineBlocks =
			zoomRegions.length > 0 ||
			trimRegions.length > 0 ||
			clipRegions.length > 0 ||
			annotationRegions.length > 0 ||
			speedRegions.length > 0 ||
			audioRegions.length > 0;

		const deleteAllBlocks = useCallback(() => {
			const zoomIds = zoomRegions.map((region) => region.id);
			const trimIds = trimRegions.map((region) => region.id);
			const clipIds = clipRegions.map((region) => region.id);
			const annotationIds = annotationRegions.map((region) => region.id);
			const speedIds = speedRegions.map((region) => region.id);
			const audioIds = audioRegions.map((region) => region.id);

			zoomIds.forEach((id) => onZoomDelete(id));
			trimIds.forEach((id) => onTrimDelete?.(id));
			clipIds.forEach((id) => onClipDelete?.(id));
			annotationIds.forEach((id) => onAnnotationDelete?.(id));
			speedIds.forEach((id) => onSpeedDelete?.(id));
			audioIds.forEach((id) => onAudioDelete?.(id));

			clearSelectedBlocks();
			setSelectedKeyframeId(null);
		}, [
			annotationRegions,
			audioRegions,
			clearSelectedBlocks,
			clipRegions,
			onAnnotationDelete,
			onAudioDelete,
			onClipDelete,
			onSpeedDelete,
			onTrimDelete,
			onZoomDelete,
			speedRegions,
			trimRegions,
			zoomRegions,
		]);

		const handleSelectZoom = useCallback(
			(id: string | null) => {
				setSelectAllBlocksActive(false);
				onSelectZoom(id);
			},
			[onSelectZoom],
		);

		const handleSelectTrim = useCallback(
			(id: string | null) => {
				setSelectAllBlocksActive(false);
				onSelectTrim?.(id);
			},
			[onSelectTrim],
		);

		const handleSelectClip = useCallback(
			(id: string | null) => {
				setSelectAllBlocksActive(false);
				onSelectClip?.(id);
			},
			[onSelectClip],
		);

		const handleSelectAnnotation = useCallback(
			(id: string | null) => {
				setSelectAllBlocksActive(false);
				onSelectAnnotation?.(id);
			},
			[onSelectAnnotation],
		);

		const handleSelectSpeed = useCallback(
			(id: string | null) => {
				setSelectAllBlocksActive(false);
				onSelectSpeed?.(id);
			},
			[onSelectSpeed],
		);

		const handleSelectAudio = useCallback(
			(id: string | null) => {
				setSelectAllBlocksActive(false);
				onSelectAudio?.(id);
			},
			[onSelectAudio],
		);

		// (zoom persistence is handled above; duplicate effect removed)

		// Normalize regions only when timeline bounds change (not on every region edit).
		// Using refs to read current regions avoids a dependency-loop that re-fires
		// this effect on every drag/resize and races with dnd-timeline's internal state.
		const zoomRegionsRef = useRef(zoomRegions);
		const trimRegionsRef = useRef(trimRegions);
		const speedRegionsRef = useRef(speedRegions);
		const audioRegionsRef = useRef(audioRegions);
		zoomRegionsRef.current = zoomRegions;
		trimRegionsRef.current = trimRegions;
		speedRegionsRef.current = speedRegions;
		audioRegionsRef.current = audioRegions;

		useEffect(() => {
			if (totalMs === 0 || safeMinDurationMs <= 0) {
				return;
			}

			zoomRegionsRef.current.forEach((region) => {
				const clampedStart = Math.max(0, Math.min(region.startMs, totalMs));
				const minEnd = clampedStart + safeMinDurationMs;
				const clampedEnd = Math.min(totalMs, Math.max(minEnd, region.endMs));
				const normalizedStart = Math.max(
					0,
					Math.min(clampedStart, totalMs - safeMinDurationMs),
				);
				const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, totalMs));

				if (normalizedStart !== region.startMs || normalizedEnd !== region.endMs) {
					onZoomSpanChange(region.id, { start: normalizedStart, end: normalizedEnd });
				}
			});

			trimRegionsRef.current.forEach((region) => {
				const clampedStart = Math.max(0, Math.min(region.startMs, totalMs));
				const minEnd = clampedStart + safeMinDurationMs;
				const clampedEnd = Math.min(totalMs, Math.max(minEnd, region.endMs));
				const normalizedStart = Math.max(
					0,
					Math.min(clampedStart, totalMs - safeMinDurationMs),
				);
				const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, totalMs));

				if (normalizedStart !== region.startMs || normalizedEnd !== region.endMs) {
					onTrimSpanChange?.(region.id, { start: normalizedStart, end: normalizedEnd });
				}
			});

			speedRegionsRef.current.forEach((region) => {
				const clampedStart = Math.max(0, Math.min(region.startMs, totalMs));
				const minEnd = clampedStart + safeMinDurationMs;
				const clampedEnd = Math.min(totalMs, Math.max(minEnd, region.endMs));
				const normalizedStart = Math.max(
					0,
					Math.min(clampedStart, totalMs - safeMinDurationMs),
				);
				const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, totalMs));

				if (normalizedStart !== region.startMs || normalizedEnd !== region.endMs) {
					onSpeedSpanChange?.(region.id, { start: normalizedStart, end: normalizedEnd });
				}
			});

			audioRegionsRef.current.forEach((region) => {
				const clampedStart = Math.max(0, Math.min(region.startMs, totalMs));
				const minEnd = clampedStart + safeMinDurationMs;
				const clampedEnd = Math.min(totalMs, Math.max(minEnd, region.endMs));
				const normalizedStart = Math.max(
					0,
					Math.min(clampedStart, totalMs - safeMinDurationMs),
				);
				const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, totalMs));

				if (normalizedStart !== region.startMs || normalizedEnd !== region.endMs) {
					onAudioSpanChange?.(region.id, { start: normalizedStart, end: normalizedEnd });
				}
			});
			// Only re-run when the timeline scale changes, not on every region edit
		}, [
			totalMs,
			safeMinDurationMs,
			onZoomSpanChange,
			onTrimSpanChange,
			onSpeedSpanChange,
			onAudioSpanChange,
		]);

		const hasOverlap = useCallback(
			(newSpan: Span, excludeId?: string): boolean => {
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
						return newSpan.end > region.startMs && newSpan.start < region.endMs;
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
					return checkOverlap(audioRegions);
				}

				return false;
			},
			[zoomRegions, trimRegions, clipRegions, annotationRegions, speedRegions, audioRegions],
		);

		// Keep newly added timeline regions at the original short default instead of
		// scaling them with the full recording length.
		const defaultRegionDurationMs = useMemo(() => Math.min(1500, totalMs), [totalMs]);

		const handleAddZoom = useCallback(() => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0) {
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			// Always place zoom at playhead
			const startPos = Math.max(0, Math.min(timelineCurrentTimeMs, totalMs));
			// Find the next zoom region after the playhead
			const sorted = [...zoomRegions].sort((a, b) => a.startMs - b.startMs);
			const nextRegion = sorted.find((region) => region.startMs > startPos);
			const gapToNext = nextRegion ? nextRegion.startMs - startPos : totalMs - startPos;

			// Check if playhead is inside any zoom region
			const isOverlapping = sorted.some(
				(region) => startPos >= region.startMs && startPos < region.endMs,
			);
			if (isOverlapping || gapToNext <= 0) {
				toast.error("Cannot place zoom here", {
					description:
						"Zoom already exists at this location or not enough space available.",
				});
				return;
			}

			const actualDuration = Math.min(defaultRegionDurationMs, gapToNext);
			onZoomAdded({ start: startPos, end: startPos + actualDuration });
		}, [
			videoDuration,
			totalMs,
			timelineCurrentTimeMs,
			zoomRegions,
			onZoomAdded,
			defaultRegionDurationMs,
		]);

		const handleSuggestZooms = useCallback(() => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0) {
				return;
			}

			if (disableSuggestedZooms) {
				toast.info("Suggested zooms are unavailable while cursor looping is enabled.");
				return;
			}

			if (!onZoomSuggested) {
				toast.error("Zoom suggestion handler unavailable");
				return;
			}

			if (cursorTelemetry.length < 2) {
				toast.info("No cursor telemetry available", {
					description: "Record a screencast first to generate cursor-based suggestions.",
				});
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			const result = buildInteractionZoomSuggestions({
				cursorTelemetry,
				totalMs,
				defaultDurationMs: defaultDuration,
				reservedSpans: zoomRegions
					.map((region) => ({ start: region.startMs, end: region.endMs }))
					.sort((a, b) => a.start - b.start),
			});

			if (result.status === "no-telemetry") {
				toast.info("No usable cursor telemetry", {
					description: "The recording does not include enough cursor movement data.",
				});
				return;
			}

			if (result.status === "no-interactions") {
				toast.info("No clear interaction moments found", {
					description: "Try a recording with pauses or clicks around important actions.",
				});
				return;
			}

			if (result.status === "no-slots" || result.suggestions.length === 0) {
				toast.info("No auto-zoom slots available", {
					description: "Detected dwell points overlap existing zoom regions.",
				});
				return;
			}

			for (const region of result.suggestions) {
				onZoomSuggested({ start: region.start, end: region.end }, region.focus);
			}

			toast.success(
				`Added ${result.suggestions.length} interaction-based zoom suggestion${result.suggestions.length === 1 ? "" : "s"}`,
			);
		}, [
			videoDuration,
			totalMs,
			defaultRegionDurationMs,
			zoomRegions,
			disableSuggestedZooms,
			onZoomSuggested,
			cursorTelemetry,
		]);

		useEffect(() => {
			if (autoSuggestZoomsTrigger <= 0) {
				return;
			}

			onAutoSuggestZoomsConsumed?.();

			handleSuggestZooms();
		}, [autoSuggestZoomsTrigger, handleSuggestZooms, onAutoSuggestZoomsConsumed]);

		const handleAddTrim = useCallback(() => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onTrimAdded) {
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			// Always place trim at playhead
			const startPos = Math.max(0, Math.min(timelineCurrentTimeMs, totalMs));
			// Find the next trim region after the playhead
			const sorted = [...trimRegions].sort((a, b) => a.startMs - b.startMs);
			const nextRegion = sorted.find((region) => region.startMs > startPos);
			const gapToNext = nextRegion ? nextRegion.startMs - startPos : totalMs - startPos;

			// Check if playhead is inside any trim region
			const isOverlapping = sorted.some(
				(region) => startPos >= region.startMs && startPos < region.endMs,
			);
			if (isOverlapping || gapToNext <= 0) {
				toast.error("Cannot place trim here", {
					description:
						"Trim already exists at this location or not enough space available.",
				});
				return;
			}

			const actualDuration = Math.min(defaultRegionDurationMs, gapToNext);
			onTrimAdded({ start: startPos, end: startPos + actualDuration });
		}, [
			videoDuration,
			totalMs,
			timelineCurrentTimeMs,
			trimRegions,
			onTrimAdded,
			defaultRegionDurationMs,
		]);

		const handleSplitClip = useCallback(() => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onClipSplit) {
				return;
			}
			onClipSplit(timelineCurrentTimeMs);
		}, [videoDuration, totalMs, timelineCurrentTimeMs, onClipSplit]);

		const handleAddSpeed = useCallback(() => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onSpeedAdded) {
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			// Always place speed region at playhead
			const startPos = Math.max(0, Math.min(timelineCurrentTimeMs, totalMs));
			// Find the next speed region after the playhead
			const sorted = [...speedRegions].sort((a, b) => a.startMs - b.startMs);
			const nextRegion = sorted.find((region) => region.startMs > startPos);
			const gapToNext = nextRegion ? nextRegion.startMs - startPos : totalMs - startPos;

			// Check if playhead is inside any speed region
			const isOverlapping = sorted.some(
				(region) => startPos >= region.startMs && startPos < region.endMs,
			);
			if (isOverlapping || gapToNext <= 0) {
				toast.error("Cannot place speed here", {
					description:
						"Speed region already exists at this location or not enough space available.",
				});
				return;
			}

			const actualDuration = Math.min(defaultRegionDurationMs, gapToNext);
			onSpeedAdded({ start: startPos, end: startPos + actualDuration });
		}, [
			videoDuration,
			totalMs,
			timelineCurrentTimeMs,
			speedRegions,
			onSpeedAdded,
			defaultRegionDurationMs,
		]);

		const handleAddAudio = useCallback(async () => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onAudioAdded) {
				return;
			}

			const result = await window.electronAPI?.openAudioFilePicker?.();
			if (!result?.success || !result.path) {
				return;
			}

			const audioPath = result.path;

			// Load the audio file to get its full duration
			const audioDurationMs = await new Promise<number>((resolve) => {
				const audio = new Audio(toFileUrl(audioPath));
				audio.addEventListener("loadedmetadata", () => {
					resolve(Math.round(audio.duration * 1000));
				});
				audio.addEventListener("error", () => {
					resolve(0);
				});
			});

			if (audioDurationMs <= 0) {
				toast.error("Could not read audio file", {
					description: "The selected file may be corrupted or in an unsupported format.",
				});
				return;
			}

			const startPos = Math.max(0, Math.min(timelineCurrentTimeMs, totalMs));

			// Find the first track row with no overlap at startPos
			let rowTrackIndex = 0;
			let rowGap = 0;
			for (let attempt = 0; attempt < 100; attempt++) {
				const rowRegions = audioRegions.filter((r) => (r.trackIndex ?? 0) === attempt);
				const sortedRow = [...rowRegions].sort((a, b) => a.startMs - b.startMs);
				const isRowOverlapping = sortedRow.some(
					(region) => startPos >= region.startMs && startPos < region.endMs,
				);
				if (!isRowOverlapping) {
					const nextInRow = sortedRow.find((region) => region.startMs > startPos);
					const gap = nextInRow ? nextInRow.startMs - startPos : totalMs - startPos;
					if (gap > 0) {
						rowTrackIndex = attempt;
						rowGap = gap;
						break;
					}
				}
			}

			if (rowGap <= 0) {
				toast.error("Cannot place audio here", {
					description: "Not enough space available at this position.",
				});
				return;
			}

			// Use full audio duration, but clamp to available gap and video length
			const actualDuration = Math.min(audioDurationMs, rowGap, totalMs - startPos);
			onAudioAdded(
				{ start: startPos, end: startPos + actualDuration },
				result.path,
				rowTrackIndex,
			);
		}, [videoDuration, totalMs, timelineCurrentTimeMs, audioRegions, onAudioAdded]);

		const handleAddAnnotation = useCallback(
			(trackIndex = 0) => {
				if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onAnnotationAdded) {
					return;
				}

				const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
				if (defaultDuration <= 0) {
					return;
				}

				// Multiple annotations can exist at the same timestamp
				const startPos = Math.max(0, Math.min(timelineCurrentTimeMs, totalMs));
				const endPos = Math.min(startPos + defaultDuration, totalMs);

				onAnnotationAdded({ start: startPos, end: endPos }, trackIndex);
			},
			[
				videoDuration,
				totalMs,
				timelineCurrentTimeMs,
				onAnnotationAdded,
				defaultRegionDurationMs,
			],
		);

		useEffect(() => {
			const handleKeyDown = (e: KeyboardEvent) => {
				if (
					e.target instanceof HTMLInputElement ||
					e.target instanceof HTMLTextAreaElement
				) {
					return;
				}

				if (matchesShortcut(e, { key: "a", ctrl: true }, isMac)) {
					if (!hasAnyTimelineBlocks || !isTimelineFocusedRef.current) {
						return;
					}

					e.preventDefault();
					setSelectedKeyframeId(null);
					setSelectAllBlocksActive(true);
					return;
				}

				if (matchesShortcut(e, keyShortcuts.addKeyframe, isMac)) {
					addKeyframe();
				}
				if (matchesShortcut(e, keyShortcuts.addZoom, isMac)) {
					handleAddZoom();
				}
				if (matchesShortcut(e, keyShortcuts.addTrim, isMac)) {
					handleAddTrim();
				}
				if (matchesShortcut(e, keyShortcuts.splitClip, isMac)) {
					handleSplitClip();
				}
				if (matchesShortcut(e, keyShortcuts.addAnnotation, isMac)) {
					handleAddAnnotation();
				}
				if (matchesShortcut(e, keyShortcuts.addSpeed, isMac)) {
					handleAddSpeed();
				}

				// Tab: Cycle through overlapping annotations at current time
				if (e.key === "Tab" && annotationRegions.length > 0) {
					const overlapping = annotationRegions
						.filter(
							(a) =>
								timelineCurrentTimeMs >= a.startMs &&
								timelineCurrentTimeMs <= a.endMs,
						)
						.sort((a, b) => a.zIndex - b.zIndex); // Sort by z-index

					if (overlapping.length > 0) {
						e.preventDefault();

						if (
							!selectedAnnotationId ||
							!overlapping.some((a) => a.id === selectedAnnotationId)
						) {
							onSelectAnnotation?.(overlapping[0].id);
						} else {
							// Cycle to next annotation
							const currentIndex = overlapping.findIndex(
								(a) => a.id === selectedAnnotationId,
							);
							const nextIndex = e.shiftKey
								? (currentIndex - 1 + overlapping.length) % overlapping.length // Shift+Tab = backward
								: (currentIndex + 1) % overlapping.length; // Tab = forward
							onSelectAnnotation?.(overlapping[nextIndex].id);
						}
					}
				}
				// Delete key or Ctrl+D / Cmd+D
				if (
					e.key === "Delete" ||
					e.key === "Backspace" ||
					matchesShortcut(e, keyShortcuts.deleteSelected, isMac)
				) {
					if (selectAllBlocksActive) {
						e.preventDefault();
						deleteAllBlocks();
					} else if (selectedKeyframeId) {
						deleteSelectedKeyframe();
					} else if (selectedZoomId) {
						deleteSelectedZoom();
					} else if (selectedTrimId) {
						deleteSelectedTrim();
					} else if (selectedClipId) {
						deleteSelectedClip();
					} else if (selectedAnnotationId) {
						deleteSelectedAnnotation();
					} else if (selectedSpeedId) {
						deleteSelectedSpeed();
					} else if (selectedAudioId) {
						deleteSelectedAudio();
					}
				}
			};
			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}, [
			addKeyframe,
			handleAddZoom,
			handleAddTrim,
			handleSplitClip,
			handleAddAnnotation,
			handleAddSpeed,
			deleteAllBlocks,
			deleteSelectedKeyframe,
			deleteSelectedZoom,
			deleteSelectedTrim,
			deleteSelectedClip,
			deleteSelectedAnnotation,
			deleteSelectedSpeed,
			deleteSelectedAudio,
			selectedKeyframeId,
			selectedZoomId,
			selectedTrimId,
			selectedClipId,
			selectedAnnotationId,
			selectedSpeedId,
			selectedAudioId,
			annotationRegions,
			hasAnyTimelineBlocks,
			onSelectAnnotation,
			keyShortcuts,
			isMac,
			selectAllBlocksActive,
			timelineCurrentTimeMs,
		]);

		const clampedRange = useMemo<Range>(() => {
			if (totalMs === 0) {
				return range;
			}

			return {
				start: Math.max(0, Math.min(range.start, totalMs)),
				end: Math.min(range.end, totalMs),
			};
		}, [range, totalMs]);

		useImperativeHandle(
			ref,
			() => ({
				addZoom: handleAddZoom,
				suggestZooms: handleSuggestZooms,
				splitClip: handleSplitClip,
				addAnnotation: handleAddAnnotation,
				addAudio: handleAddAudio,
				isCollapsed,
				toggleCollapsed: () => setIsCollapsed((prev) => !prev),
				keyframes,
				formatTime,
			}),
			[
				handleAddZoom,
				handleSuggestZooms,
				handleSplitClip,
				handleAddAnnotation,
				handleAddAudio,
				isCollapsed,
				keyframes,
				formatTime,
			],
		);

		const timelineItems = useMemo<TimelineRenderItem[]>(() => {
			const zooms: TimelineRenderItem[] = zoomRegions.map((region, index) => ({
				id: region.id,
				rowId: ZOOM_ROW_ID,
				span: { start: region.startMs, end: region.endMs },
				label: `Zoom ${index + 1}`,
				zoomDepth: region.depth,
				zoomMode: region.mode ?? "auto",
				variant: "zoom",
			}));

			const clips: TimelineRenderItem[] = clipRegions.map((region, index) => ({
				id: region.id,
				rowId: CLIP_ROW_ID,
				span: { start: region.startMs, end: region.endMs },
				label: `Clip ${index + 1}`,
				variant: "clip",
			}));

			const annotations: TimelineRenderItem[] = annotationRegions.map((region) => {
				let label: string;

				if (region.type === "text") {
					// Show text preview
					const preview = region.content.trim() || "Empty text";
					label = preview.length > 20 ? `${preview.substring(0, 20)}...` : preview;
				} else if (region.type === "image") {
					label = "Image";
				} else {
					label = "Annotation";
				}

				return {
					id: region.id,
					rowId: getAnnotationTrackRowId(region.trackIndex ?? 0),
					span: { start: region.startMs, end: region.endMs },
					label,
					variant: "annotation",
				};
			});

			const audios: TimelineRenderItem[] = audioRegions.map((region) => {
				const fileName =
					region.audioPath
						.split(/[\\/]/)
						.pop()
						?.replace(/\.[^.]+$/, "") || "Audio";
				return {
					id: region.id,
					rowId: getAudioTrackRowId(region.trackIndex ?? 0),
					span: { start: region.startMs, end: region.endMs },
					label: fileName,
					variant: "audio",
				};
			});

			return [...zooms, ...clips, ...annotations, ...audios];
		}, [zoomRegions, clipRegions, annotationRegions, audioRegions]);

		// Flat list of draggable row spans for neighbour-clamping during drag/resize.
		const allRegionSpans = useMemo(() => {
			const zooms = zoomRegions.map((r) => ({
				id: r.id,
				start: r.startMs,
				end: r.endMs,
				rowId: ZOOM_ROW_ID,
			}));
			const clips = clipRegions.map((r) => ({
				id: r.id,
				start: r.startMs,
				end: r.endMs,
				rowId: CLIP_ROW_ID,
			}));
			const audios = audioRegions.map((r) => ({
				id: r.id,
				start: r.startMs,
				end: r.endMs,
				rowId: getAudioTrackRowId(r.trackIndex ?? 0),
			}));
			return [...zooms, ...clips, ...audios];
		}, [zoomRegions, clipRegions, audioRegions]);

		const handleItemSpanChange = useCallback(
			(id: string, span: Span) => {
				// Check if it's a zoom, trim, clip, speed, or annotation item
				if (zoomRegions.some((r) => r.id === id)) {
					onZoomSpanChange(id, span);
				} else if (clipRegions.some((r) => r.id === id)) {
					onClipSpanChange?.(id, span);
				} else if (annotationRegions.some((r) => r.id === id)) {
					onAnnotationSpanChange?.(id, span);
				} else if (audioRegions.some((r) => r.id === id)) {
					onAudioSpanChange?.(id, span);
				}
			},
			[
				zoomRegions,
				clipRegions,
				annotationRegions,
				audioRegions,
				onZoomSpanChange,
				onClipSpanChange,
				onAnnotationSpanChange,
				onAudioSpanChange,
			],
		);

		const panTimelineRange = useCallback(
			(deltaMs: number) => {
				if (!Number.isFinite(deltaMs) || deltaMs === 0 || totalMs <= 0) {
					return;
				}

				setRange((previous) => {
					const visibleSpan = Math.max(1, previous.end - previous.start);
					const maxStart = Math.max(0, totalMs - visibleSpan);
					const nextStart = Math.max(0, Math.min(previous.start + deltaMs, maxStart));

					return {
						start: nextStart,
						end: nextStart + visibleSpan,
					};
				});
			},
			[totalMs],
		);

		const handleTimelineWheel = useCallback(
			(event: WheelEvent<HTMLDivElement>) => {
				if (totalMs <= 0) {
					return;
				}

				// Horizontal scroll (trackpad side-scroll or shift+scroll) → pan
				const rawHorizontalDelta =
					Math.abs(event.deltaX) > 0
						? event.deltaX
						: event.shiftKey && Math.abs(event.deltaY) > 0
							? event.deltaY
							: 0;

				if (rawHorizontalDelta !== 0) {
					event.preventDefault();
					const containerWidth = timelineContainerRef.current?.clientWidth ?? 0;
					const visibleRangeMs = clampedRange.end - clampedRange.start;
					if (containerWidth <= 0 || visibleRangeMs <= 0) return;
					const horizontalDeltaPx = normalizeWheelDeltaToPixels(
						rawHorizontalDelta,
						event.deltaMode,
					);
					const deltaMs = (horizontalDeltaPx / containerWidth) * visibleRangeMs;
					panTimelineRange(deltaMs);
					return;
				}

				// Vertical scroll → zoom in/out (no modifier key needed)
				if (Math.abs(event.deltaY) > 0) {
					event.preventDefault();
					event.stopPropagation();
					const containerWidth = timelineContainerRef.current?.clientWidth ?? 0;
					const visibleRangeMs = clampedRange.end - clampedRange.start;
					if (containerWidth <= 0 || visibleRangeMs <= 0) return;

					// Zoom centered on cursor position
					const rect = timelineContainerRef.current!.getBoundingClientRect();
					const cursorFraction = Math.max(
						0,
						Math.min(1, (event.clientX - rect.left) / containerWidth),
					);
					const cursorMs = clampedRange.start + cursorFraction * visibleRangeMs;

					const zoomFactor = event.deltaY > 0 ? 1.15 : 1 / 1.15;
					const newVisibleMs = Math.max(
						500,
						Math.min(totalMs, visibleRangeMs * zoomFactor),
					);

					const newStart = Math.max(0, cursorMs - cursorFraction * newVisibleMs);
					const newEnd = Math.min(totalMs, newStart + newVisibleMs);

					setRange({
						start: newEnd - newVisibleMs > 0 ? newEnd - newVisibleMs : 0,
						end: newEnd,
					});
				}
			},
			[clampedRange.end, clampedRange.start, panTimelineRange, totalMs],
		);

		if (!videoDuration || videoDuration === 0) {
			return (
				<div className="flex-1 flex flex-col items-center justify-center rounded-lg bg-[#17171a] gap-3">
					<div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
						<Plus className="w-6 h-6 text-slate-600" />
					</div>
					<div className="text-center">
						<p className="text-sm font-medium text-slate-300">No Video Loaded</p>
						<p className="text-xs text-slate-500 mt-1">
							Drag and drop a video to start editing
						</p>
					</div>
				</div>
			);
		}

		return (
			<div className="flex min-h-0 flex-1 flex-col gap-1.5">
				{!hideToolbar && (
					<div className="relative flex items-center px-1 py-1">
						{/* Left tools */}
						<div className="z-10 flex min-w-0 flex-1 items-center gap-1.5">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="sm"
										className="h-7 gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 text-[11px] text-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:bg-white/[0.08] hover:text-white"
									>
										<Plus className="w-3.5 h-3.5" />
										<span className="font-medium">Add Layer</span>
										<ChevronDown className="w-3 h-3" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="start"
									className="bg-[#1a1a1c] border-white/10"
								>
									<DropdownMenuItem
										onClick={() => {
											const nextTrackIndex =
												annotationRegions.length > 0
													? Math.max(
															...annotationRegions.map(
																(region) => region.trackIndex ?? 0,
															),
														) + 1
													: 0;
											handleAddAnnotation(nextTrackIndex);
										}}
										className="text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
									>
										Annotation
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={handleAddAudio}
										className="text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
									>
										Audio
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
							<div className="w-[1px] h-4 bg-white/10 mx-1" />
							<Button
								onClick={handleAddZoom}
								variant="ghost"
								size="icon"
								className="h-7 w-7 rounded-full text-slate-400 transition-all hover:bg-[#2563EB]/10 hover:text-[#2563EB]"
								title="Add Zoom (Z)"
							>
								<ZoomIn className="w-4 h-4" />
							</Button>
							<Button
								onClick={handleSuggestZooms}
								variant="ghost"
								size="icon"
								className="h-7 w-7 rounded-full text-slate-400 transition-all hover:bg-[#2563EB]/10 hover:text-[#2563EB]"
								title="Suggest Zooms from Cursor"
							>
								<WandSparkles className="w-4 h-4" />
							</Button>
							<Button
								onClick={handleSplitClip}
								variant="ghost"
								size="icon"
								className="h-7 w-7 rounded-full text-slate-400 transition-all hover:bg-white/10 hover:text-white"
								title="Split Clip (C)"
							>
								<Scissors className="w-4 h-4" />
							</Button>
						</div>
						{/* Playback controls - absolutely centered under the preview column */}
						<div className="absolute inset-0 flex items-center pointer-events-none">
							<div className="flex items-center gap-1.5 pointer-events-auto w-full justify-center pr-8">
								<span className="mr-1 text-[10px] font-medium tabular-nums text-slate-400">
									{formatTime(currentTime)}
								</span>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7 rounded-full text-slate-400 transition-all hover:bg-white/10 hover:text-white"
									title="Skip Back"
									onClick={() => {
										if (!onSeek) return;
										const currentMs = currentTime * 1000;
										const prevKeyframe = [...keyframes]
											.reverse()
											.find((k) => k.time < currentMs - 50);
										if (prevKeyframe) {
											onSeek(prevKeyframe.time / 1000);
										} else {
											onSeek(Math.max(0, currentTime - 5));
										}
									}}
								>
									<SkipBack className="w-3.5 h-3.5" weight="fill" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className={cn(
										"h-7 w-7 rounded-full border border-white/10 transition-all shadow-[0_8px_18px_rgba(0,0,0,0.18)]",
										isPlaying
											? "bg-white/10 text-white hover:bg-white/20"
											: "bg-white text-black hover:bg-white/90",
									)}
									onClick={onTogglePlayPause}
									title={isPlaying ? "Pause" : "Play"}
								>
									{isPlaying ? (
										<Pause className="w-3.5 h-3.5" weight="fill" />
									) : (
										<Play className="w-3.5 h-3.5" weight="fill" />
									)}
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7 rounded-full text-slate-400 transition-all hover:bg-white/10 hover:text-white"
									title="Skip Forward"
									onClick={() => {
										if (!onSeek) return;
										const currentMs = currentTime * 1000;
										const nextKeyframe = keyframes.find(
											(k) => k.time > currentMs + 50,
										);
										if (nextKeyframe) {
											onSeek(nextKeyframe.time / 1000);
										} else {
											onSeek(Math.min(videoDuration, currentTime + 5));
										}
									}}
								>
									<SkipForward className="w-3.5 h-3.5" weight="fill" />
								</Button>
								<span className="text-[10px] font-medium text-slate-500 tabular-nums ml-1">
									{formatTime(videoDuration)}
								</span>
							</div>
						</div>
						{/* Right section: volume inline slider */}
						<div className="z-10 ml-auto flex items-center gap-2">
							<Button
								variant="ghost"
								size="icon"
								title={isCollapsed ? "Expand Timeline" : "Collapse Timeline"}
								className="h-7 w-7 rounded-full text-slate-400 transition-all hover:bg-white/10 hover:text-white"
								onClick={() => setIsCollapsed((prev) => !prev)}
							>
								{isCollapsed ? (
									<ChevronUp className="w-3.5 h-3.5" />
								) : (
									<ChevronDown className="w-3.5 h-3.5" />
								)}
							</Button>
							{/* Volume icon + inline pill slider */}
							<div className="flex items-center gap-1.5">
								<button
									type="button"
									className="text-slate-400 hover:text-white transition-colors"
									title="Mute/Unmute"
									onClick={() => onVolumeChange?.(volume <= 0.001 ? 1 : 0)}
								>
									{volume <= 0.001 ? (
										<VolumeX className="w-3.5 h-3.5" />
									) : volume < 0.5 ? (
										<Volume1 className="w-3.5 h-3.5" />
									) : (
										<Volume2 className="w-3.5 h-3.5" />
									)}
								</button>
								<div className="relative flex h-7 w-24 select-none items-center overflow-hidden rounded-full border border-white/[0.06] bg-black/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
									<div
										className="absolute inset-y-[3px] left-[3px] right-auto rounded-[10px] bg-white/[0.08]"
										style={{
											width:
												volume > 0
													? `max(calc(${volume * 100}% - 6px), 1.2rem)`
													: 0,
										}}
									/>
									<div
										className="pointer-events-none absolute bottom-[18%] top-[18%] z-10 w-[2px] rounded-full bg-white/95 shadow-[0_0_10px_rgba(37,99,235,0.28)]"
										style={{ left: `calc(${volume * 100}% - 8px)` }}
									/>
									<span className="pointer-events-none relative z-10 pl-2 text-[10px] font-medium text-slate-400">
										{Math.round(volume * 100)}%
									</span>
									<input
										type="range"
										min="0"
										max="1"
										step="0.01"
										value={volume}
										onChange={(e) => onVolumeChange?.(Number(e.target.value))}
										className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
									/>
								</div>
							</div>
						</div>
					</div>
				)}
				<div
					className={cn(
						"flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px]",
						isCollapsed && "hidden",
					)}
				>
					<div
						ref={timelineContainerRef}
						className={cn(
							"relative min-h-0 flex-1 overflow-auto outline-none",
							timelineStyles.scrollArea,
						)}
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
								currentTimeMs={playheadTimeMs}
								onSeek={onSeek}
								onSelectZoom={handleSelectZoom}
								onSelectTrim={handleSelectTrim}
								onSelectClip={handleSelectClip}
								onSelectAnnotation={handleSelectAnnotation}
								onSelectSpeed={handleSelectSpeed}
								onSelectAudio={handleSelectAudio}
								selectedZoomId={selectedZoomId}
								selectedTrimId={selectedTrimId}
								selectedClipId={selectedClipId}
								selectedAnnotationId={selectedAnnotationId}
								selectedSpeedId={selectedSpeedId}
								selectedAudioId={selectedAudioId}
								selectAllBlocksActive={selectAllBlocksActive}
								onClearBlockSelection={clearSelectedBlocks}
								keyframes={keyframes}
								audioPeaks={audioPeaks}
								onPanTimeline={panTimelineRange}
								hiddenTrackIds={hiddenTrackIds}
							/>
						</TimelineWrapper>
					</div>
				</div>
			</div>
		);
	},
);

export default TimelineEditor;
