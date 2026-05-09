import { useCallback, useMemo } from "react";
import {
	SOURCE_AUDIO_NORMALIZE_GAIN,
	getSourceTrackIdFromPath,
} from "./sourceAudioTracks";
import { useSourceAudioTrackSettings } from "./useSourceAudioTrackSettings";

interface UseClipAudioSettingsControllerParams {
	selectedClipId: string | null;
	activeClipId: string | null;
}

export function useClipAudioSettingsController({
	selectedClipId,
	activeClipId,
}: UseClipAudioSettingsControllerParams) {
	const {
		sourceAudioTrackMeta,
		activeSourceAudioTrackSettings,
		selectedClipSourceAudioTrackSettings,
		onSourceAudioTracksMetaChange,
		onSelectedClipSourceAudioTrackVolumeChange,
		onSelectedClipSourceAudioTrackNormalizeChange,
	} = useSourceAudioTrackSettings({
		selectedClipId,
		activeClipId,
	});

	const embeddedSourcePreviewGain = useMemo(() => {
		const settings = activeSourceAudioTrackSettings.mixed ?? { volume: 1, normalize: false };
		const normalizeGain = settings.normalize ? SOURCE_AUDIO_NORMALIZE_GAIN : 1;
		return Math.max(0, Math.min(2, settings.volume * normalizeGain));
	}, [activeSourceAudioTrackSettings]);

	const getSourceTrackPreviewGain = useCallback(
		(audioPath: string) => {
			const trackId = getSourceTrackIdFromPath(audioPath);
			const settings = activeSourceAudioTrackSettings[trackId] ?? {
				volume: 1,
				normalize: false,
			};
			const normalizeGain = settings.normalize ? SOURCE_AUDIO_NORMALIZE_GAIN : 1;
			return Math.max(0, Math.min(2, settings.volume * normalizeGain));
		},
		[activeSourceAudioTrackSettings],
	);

	return {
		sourceAudioTrackMeta,
		activeSourceAudioTrackSettings,
		selectedClipSourceAudioTrackSettings,
		onSourceAudioTracksMetaChange,
		onSelectedClipSourceAudioTrackVolumeChange,
		onSelectedClipSourceAudioTrackNormalizeChange,
		embeddedSourcePreviewGain,
		getSourceTrackPreviewGain,
	};
}

