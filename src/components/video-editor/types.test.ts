import { describe, expect, it } from "vitest";

import { extendAutoFullTrackClip } from "./types";

describe("extendAutoFullTrackClip", () => {
	it("extends the default full-track clip when metadata duration grows", () => {
		expect(
			extendAutoFullTrackClip(
				[{ id: "clip-1", startMs: 0, endMs: 5_000, speed: 1 }],
				"clip-1",
				5_000,
				8_000,
			),
		).toEqual([{ id: "clip-1", startMs: 0, endMs: 8_000, speed: 1 }]);
	});

	it("does not change a clip that no longer matches the auto-created shape", () => {
		expect(
			extendAutoFullTrackClip(
				[{ id: "clip-1", startMs: 0, endMs: 4_000, speed: 1.5 }],
				"clip-1",
				5_000,
				8_000,
			),
		).toBeNull();
	});

	it("does not change multi-clip timelines or non-growing durations", () => {
		expect(
			extendAutoFullTrackClip(
				[
					{ id: "clip-1", startMs: 0, endMs: 3_000, speed: 1 },
					{ id: "clip-2", startMs: 4_000, endMs: 8_000, speed: 1 },
				],
				"clip-1",
				8_000,
				10_000,
			),
		).toBeNull();
		expect(
			extendAutoFullTrackClip(
				[{ id: "clip-1", startMs: 0, endMs: 8_000, speed: 1 }],
				"clip-1",
				8_000,
				8_000,
			),
		).toBeNull();
	});
});
