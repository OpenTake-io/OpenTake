import { useMemo } from "react";
import { resolveSourceAudioFallbackPaths } from "@/lib/exporter/sourceAudioFallback";
import type { AudioRegion, ClipRegion, SpeedRegion } from "../types";
import { getActiveClipIdAtSourceTime, isClipMutedById } from "./clipAudio";
import { useAudioPreviewSync } from "./useAudioPreviewSync";
import { useClipAudioSettingsController } from "./useClipAudioSettingsController";
import { useSourceAudioFallback } from "./useSourceAudioFallback";

function extractLocalPathFromMediaServerUrl(input: string | null | undefined): string | null {
	if (!input) return null;
	try {
		const url = new URL(input);
		const isLocalMediaServer =
			(url.protocol === "http:" || url.protocol === "https:") &&
			(url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
			url.pathname === "/video";
		if (!isLocalMediaServer) return null;
		return url.searchParams.get("path");
	} catch {
		return null;
	}
}

interface UseVideoEditorAudioParams {
	currentSourcePath: string | null;
	selectedClipId: string | null;
	clipRegions: ClipRegion[];
	audioRegions: AudioRegion[];
	effectiveSpeedRegions: SpeedRegion[];
	currentTime: number;
	timelineTime: number;
	duration: number;
	isPlaying: boolean;
	previewVolume: number;
	summarizeErrorMessage: (message: string) => string;
	onSourceFallbackLoadError: (error: unknown) => void;
}

export function useVideoEditorAudio({
	currentSourcePath,
	selectedClipId,
	clipRegions,
	audioRegions,
	effectiveSpeedRegions,
	currentTime,
	timelineTime,
	duration,
	isPlaying,
	previewVolume,
	summarizeErrorMessage,
	onSourceFallbackLoadError,
}: UseVideoEditorAudioParams) {
	const fallbackLookupSourcePath = useMemo(
		() => extractLocalPathFromMediaServerUrl(currentSourcePath) ?? currentSourcePath,
		[currentSourcePath],
	);

	const { sourceAudioFallbackPaths, sourceAudioFallbackStartDelayMsByPath } =
		useSourceAudioFallback({
			currentSourcePath: fallbackLookupSourcePath,
			summarizeErrorMessage,
		});

	const { hasEmbeddedSourceAudio, externalAudioPaths: previewSourceAudioFallbackPaths } = useMemo(
		() => resolveSourceAudioFallbackPaths(currentSourcePath, sourceAudioFallbackPaths),
		[currentSourcePath, sourceAudioFallbackPaths],
	);
	const shouldMutePreviewVideo =
		!hasEmbeddedSourceAudio && previewSourceAudioFallbackPaths.length > 0;

	const activeClipIdAtCurrentTime = useMemo(
		() => getActiveClipIdAtSourceTime(currentTime, clipRegions),
		[clipRegions, currentTime],
	);
	const isCurrentClipMuted = useMemo(
		() => isClipMutedById(activeClipIdAtCurrentTime, clipRegions),
		[activeClipIdAtCurrentTime, clipRegions],
	);

	const {
		sourceAudioTrackMeta,
		activeSourceAudioTrackSettings,
		selectedClipSourceAudioTrackSettings,
		getSourceAudioTrackSettingsForClip,
		onSourceAudioTracksMetaChange,
		onSelectedClipSourceAudioTrackVolumeChange,
		onSelectedClipSourceAudioTrackNormalizeChange,
		embeddedSourcePreviewGain,
		getSourceTrackPreviewGain,
	} = useClipAudioSettingsController({
		selectedClipId,
		activeClipId: activeClipIdAtCurrentTime,
	});

	useAudioPreviewSync({
		audioRegions,
		previewVolume,
		isPlaying,
		currentTime,
		timelineTime,
		duration,
		effectiveSpeedRegions,
		previewSourceAudioFallbackPaths,
		sourceAudioFallbackStartDelayMsByPath,
		isCurrentClipMuted,
		getSourceTrackPreviewGain,
		onSourceFallbackLoadError,
	});

	return {
		sourceAudioFallbackPaths,
		sourceAudioFallbackStartDelayMsByPath,
		previewSourceAudioFallbackPaths,
		shouldMutePreviewVideo,
		activeClipIdAtCurrentTime,
		isCurrentClipMuted,
		sourceAudioTrackMeta,
		activeSourceAudioTrackSettings,
		selectedClipSourceAudioTrackSettings,
		getSourceAudioTrackSettingsForClip,
		onSourceAudioTracksMetaChange,
		onSelectedClipSourceAudioTrackVolumeChange,
		onSelectedClipSourceAudioTrackNormalizeChange,
		embeddedSourcePreviewGain,
		getSourceTrackPreviewGain,
	};
}
