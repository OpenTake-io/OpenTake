import { describe, expect, it } from "vitest";

import {
	type BlockedClipSpeedChange,
	formatClipSpeedLabel,
	planClipSpeedChange,
} from "./clipSpeedChange";

describe("formatClipSpeedLabel", () => {
	it("returns labels only for non-default positive speeds", () => {
		expect(formatClipSpeedLabel(1)).toBeNull();
		expect(formatClipSpeedLabel(0)).toBeNull();
		expect(formatClipSpeedLabel(0.5)).toBe("0.5x");
		expect(formatClipSpeedLabel(2)).toBe("2x");
	});
});

describe("planClipSpeedChange", () => {
	it("extends an isolated clip when slowing it down", () => {
		const result = planClipSpeedChange({
			clipRegions: [{ id: "clip-1", startMs: 0, endMs: 5_000, speed: 1 }],
			zoomRegions: [],
			selectedClipId: "clip-1",
			speed: 0.5,
		});

		expect(result).toEqual({
			clipRegions: [{ id: "clip-1", startMs: 0, endMs: 10_000, speed: 0.5 }],
			zoomRegions: [],
		});
	});

	it("blocks slow speed changes that would overlap the next clip", () => {
		const result = planClipSpeedChange({
			clipRegions: [
				{ id: "clip-1", startMs: 0, endMs: 5_000, speed: 1 },
				{ id: "clip-2", startMs: 5_000, endMs: 10_000, speed: 1 },
			],
			zoomRegions: [],
			selectedClipId: "clip-1",
			speed: 0.5,
		}) as BlockedClipSpeedChange;

		expect(result.blockedReason).toBe("clip-overlap");
	});

	it("scales zoom regions inside the changed clip", () => {
		const result = planClipSpeedChange({
			clipRegions: [{ id: "clip-1", startMs: 1_000, endMs: 5_000, speed: 1 }],
			zoomRegions: [
				{ id: "zoom-1", startMs: 2_000, endMs: 3_000, depth: 2, focus: { cx: 0.5, cy: 0.5 } },
			],
			selectedClipId: "clip-1",
			speed: 0.5,
		});

		expect(result).toEqual({
			clipRegions: [{ id: "clip-1", startMs: 1_000, endMs: 9_000, speed: 0.5 }],
			zoomRegions: [
				{ id: "zoom-1", startMs: 3_000, endMs: 5_000, depth: 2, focus: { cx: 0.5, cy: 0.5 } },
			],
		});
	});

	it("blocks speed changes that would make scaled zooms overlap unchanged zooms", () => {
		const result = planClipSpeedChange({
			clipRegions: [{ id: "clip-1", startMs: 0, endMs: 5_000, speed: 1 }],
			zoomRegions: [
				{ id: "zoom-1", startMs: 2_000, endMs: 3_000, depth: 2, focus: { cx: 0.5, cy: 0.5 } },
				{ id: "zoom-2", startMs: 5_500, endMs: 6_500, depth: 3, focus: { cx: 0.5, cy: 0.5 } },
			],
			selectedClipId: "clip-1",
			speed: 0.5,
		}) as BlockedClipSpeedChange;

		expect(result.blockedReason).toBe("zoom-overlap");
	});
});
