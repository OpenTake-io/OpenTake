import {
	Plus,
} from "@phosphor-icons/react";
import type { Span } from "dnd-timeline";
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
import {
	getAnnotationTrackIndex,
	getAudioTrackIndex,
	isAnnotationTrackRowId,
	isAudioTrackRowId,
} from "./core/rows";
import { spansOverlap } from "./core/spans";
import { calculateTimelineScale } from "./core/time";
import { buildAllRegionSpans, buildTimelineItems, resolveDropRowId, type TimelineRenderItem } from "./model/timelineModel";
import { useTimelineAnnotationsActions } from "./hooks/useTimelineAnnotationsActions";
import { useTimelineAudioActions } from "./hooks/useTimelineAudioActions";
import { useTimelineKeyboardShortcuts } from "./hooks/useTimelineKeyboardShortcuts";
import { useTimelineNormalization } from "./hooks/useTimelineNormalization";
import { useTimelineRange } from "./hooks/useTimelineRange";
import { useTimelineSelection } from "./hooks/useTimelineSelection";
import { useTimelineZoomActions } from "./hooks/useTimelineZoomActions";
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
			</div>
		);
	},
);

TimelineEditor.displayName = "TimelineEditor";

export default TimelineEditor;
