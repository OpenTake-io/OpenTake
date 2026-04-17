import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";
import { getFfmpegBinaryPath } from "../ffmpeg/binary";
import { COMPANION_AUDIO_LAYOUTS } from "../constants";
import type { NativeCaptureDiagnostics, CompanionAudioCandidate } from "../types";
import { lastNativeCaptureDiagnostics, setLastNativeCaptureDiagnostics } from "../state";

const execFileAsync = promisify(execFile);

export function recordNativeCaptureDiagnostics(
	diagnostics: Omit<NativeCaptureDiagnostics, "timestamp">,
) {
	setLastNativeCaptureDiagnostics({
		timestamp: new Date().toISOString(),
		...diagnostics,
	});

	return lastNativeCaptureDiagnostics;
}

export async function getFileSizeIfPresent(filePath: string | null | undefined) {
	if (!filePath) {
		return null;
	}

	try {
		const stat = await fs.stat(filePath);
		return stat.size;
	} catch {
		return null;
	}
}

export function parseFfmpegDurationSeconds(stderr: string) {
	const match = stderr.match(/Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/i);
	if (!match) {
		return null;
	}

	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	const seconds = Number(match[3]);
	if (![hours, minutes, seconds].every(Number.isFinite)) {
		return null;
	}

	return hours * 3600 + minutes * 60 + seconds;
}

/** Probe the duration of a media file (in seconds) using the container header. */
export async function probeMediaDurationSeconds(filePath: string): Promise<number> {
	const ffmpegPath = getFfmpegBinaryPath();
	try {
		await execFileAsync(ffmpegPath, ["-i", filePath, "-hide_banner"], { timeout: 5000 });
	} catch (error) {
		const stderr = (error as NodeJS.ErrnoException & { stderr?: string })?.stderr ?? "";
		const duration = parseFfmpegDurationSeconds(stderr);
		if (duration !== null) {
			return duration;
		}
	}
	return 0;
}

export async function getUsableCompanionAudioCandidates(
	videoPath: string,
): Promise<CompanionAudioCandidate[]> {
	const basePath = videoPath.replace(/\.[^.]+$/u, "");
	const candidates: CompanionAudioCandidate[] = [];

	for (const layout of COMPANION_AUDIO_LAYOUTS) {
		const systemPath = `${basePath}${layout.systemSuffix}`;
		const micPath = `${basePath}${layout.micSuffix}`;
		const usablePaths: string[] = [];

		for (const companionPath of [systemPath, micPath]) {
			try {
				const stat = await fs.stat(companionPath);
				if (stat.size > 0) {
					usablePaths.push(companionPath);
				}
			} catch {
				// Missing companion audio is expected for many recordings.
			}
		}

		if (usablePaths.length > 0) {
			candidates.push({
				platform: layout.platform,
				systemPath,
				micPath,
				usablePaths,
			});
		}
	}

	return candidates;
}

export async function hasEmbeddedAudioStream(videoPath: string) {
	const ffmpegPath = getFfmpegBinaryPath();
	let stderr = "";

	try {
		const result = await execFileAsync(
			ffmpegPath,
			["-hide_banner", "-i", videoPath, "-map", "0:a:0", "-frames:a", "1", "-f", "null", "-"],
			{ timeout: 20000, maxBuffer: 10 * 1024 * 1024 },
		);
		stderr = result.stderr;
	} catch (error) {
		stderr = (error as NodeJS.ErrnoException & { stderr?: string }).stderr ?? "";
	}

	return /Stream #.*Audio:/i.test(stderr);
}

export async function getCompanionAudioFallbackPaths(videoPath: string) {
	const companionCandidates = await getUsableCompanionAudioCandidates(videoPath);
	if (companionCandidates.length === 0) {
		return [];
	}

	if (await hasEmbeddedAudioStream(videoPath)) {
		return [];
	}

	return companionCandidates.flatMap((candidate) => candidate.usablePaths);
}

export async function validateRecordedVideo(videoPath: string) {
	const stat = await fs.stat(videoPath);
	if (!stat.isFile()) {
		throw new Error(`Recorded output is not a file: ${videoPath}`);
	}

	if (stat.size <= 0) {
		throw new Error(`Recorded output is empty: ${videoPath}`);
	}

	const ffmpegPath = getFfmpegBinaryPath();
	let stderr = "";

	try {
		const result = await execFileAsync(
			ffmpegPath,
			["-hide_banner", "-i", videoPath, "-map", "0:v:0", "-frames:v", "1", "-f", "null", "-"],
			{ timeout: 20000, maxBuffer: 10 * 1024 * 1024 },
		);
		stderr = result.stderr;
	} catch (error) {
		const execError = error as NodeJS.ErrnoException & { stderr?: string };
		const output = execError.stderr?.trim();
		throw new Error(output || `Recorded output could not be decoded: ${videoPath}`);
	}

	if (!/Stream #.*Video:/i.test(stderr)) {
		throw new Error(`Recorded output does not contain a readable video stream: ${videoPath}`);
	}

	const durationSeconds = parseFfmpegDurationSeconds(stderr);
	if (durationSeconds !== null && durationSeconds <= 0) {
		throw new Error(`Recorded output has an invalid duration: ${videoPath}`);
	}

	return {
		fileSizeBytes: stat.size,
		durationSeconds,
	};
}
