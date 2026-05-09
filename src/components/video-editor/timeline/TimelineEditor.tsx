import type { Span } from "dnd-timeline";
import { Plus } from "@phosphor-icons/react";
import {
	forwardRef,
	type KeyboardEvent as ReactKeyboardEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { useScopedT } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import {
	type AspectRatio,
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
import KeyframeMarkers from "./components/markers/KeyframeMarkers";
import TimelineWrapper from "./components/wrapper/TimelineWrapper";
import { useTimelineAudioPeaks } from "./hooks/useTimelineAudioPeaks";
import { calculateTimelineScale } from "./core/time";
import { useTimelineEditorRuntime } from "./hooks/useTimelineEditorRuntime";
import { useTimelineRange } from "./hooks/useTimelineRange";
import TimelineCanvas from "./components/viewport/TimelineCanvas";
import TimelineToolbar from "./components/toolbar/TimelineToolbar";

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
	onTrimSpanChange?: (id: string, span: Span) => void;
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
	onSpeedSpanChange?: (id: string, span: Span) => void;
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
			onTrimSpanChange,
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
			onSpeedSpanChange,
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
		const tTimeline = useScopedT("timeline");
		const tEditor = useScopedT("editor");
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
		const [liveSpanPreviewById, setLiveSpanPreviewById] = useState<Record<string, Span>>({});
		const liveZoomPreview = useMemo(() => {
			const previewSpans: Record<string, Span> = { ...liveSpanPreviewById };
			const hiddenZoomIds = new Set<string>();

			for (const [previewId, previewSpan] of Object.entries(liveSpanPreviewById)) {
				const oldClip = clipRegions.find((clip) => clip.id === previewId);
				if (!oldClip) continue;

				const newStart = Math.round(previewSpan.start);
				const newEnd = Math.round(previewSpan.end);
				const removedSegments = [
					...(newStart > oldClip.startMs
						? [{ startMs: oldClip.startMs, endMs: newStart }]
						: []),
					...(newEnd < oldClip.endMs
						? [{ startMs: newEnd, endMs: oldClip.endMs }]
						: []),
				];

				const startDelta = newStart - oldClip.startMs;
				const endDelta = newEnd - oldClip.endMs;
				const isMove = Math.abs(startDelta - endDelta) < 1 && Math.abs(startDelta) > 0;

				if (isMove) {
					const delta = startDelta;
					for (const zoom of zoomRegions) {
						const overlaps =
							zoom.startMs < oldClip.endMs && zoom.endMs > oldClip.startMs;
						if (!overlaps) continue;
						previewSpans[zoom.id] = {
							start: zoom.startMs + delta,
							end: zoom.endMs + delta,
						};
					}
				}

				if (removedSegments.length > 0) {
					for (const zoom of zoomRegions) {
						const removed = removedSegments.some(
							(segment) =>
								zoom.startMs < segment.endMs && zoom.endMs > segment.startMs,
						);
						if (removed) hiddenZoomIds.add(zoom.id);
					}
				}
			}

			return { previewSpans, hiddenZoomIds };
		}, [clipRegions, liveSpanPreviewById, zoomRegions]);
		const { shortcuts: keyShortcuts, isMac } = useShortcuts();
		const audioPeaks = useTimelineAudioPeaks(videoPath, {
			enableSourceSidecarFallback: true,
		});

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
			handleKeyframeMove,
			clearSelectedBlocks,
			handleSelectZoom,
			handleSelectClip,
			handleSelectAnnotation,
			handleSelectAudio,
			hasOverlap,
			timelineItems,
			allRegionSpans,
			getResolvedDropRowId,
			handleItemSpanChange,
			canPlaceZoomAtMs,
			addZoomAtMs,
			handleAddZoom,
			handleSuggestZooms,
			handleSplitClip,
			handleAddAudio,
			handleAddAnnotation,
		} = useTimelineEditorRuntime({
			ref,
			videoDuration,
			totalMs,
			currentTimeMs,
			safeMinDurationMs,
			cursorTelemetry,
			autoSuggestZoomsTrigger,
			onAutoSuggestZoomsConsumed,
			disableSuggestedZooms,
			zoomRegions,
			onZoomAdded,
			onZoomSuggested,
			onZoomSpanChange,
			onZoomDelete,
			selectedZoomId,
			onSelectZoom,
			trimRegions,
			onTrimSpanChange,
			clipRegions,
			onClipSplit,
			onClipSpanChange,
			onClipDelete,
			selectedClipId,
			onSelectClip,
			annotationRegions,
			onAnnotationAdded,
			onAnnotationSpanChange,
			onAnnotationDelete,
			selectedAnnotationId,
			onSelectAnnotation,
			speedRegions,
			onSpeedSpanChange,
			audioRegions,
			onAudioAdded,
			onAudioSpanChange,
			onAudioDelete,
			selectedAudioId,
			onSelectAudio,
			isMac,
			keyShortcuts,
			isTimelineFocusedRef,
		});
		const handleToolbarAddAnnotation = useCallback(() => {
			handleAddAnnotation();
		}, [handleAddAnnotation]);
		const handleToolbarAddAudio = useCallback(() => {
			void handleAddAudio();
		}, [handleAddAudio]);

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
					<TimelineToolbar
						aspectRatio={aspectRatio}
						isCropped={isCropped}
						scrollLabels={scrollLabels}
						customAspectWidth={customAspectWidth}
						customAspectHeight={customAspectHeight}
						onCustomAspectWidthChange={setCustomAspectWidth}
						onCustomAspectHeightChange={setCustomAspectHeight}
						onCustomAspectRatioKeyDown={handleCustomAspectRatioKeyDown}
						onApplyCustomAspectRatio={applyCustomAspectRatio}
						onAspectRatioChange={onAspectRatioChange}
						onOpenCropEditor={onOpenCropEditor}
						onAddZoom={handleAddZoom}
						onSuggestZooms={handleSuggestZooms}
						onAddAnnotation={handleToolbarAddAnnotation}
						onAddAudio={handleToolbarAddAudio}
						onSplitClip={handleSplitClip}
						cropLabel={t("sections.crop", "Crop")}
						addZoomLabel={tTimeline("zoom.addZoom", "Add Zoom (Z)")}
						suggestZoomsLabel={tTimeline("zoom.suggestZooms", "Suggest Zooms from Cursor")}
						addAnnotationLabel={tTimeline("annotation.addAnnotation", "Add Annotation (A)")}
						addAudioLabel={tTimeline("audio.label", "Audio")}
						splitClipLabel={tEditor("toolbar.splitClip", "Split Clip (C)")}
					/>
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
						onLiveSpanPreviewChange={(id, span) => {
							setLiveSpanPreviewById((prev) => {
								if (!span) {
									if (!(id in prev)) return prev;
									const next = { ...prev };
									delete next[id];
									return next;
								}
								const current = prev[id];
								if (
									current &&
									current.start === span.start &&
									current.end === span.end
								) {
									return prev;
								}
								return { ...prev, [id]: span };
							});
						}}
					>
						<KeyframeMarkers
							keyframes={keyframes}
							selectedKeyframeId={selectedKeyframeId}
							setSelectedKeyframeId={setSelectedKeyframeId}
							onKeyframeMove={handleKeyframeMove}
							videoDurationMs={totalMs}
							timelineRef={timelineContainerRef}
						/>
						<TimelineCanvas
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
							liveSpanPreviewById={liveZoomPreview.previewSpans}
							liveHiddenItemIds={Array.from(liveZoomPreview.hiddenZoomIds)}
						/>
					</TimelineWrapper>
				</div>
			</div>
		);
	},
);

TimelineEditor.displayName = "TimelineEditor";

export default TimelineEditor;
