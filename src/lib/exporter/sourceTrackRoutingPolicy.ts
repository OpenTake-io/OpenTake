import { resolveSourceAudioFallbackPaths } from "./sourceAudioFallback";

export type SourceTrackId = "mic" | "system" | "mixed";

export function getSourceTrackIdFromPath(audioPath: string): SourceTrackId {
	const normalized = audioPath.toLowerCase();
	if (normalized.includes(".mic.")) return "mic";
	if (normalized.includes(".system.")) return "system";
	return "mixed";
}

export interface SourceTrackRoutingPolicy {
	hasEmbeddedSourceAudio: boolean;
	pathsByTrack: Partial<Record<SourceTrackId, string>>;
	playbackPaths: string[];
	muteEmbeddedPreview: boolean;
	includeEmbeddedInExport: boolean;
}

export function resolveSourceTrackRoutingPolicy(
	videoResource: string | null | undefined,
	sourceAudioFallbackPaths: string[] | null | undefined,
): SourceTrackRoutingPolicy {
	const { hasEmbeddedSourceAudio, externalAudioPaths } = resolveSourceAudioFallbackPaths(
		videoResource,
		sourceAudioFallbackPaths,
	);

	const pathsByTrack: Partial<Record<SourceTrackId, string>> = {};
	for (const path of externalAudioPaths) {
		const trackId = getSourceTrackIdFromPath(path);
		if (!pathsByTrack[trackId]) {
			pathsByTrack[trackId] = path;
		}
	}

	const hasDedicatedTracks = Boolean(pathsByTrack.system || pathsByTrack.mic);
	const playbackPaths: string[] = [];
	if (pathsByTrack.system) playbackPaths.push(pathsByTrack.system);
	if (pathsByTrack.mic) playbackPaths.push(pathsByTrack.mic);
	if (!hasDedicatedTracks && pathsByTrack.mixed) playbackPaths.push(pathsByTrack.mixed);

	return {
		hasEmbeddedSourceAudio,
		pathsByTrack,
		playbackPaths,
		muteEmbeddedPreview: hasDedicatedTracks,
		includeEmbeddedInExport: !pathsByTrack.system && !pathsByTrack.mixed,
	};
}
