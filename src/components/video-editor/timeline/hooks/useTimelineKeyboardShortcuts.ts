import { useEffect, type RefObject } from "react";
import { matchesShortcut } from "@/lib/shortcuts";

interface UseTimelineKeyboardShortcutsParams {
	isMac: boolean;
	keyShortcuts: {
		addKeyframe: unknown;
		addZoom: unknown;
		splitClip: unknown;
		addAnnotation: unknown;
		deleteSelected: unknown;
	};
	isTimelineFocusedRef: RefObject<boolean>;
	hasAnyTimelineBlocks: boolean;
	annotationCount: number;
	selectedKeyframeId: string | null;
	selectedZoomId: string | null;
	selectedClipId?: string | null;
	selectedAnnotationId?: string | null;
	selectedAudioId?: string | null;
	selectAllBlocksActive: boolean;
	setSelectAllBlocksActive: (active: boolean) => void;
	setSelectedKeyframeId: (id: string | null) => void;
	addKeyframe: () => void;
	handleAddZoom: () => void;
	handleSplitClip: () => void;
	handleAddAnnotation: () => void;
	deleteAllBlocks: () => void;
	deleteSelectedKeyframe: () => void;
	deleteSelectedZoom: () => void;
	deleteSelectedClip: () => void;
	deleteSelectedAnnotation: () => void;
	deleteSelectedAudio: () => void;
	cycleAnnotationsAtCurrentTime: (backward?: boolean) => boolean;
}

export function useTimelineKeyboardShortcuts({
	isMac,
	keyShortcuts,
	isTimelineFocusedRef,
	hasAnyTimelineBlocks,
	annotationCount,
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
	handleAddAnnotation,
	deleteAllBlocks,
	deleteSelectedKeyframe,
	deleteSelectedZoom,
	deleteSelectedClip,
	deleteSelectedAnnotation,
	deleteSelectedAudio,
	cycleAnnotationsAtCurrentTime,
}: UseTimelineKeyboardShortcutsParams) {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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

			if (matchesShortcut(e, keyShortcuts.addKeyframe as never, isMac)) addKeyframe();
			if (matchesShortcut(e, keyShortcuts.addZoom as never, isMac)) handleAddZoom();
			if (matchesShortcut(e, keyShortcuts.splitClip as never, isMac)) handleSplitClip();
			if (matchesShortcut(e, keyShortcuts.addAnnotation as never, isMac)) {
				handleAddAnnotation();
			}

			if (e.key === "Tab" && annotationCount > 0) {
				if (cycleAnnotationsAtCurrentTime(e.shiftKey)) {
					e.preventDefault();
				}
			}

			if (
				e.key === "Delete" ||
				e.key === "Backspace" ||
				matchesShortcut(e, keyShortcuts.deleteSelected as never, isMac)
			) {
				if (selectAllBlocksActive) {
					e.preventDefault();
					deleteAllBlocks();
				} else if (selectedKeyframeId) {
					deleteSelectedKeyframe();
				} else if (selectedZoomId) {
					deleteSelectedZoom();
				} else if (selectedClipId) {
					deleteSelectedClip();
				} else if (selectedAnnotationId) {
					deleteSelectedAnnotation();
				} else if (selectedAudioId) {
					deleteSelectedAudio();
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		addKeyframe,
		annotationCount,
		cycleAnnotationsAtCurrentTime,
		deleteAllBlocks,
		deleteSelectedAnnotation,
		deleteSelectedAudio,
		deleteSelectedClip,
		deleteSelectedKeyframe,
		deleteSelectedZoom,
		handleAddAnnotation,
		handleAddZoom,
		handleSplitClip,
		hasAnyTimelineBlocks,
		isMac,
		isTimelineFocusedRef,
		keyShortcuts,
		selectAllBlocksActive,
		selectedAnnotationId,
		selectedAudioId,
		selectedClipId,
		selectedKeyframeId,
		selectedZoomId,
		setSelectAllBlocksActive,
		setSelectedKeyframeId,
	]);
}
