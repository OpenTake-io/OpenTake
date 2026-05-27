import fs from "node:fs/promises";
import path from "node:path";
import type { IpcMainInvokeEvent, SaveDialogOptions } from "electron";
import { app, BrowserWindow, dialog } from "electron";
import type { CaptionCuePayload } from "../types";
import { approveUserPath } from "../utils";

export type SubtitleExportFormat = "srt" | "vtt";

type SubtitleCueInput = Partial<CaptionCuePayload> & {
	start?: number;
	end?: number;
};

type NormalizedSubtitleCue = {
	startMs: number;
	endMs: number;
	text: string;
};

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function getCueTimeMs(cue: SubtitleCueInput, primaryKey: "startMs" | "endMs") {
	const fallbackKey = primaryKey === "startMs" ? "start" : "end";
	const primaryValue = cue[primaryKey];
	if (isFiniteNumber(primaryValue)) {
		return Math.round(primaryValue);
	}

	const fallbackValue = cue[fallbackKey];
	return isFiniteNumber(fallbackValue) ? Math.round(fallbackValue) : null;
}

function normalizeSubtitleCues(cues: SubtitleCueInput[]) {
	const normalizedCues: NormalizedSubtitleCue[] = [];

	cues.forEach((cue, index) => {
		const startMs = getCueTimeMs(cue, "startMs");
		const endMs = getCueTimeMs(cue, "endMs");
		const text = typeof cue.text === "string" ? cue.text.replace(/\r\n?/g, "\n") : "";

		if (startMs == null || endMs == null || endMs <= startMs || text.trim().length === 0) {
			console.warn("[subtitle-export] Skipping malformed caption cue:", {
				index,
				startMs,
				endMs,
				hasText: text.trim().length > 0,
			});
			return;
		}

		normalizedCues.push({ startMs, endMs, text });
	});

	return normalizedCues;
}

function formatTimestamp(ms: number, separator: "," | ".") {
	const roundedMs = Math.max(0, Math.round(ms));
	const hours = Math.floor(roundedMs / 3_600_000);
	const minutes = Math.floor((roundedMs % 3_600_000) / 60_000);
	const seconds = Math.floor((roundedMs % 60_000) / 1_000);
	const milliseconds = roundedMs % 1_000;

	return [
		String(hours).padStart(2, "0"),
		String(minutes).padStart(2, "0"),
		`${String(seconds).padStart(2, "0")}${separator}${String(milliseconds).padStart(3, "0")}`,
	].join(":");
}

export function cuesToSrt(cues: SubtitleCueInput[]) {
	const blocks = normalizeSubtitleCues(cues).map((cue, index) =>
		[
			String(index + 1),
			`${formatTimestamp(cue.startMs, ",")} --> ${formatTimestamp(cue.endMs, ",")}`,
			cue.text,
		].join("\n"),
	);

	return blocks.length > 0 ? `${blocks.join("\n\n")}\n` : "";
}

export function cuesToVtt(cues: SubtitleCueInput[]) {
	const blocks = normalizeSubtitleCues(cues).map((cue, index) =>
		[
			String(index + 1),
			`${formatTimestamp(cue.startMs, ".")} --> ${formatTimestamp(cue.endMs, ".")}`,
			cue.text,
		].join("\n"),
	);

	return `WEBVTT\n\n${blocks.length > 0 ? `${blocks.join("\n\n")}\n` : ""}`;
}

export function subtitleCuesToFile(format: SubtitleExportFormat, cues: SubtitleCueInput[]) {
	if (format === "srt") {
		return cuesToSrt(cues);
	}

	if (format === "vtt") {
		return cuesToVtt(cues);
	}

	throw new Error("Unsupported subtitle export format.");
}

function getSubtitleFilter(format: SubtitleExportFormat) {
	return format === "srt"
		? { name: "SubRip Subtitle", extensions: ["srt"] }
		: { name: "WebVTT Subtitle", extensions: ["vtt"] };
}

function getSafeFileName(fileName: unknown, format: SubtitleExportFormat) {
	if (typeof fileName !== "string" || fileName.trim().length === 0) {
		return `captions.${format}`;
	}

	const normalizedFileName = fileName.trim();
	return normalizedFileName.toLowerCase().endsWith(`.${format}`)
		? normalizedFileName
		: `${normalizedFileName}.${format}`;
}

export async function exportSubtitleFile(
	event: IpcMainInvokeEvent,
	options: {
		cues?: SubtitleCueInput[];
		format?: SubtitleExportFormat;
		fileName?: string;
	},
) {
	try {
		const format = options?.format;
		if (format !== "srt" && format !== "vtt") {
			throw new Error("Choose a subtitle format to export.");
		}

		if (!Array.isArray(options.cues)) {
			throw new Error("Subtitle export requires caption cues.");
		}

		const fileName = getSafeFileName(options.fileName, format);
		const saveDialogOptions: SaveDialogOptions = {
			title: `Save ${format.toUpperCase()} Subtitle File`,
			defaultPath: path.join(app.getPath("downloads"), fileName),
			filters: [getSubtitleFilter(format)],
			properties: ["createDirectory", "showOverwriteConfirmation"],
		};
		const parentWindow = BrowserWindow.fromWebContents(event.sender);
		const result = parentWindow
			? await dialog.showSaveDialog(parentWindow, saveDialogOptions)
			: await dialog.showSaveDialog(saveDialogOptions);

		if (result.canceled || !result.filePath) {
			return {
				success: false,
				canceled: true,
				message: "Subtitle export canceled",
			};
		}

		await fs.writeFile(result.filePath, subtitleCuesToFile(format, options.cues), "utf-8");
		approveUserPath(result.filePath);

		return {
			success: true,
			path: result.filePath,
			message: "Subtitle file exported successfully",
		};
	} catch (error) {
		console.error("Failed to export subtitle file:", error);
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			canceled: false,
			message: `Failed to export subtitle file: ${errorMessage}`,
			error: errorMessage,
		};
	}
}
