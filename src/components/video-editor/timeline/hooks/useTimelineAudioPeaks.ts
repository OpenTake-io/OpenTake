import { useEffect, useRef, useState } from "react";
import { resolveMediaResourceUrl } from "@/lib/exporter/localMediaSource";
import { fromFileUrl } from "../../projectPersistence";
import { waveformGenerator } from "../components/waveform/WaveformGenerator";
import type { AudioPeaksData } from "../core/timelineTypes";

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
		return url.searchParams.get("path");
	} catch {
		return null;
	}
}

interface TimelineAudioPeaksOptions {
	enableSourceSidecarFallback?: boolean;
}

export function useTimelineAudioPeaks(
	mediaResource: string | null | undefined,
	options: TimelineAudioPeaksOptions = {},
): AudioPeaksData | null {
	const [data, setData] = useState<AudioPeaksData | null>(null);
	const sourceRef = useRef(mediaResource);
	const enableSourceSidecarFallback = options.enableSourceSidecarFallback ?? false;

	useEffect(() => {
		sourceRef.current = mediaResource;
		setData(null);
		if (!mediaResource) return;

		let cancelled = false;

		const run = async () => {
			const localPathFromServer = extractLocalPathFromMediaServerUrl(mediaResource);
			const localSourcePath =
				localPathFromServer ||
				(/^file:\/\//i.test(mediaResource) ? fromFileUrl(mediaResource) : mediaResource);

			const tryGenerate = async (resource: string): Promise<AudioPeaksData> => {
				const resolvedUrl = await resolveMediaResourceUrl(resource);
				return waveformGenerator.generate(resolvedUrl);
			};

			try {
				const result = await tryGenerate(mediaResource);
				if (!cancelled && sourceRef.current === mediaResource) setData(result);
				return;
			} catch {
				// fallthrough
			}

			if (!enableSourceSidecarFallback || !localSourcePath) return;

			for (const candidate of buildSidecarAudioCandidates(localSourcePath)) {
				try {
					const result = await tryGenerate(candidate);
					if (!cancelled && sourceRef.current === mediaResource) setData(result);
					return;
				} catch {
					// try next
				}
			}
		};

		void run();

		return () => {
			cancelled = true;
		};
	}, [mediaResource, enableSourceSidecarFallback]);

	return data;
}
