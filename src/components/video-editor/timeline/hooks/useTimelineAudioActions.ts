import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { resolveMediaElementSource } from "@/lib/exporter/localMediaSource";
import { spansOverlap } from "../core/spans";

interface AudioRegionLite {
	id: string;
	startMs: number;
	endMs: number;
	trackIndex?: number;
}

interface AudioFilePickerResult {
	success: boolean;
	path?: string;
}

interface TimelineAudioActionsDeps {
	openFilePicker: () => Promise<AudioFilePickerResult | null | undefined>;
	probeAudioDurationMs: (audioPath: string) => Promise<number>;
	reportError: (title: string, description: string) => void;
}

interface UseTimelineAudioActionsParams {
	videoDuration: number;
	totalMs: number;
	currentTimeMs: number;
	audioRegions: AudioRegionLite[];
	onAudioAdded?: (span: { start: number; end: number }, audioPath: string, trackIndex?: number) => void;
	deps?: Partial<TimelineAudioActionsDeps>;
}

async function defaultOpenFilePicker(): Promise<AudioFilePickerResult | null | undefined> {
	return window.electronAPI.openAudioFilePicker();
}

async function defaultProbeAudioDurationMs(audioPath: string): Promise<number> {
	const resolved = await resolveMediaElementSource(audioPath);
	return new Promise<number>((resolve) => {
		const audio = new Audio();
		const cleanup = () => {
			audio.removeAttribute("src");
			audio.load();
			resolved.revoke();
		};

		audio.addEventListener(
			"loadedmetadata",
			() => {
				resolve(Math.round(audio.duration * 1000));
				cleanup();
			},
			{ once: true },
		);
		audio.addEventListener(
			"error",
			() => {
				resolve(0);
				cleanup();
			},
			{ once: true },
		);
		audio.src = resolved.src;
	});
}

function defaultReportError(title: string, description: string) {
	toast.error(title, { description });
}

function buildTimelineAudioActionsDeps(
	overrides?: Partial<TimelineAudioActionsDeps>,
): TimelineAudioActionsDeps {
	return {
		openFilePicker: overrides?.openFilePicker ?? defaultOpenFilePicker,
		probeAudioDurationMs: overrides?.probeAudioDurationMs ?? defaultProbeAudioDurationMs,
		reportError: overrides?.reportError ?? defaultReportError,
	};
}

export function useTimelineAudioActions({
	videoDuration,
	totalMs,
	currentTimeMs,
	audioRegions,
	onAudioAdded,
	deps: depsOverrides,
}: UseTimelineAudioActionsParams) {
	const deps = useMemo(() => buildTimelineAudioActionsDeps(depsOverrides), [depsOverrides]);

	const handleAddAudio = useCallback(
		async (preferredTrackIndex?: number) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onAudioAdded) {
				return;
			}

			const result = await deps.openFilePicker();
			if (!result?.success || !result.path) {
				return;
			}

			const audioPath = result.path;
			const audioDurationMs = await deps.probeAudioDurationMs(audioPath);
			if (audioDurationMs <= 0) {
				deps.reportError(
					"Could not read audio file",
					"The selected file may be corrupted or in an unsupported format.",
				);
				return;
			}

			const startPos = Math.max(0, Math.min(currentTimeMs, totalMs));
			const maxRemainingDuration = totalMs - startPos;
			if (maxRemainingDuration <= 0) {
				deps.reportError(
					"Cannot place audio here",
					"There is no remaining space at the current playhead position.",
				);
				return;
			}

			const desiredDuration = Math.min(audioDurationMs, maxRemainingDuration);
			const normalizedPreferredTrackIndex = Number.isFinite(preferredTrackIndex)
				? Math.max(0, Math.floor(preferredTrackIndex ?? 0))
				: null;
			const maxTrackIndex = audioRegions.reduce(
				(max, region) => Math.max(max, region.trackIndex ?? 0),
				-1,
			);
			const candidateTrackIndexes =
				normalizedPreferredTrackIndex === null
					? Array.from({ length: maxTrackIndex + 2 }, (_, index) => index)
					: [normalizedPreferredTrackIndex];

			const getGapForTrack = (trackIndex: number) => {
				const trackRegions = audioRegions
					.filter((region) => (region.trackIndex ?? 0) === trackIndex)
					.sort((left, right) => left.startMs - right.startMs);
				const desiredSpan = {
					start: startPos,
					end: startPos + desiredDuration,
				};

				const overlappingRegion = trackRegions.find((region) =>
					spansOverlap(desiredSpan, { start: region.startMs, end: region.endMs }),
				);
				if (overlappingRegion) {
					return 0;
				}

				const nextRegion = trackRegions.find((region) => region.startMs > startPos);
				return nextRegion ? nextRegion.startMs - startPos : totalMs - startPos;
			};

			let selectedTrackIndex: number | null = null;
			let availableGap = 0;

			for (const trackIndex of candidateTrackIndexes) {
				const gap = getGapForTrack(trackIndex);
				if (gap >= desiredDuration) {
					selectedTrackIndex = trackIndex;
					availableGap = gap;
					break;
				}
			}

			if (selectedTrackIndex === null && normalizedPreferredTrackIndex === null) {
				for (const trackIndex of candidateTrackIndexes) {
					const gap = getGapForTrack(trackIndex);
					if (gap > 0) {
						selectedTrackIndex = trackIndex;
						availableGap = gap;
						break;
					}
				}
			}

			if (selectedTrackIndex === null || availableGap <= 0) {
				deps.reportError(
					"Cannot place audio here",
					"Audio region already exists at this location or not enough space available.",
				);
				return;
			}

			const actualDuration = Math.min(audioDurationMs, availableGap, totalMs - startPos);
			onAudioAdded({ start: startPos, end: startPos + actualDuration }, audioPath, selectedTrackIndex);
		},
		[videoDuration, totalMs, onAudioAdded, deps, currentTimeMs, audioRegions],
	);

	return { handleAddAudio };
}
