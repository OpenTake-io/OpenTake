import fs from "node:fs/promises";
import path from "node:path";
import {
	AUTO_RECORDING_RETENTION_COUNT,
	AUTO_RECORDING_MAX_AGE_MS,
	PROJECT_FILE_EXTENSION,
	LEGACY_PROJECT_FILE_EXTENSIONS,
	COMPANION_AUDIO_LAYOUTS,
} from "../constants";
import { currentVideoPath } from "../state";
import { normalizePath, getTelemetryPathForVideo, isAutoRecordingPath, getRecordingsDir } from "../utils";

export async function hasSiblingProjectFile(videoPath: string) {
	const baseName = path.basename(videoPath, path.extname(videoPath));
	const candidateExtensions = [PROJECT_FILE_EXTENSION, ...LEGACY_PROJECT_FILE_EXTENSIONS];

	for (const extension of candidateExtensions) {
		const projectPath = path.join(path.dirname(videoPath), `${baseName}.${extension}`);

		try {
			await fs.access(projectPath);
			return true;
		} catch {
			continue;
		}
	}

	return false;
}

export { isAutoRecordingPath };

export async function pruneAutoRecordings(exemptPaths: string[] = []) {
	const recordingsDir = await getRecordingsDir();
	await fs.mkdir(recordingsDir, { recursive: true });
	const exempt = new Set(
		[currentVideoPath, ...exemptPaths]
			.filter((value): value is string => Boolean(value))
			.map((value) => normalizePath(value)),
	);

	const entries = await fs.readdir(recordingsDir, { withFileTypes: true });
	const autoRecordingStats = await Promise.all(
		entries
			.filter((entry) => entry.isFile() && /^recording-.*\.(mp4|mov|webm)$/i.test(entry.name))
			.map(async (entry) => {
				const filePath = path.join(recordingsDir, entry.name);
				const stats = await fs.stat(filePath);
				return { filePath, stats };
			}),
	);

	const sorted = autoRecordingStats.sort(
		(left, right) => right.stats.mtimeMs - left.stats.mtimeMs,
	);
	const now = Date.now();

	for (const [index, entry] of sorted.entries()) {
		const normalizedFilePath = normalizePath(entry.filePath);
		if (exempt.has(normalizedFilePath)) {
			continue;
		}

		if (await hasSiblingProjectFile(entry.filePath)) {
			continue;
		}

		const tooOld = now - entry.stats.mtimeMs > AUTO_RECORDING_MAX_AGE_MS;
		const overLimit = index >= AUTO_RECORDING_RETENTION_COUNT;
		if (!tooOld && !overLimit) {
			continue;
		}

		try {
			await fs.rm(entry.filePath, { force: true });
			await fs.rm(getTelemetryPathForVideo(entry.filePath), { force: true });
			// Clean up companion audio files left from recording (macOS .m4a, Windows .wav)
			const base = entry.filePath.replace(/\.(mp4|mov|webm)$/i, "");
			const companionSuffixes = Array.from(
				new Set(
					COMPANION_AUDIO_LAYOUTS.flatMap((layout) => [layout.systemSuffix, layout.micSuffix]),
				),
			);
			for (const suffix of companionSuffixes) {
				await fs.rm(base + suffix, { force: true }).catch(() => undefined);
			}
		} catch (error) {
			console.warn("Failed to prune old auto recording:", entry.filePath, error);
		}
	}
}
