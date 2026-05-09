import { useEffect, useRef, useState } from "react";
import { fromFileUrl, resolveVideoUrl } from "../../projectPersistence";
import type { AudioPeaksData } from "../core/timelineTypes";

/** Number of peak bins to produce — enough for smooth display at any zoom. */
const TARGET_PEAK_COUNT = 2048;

function buildSidecarAudioCandidates(sourcePath: string): string[] {
	const normalized = sourcePath.replace(/\\/g, "/");
	const lastSlash = normalized.lastIndexOf("/");
	const dir = lastSlash >= 0 ? normalized.slice(0, lastSlash + 1) : "";
	const fileName = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
	const dotIndex = fileName.lastIndexOf(".");
	const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;

	return [
		`${dir}${baseName}.system.wav`,
		`${dir}${baseName}.mic.wav`,
		`${dir}${baseName}.system.m4a`,
		`${dir}${baseName}.mic.m4a`,
	];
}

function extractLocalPathFromMediaServerUrl(input: string): string | null {
	try {
		const url = new URL(input);
		const isLocalMediaServer =
			(url.protocol === "http:" || url.protocol === "https:") &&
			(url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
			url.pathname === "/video";
		if (!isLocalMediaServer) return null;
		const rawPath = url.searchParams.get("path");
		if (!rawPath) return null;
		return rawPath;
	} catch {
		return null;
	}
}

async function decodePeaksFromMediaUrl(
	mediaUrl: string,
	cancelled: () => boolean,
): Promise<AudioPeaksData> {
	const response = await fetch(mediaUrl);
	if (!response.ok) {
		throw new Error(`Failed to load media for waveform: ${response.status}`);
	}
	if (cancelled()) throw new Error("cancelled");
	console.debug("[timeline-audio-peaks] fetch ok", {
		url: mediaUrl,
		status: response.status,
	});

	const arrayBuffer = await response.arrayBuffer();
	if (cancelled()) throw new Error("cancelled");
	console.debug("[timeline-audio-peaks] bytes loaded", {
		url: mediaUrl,
		byteLength: arrayBuffer.byteLength,
	});

	const audioCtx = new OfflineAudioContext(1, 1, 44100);
	const decoded = await audioCtx.decodeAudioData(arrayBuffer);
	if (cancelled()) throw new Error("cancelled");
	console.debug("[timeline-audio-peaks] decode ok", {
		url: mediaUrl,
		durationSec: decoded.duration,
		channelCount: decoded.numberOfChannels,
		sampleRate: decoded.sampleRate,
		sampleFrames: decoded.length,
	});

	const channelData = decoded.getChannelData(0);
	const durationMs = decoded.duration * 1000;
	const binSize = Math.max(1, Math.floor(channelData.length / TARGET_PEAK_COUNT));
	const peakCount = Math.ceil(channelData.length / binSize);
	const peaks = new Float32Array(peakCount);

	for (let i = 0; i < peakCount; i++) {
		const start = i * binSize;
		const end = Math.min(start + binSize, channelData.length);
		let max = 0;
		for (let j = start; j < end; j++) {
			const abs = Math.abs(channelData[j]);
			if (abs > max) max = abs;
		}
		peaks[i] = max;
	}

	let globalMax = 0;
	for (let i = 0; i < peaks.length; i++) {
		if (peaks[i] > globalMax) globalMax = peaks[i];
	}
	if (globalMax > 0) {
		for (let i = 0; i < peaks.length; i++) {
			peaks[i] /= globalMax;
		}
	}

	return { peaks, durationMs };
}

/**
 * Decode audio from a media file URL and produce a fixed-length array of peak
 * amplitudes suitable for waveform visualisation.
 *
 * Returns `null` while loading or if the file has no decodeable audio.
 */
export function useTimelineAudioPeaks(fileUrl: string | null | undefined): AudioPeaksData | null {
	const [data, setData] = useState<AudioPeaksData | null>(null);
	const urlRef = useRef(fileUrl);

	useEffect(() => {
		urlRef.current = fileUrl;
		setData(null);
		console.debug("[timeline-audio-peaks] reset", { input: fileUrl ?? null });

		if (!fileUrl) {
			console.debug("[timeline-audio-peaks] no input source, skipping");
			return;
		}

		let cancelled = false;

		(async () => {
			try {
				const extractedLocalPath = extractLocalPathFromMediaServerUrl(fileUrl);
				const isRemoteLike = /^(https?:|blob:|data:)/i.test(fileUrl) && !extractedLocalPath;
				const isFileUrl = /^file:\/\//i.test(fileUrl);
				const sourceLocalPath = isRemoteLike
					? null
					: extractedLocalPath
						? extractedLocalPath
					: isFileUrl
						? fromFileUrl(fileUrl)
						: fileUrl;
				console.debug("[timeline-audio-peaks] resolving source", {
					input: fileUrl,
					isRemoteLike,
					isFileUrl,
					sourceLocalPath,
					extractedLocalPath,
				});
				const mediaUrl = isRemoteLike
					? fileUrl
					: isFileUrl
						? await resolveVideoUrl(fromFileUrl(fileUrl))
						: await resolveVideoUrl(fileUrl);
				if (cancelled) return;
				console.debug("[timeline-audio-peaks] resolved source", {
					input: fileUrl,
					resolved: mediaUrl,
				});

				let decodedPeaks: AudioPeaksData | null = null;
				try {
					decodedPeaks = await decodePeaksFromMediaUrl(mediaUrl, () => cancelled);
				} catch (primaryError) {
					if (primaryError instanceof Error && primaryError.message === "cancelled") {
						return;
					}
					console.warn("[timeline-audio-peaks] primary decode failed", {
						input: fileUrl,
						url: mediaUrl,
						error: primaryError,
					});
					if (sourceLocalPath) {
						const candidates = buildSidecarAudioCandidates(sourceLocalPath);
						console.debug("[timeline-audio-peaks] trying sidecar candidates", {
							sourceLocalPath,
							candidates,
						});
						for (const candidatePath of candidates) {
							try {
								const candidateUrl = await resolveVideoUrl(candidatePath);
								console.debug("[timeline-audio-peaks] trying sidecar", {
									candidatePath,
									candidateUrl,
								});
								decodedPeaks = await decodePeaksFromMediaUrl(candidateUrl, () => cancelled);
								console.info("[timeline-audio-peaks] sidecar decode succeeded", {
									candidatePath,
									candidateUrl,
								});
								break;
							} catch (sidecarError) {
								if (sidecarError instanceof Error && sidecarError.message === "cancelled") {
									return;
								}
								console.debug("[timeline-audio-peaks] sidecar decode failed", {
									candidatePath,
									error: sidecarError,
								});
							}
						}
					}
				}

				if (!cancelled && urlRef.current === fileUrl && decodedPeaks) {
					console.debug("[timeline-audio-peaks] peaks generated", {
						input: fileUrl,
						durationMs: Math.round(decodedPeaks.durationMs),
						peakCount: decodedPeaks.peaks.length,
					});
					setData(decodedPeaks);
				}
			} catch (error) {
				// File has no audio or decoding failed — leave as null.
				console.warn("[timeline-audio-peaks] failed", {
					input: fileUrl,
					error,
				});
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [fileUrl]);

	return data;
}
