import type { Span } from "dnd-timeline";
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
import KeyframeMarkers from "./KeyframeMarkers";
import TimelineWrapper from "./TimelineWrapper";
import { useAudioPeaks } from "./useAudioPeaks";
import { calculateTimelineScale } from "./core/time";
import { useTimelineEditorRuntime } from "./hooks/useTimelineEditorRuntime";
import { useTimelineRange } from "./hooks/useTimelineRange";
import TimelineEditorShell from "./components/editor/TimelineEditorShell";
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

		return (
			<TimelineEditorShell
				videoDuration={videoDuration}
				hideToolbar={hideToolbar}
				toolbar={
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
						onAddAnnotation={() => handleAddAnnotation()}
						onAddAudio={() => {
							void handleAddAudio();
						}}
						onSplitClip={handleSplitClip}
						cropLabel={t("sections.crop", "Crop")}
					/>
				}
				timelineViewport={
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
						/>
					</TimelineWrapper>
				</div>
				}
			/>
		);
	},
);

TimelineEditor.displayName = "TimelineEditor";

export default TimelineEditor;
