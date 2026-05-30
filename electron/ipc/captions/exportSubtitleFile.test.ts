import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
	app: {
		getPath: () => process.env.TEMP ?? process.cwd(),
	},
	BrowserWindow: {
		fromWebContents: () => null,
	},
	dialog: {
		showSaveDialog: vi.fn(),
	},
}));

vi.mock("../utils", () => ({
	approveUserPath: vi.fn(),
}));

import { dialog } from "electron";
import {
	cuesToSrt,
	cuesToVtt,
	exportSubtitleFile,
	subtitleCuesToFile,
} from "./exportSubtitleFile";

const tempDirs: string[] = [];

async function makeTempDir() {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "recordly-subtitle-export-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(async () => {
	vi.restoreAllMocks();
	await Promise.allSettled(
		tempDirs.splice(0).map((dir) => fs.rm(dir, { force: true, recursive: true })),
	);
});

describe("subtitle serializers", () => {
	it("serializes SRT cues with numbered blocks and comma millisecond timestamps", () => {
		expect(
			cuesToSrt([
				{ start: 0, end: 1500, text: "Hello" },
				{ start: 1500, end: 3200, text: "World" },
			]),
		).toBe(
			[
				"1",
				"00:00:00,000 --> 00:00:01,500",
				"Hello",
				"",
				"2",
				"00:00:01,500 --> 00:00:03,200",
				"World",
				"",
			].join("\n"),
		);
	});

	it("serializes VTT cues with a WEBVTT header and dot millisecond timestamps", () => {
		expect(
			cuesToVtt([
				{ startMs: 0, endMs: 1500, text: "Hello" },
				{ startMs: 1500, endMs: 3200, text: "World" },
			]),
		).toBe(
			[
				"WEBVTT",
				"",
				"1",
				"00:00:00.000 --> 00:00:01.500",
				"Hello",
				"",
				"2",
				"00:00:01.500 --> 00:00:03.200",
				"World",
				"",
			].join("\n"),
		);
	});

	it("skips malformed cues without aborting serialization", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		expect(
			subtitleCuesToFile("srt", [
				{ startMs: 1000, endMs: 500, text: "bad" },
				{ startMs: 1000, endMs: 1500, text: "good" },
			]),
		).toBe("1\n00:00:01,000 --> 00:00:01,500\ngood\n");
		expect(warnSpy).toHaveBeenCalledWith(
			"[subtitle-export] Skipping malformed caption cue:",
			expect.objectContaining({ index: 0 }),
		);
	});

	it("returns an empty SRT body and a header-only VTT body for empty cues", () => {
		expect(cuesToSrt([])).toBe("");
		expect(cuesToVtt([])).toBe("WEBVTT\n\n");
	});

	it("preserves multiline cue text literally", () => {
		expect(cuesToSrt([{ startMs: 0, endMs: 1000, text: "Hello\nWorld" }])).toBe(
			"1\n00:00:00,000 --> 00:00:01,000\nHello\nWorld\n",
		);
	});
});

describe("exportSubtitleFile", () => {
	it("returns a user-readable error when the selected path cannot be written", async () => {
		const dir = await makeTempDir();
		vi.mocked(dialog.showSaveDialog).mockResolvedValue({
			canceled: false,
			filePath: path.join(dir, "missing", "captions.srt"),
		});

		const result = await exportSubtitleFile(
			{ sender: {} } as Parameters<typeof exportSubtitleFile>[0],
			{
				format: "srt",
				cues: [{ id: "caption-1", startMs: 0, endMs: 1000, text: "Hello" }],
				fileName: "captions.srt",
			},
		);

		expect(result.success).toBe(false);
		expect(result.message).toContain("Failed to export subtitle file");
		expect(result.error).toBeTruthy();
	});
});
