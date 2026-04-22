import { describe, expect, it } from "vitest";

import { appendSyncedAudioFilter, getAudioSyncAdjustment } from "./filters";

describe("getAudioSyncAdjustment", () => {
	it("does not speed up longer audio tracks that would advance speech", () => {
		expect(getAudioSyncAdjustment(120, 122.5)).toEqual({
			mode: "none",
			delayMs: 0,
			tempoRatio: 1,
			durationDeltaMs: -2500,
		});
	});

	it("still stretches slightly shorter audio tracks to match the video", () => {
		expect(getAudioSyncAdjustment(120, 117)).toEqual({
			mode: "tempo",
			delayMs: 0,
			tempoRatio: 0.975,
			durationDeltaMs: 3000,
		});
	});

	it("still delays much shorter audio tracks instead of extreme tempo correction", () => {
		expect(getAudioSyncAdjustment(120, 110)).toEqual({
			mode: "delay",
			delayMs: 10000,
			tempoRatio: 1,
			durationDeltaMs: 10000,
		});
	});

	it("does not inject atempo when longer audio stays on the anchored path", () => {
		const filterParts: string[] = [];
		appendSyncedAudioFilter(filterParts, "[1:a]", "aout", getAudioSyncAdjustment(120, 122.5));

		expect(filterParts).toEqual([
			"[1:a]aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS[aout]",
		]);
	});

	it("still injects atempo for slightly shorter audio tracks", () => {
		const filterParts: string[] = [];
		appendSyncedAudioFilter(filterParts, "[1:a]", "aout", getAudioSyncAdjustment(120, 117));

		expect(filterParts).toEqual([
			"[1:a]atempo=0.975000,aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS[aout]",
		]);
	});
});
