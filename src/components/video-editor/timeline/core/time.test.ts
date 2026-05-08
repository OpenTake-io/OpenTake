import { describe, expect, it } from "vitest";
import {
	calculateAxisScale,
	calculateTimelineScale,
	createInitialRange,
	formatPlayheadTime,
	formatTimeLabel,
	normalizeWheelDeltaToPixels,
} from "./time";

describe("timeline core/time", () => {
	it("creates fallback range for empty timeline", () => {
		expect(createInitialRange(0)).toEqual({ start: 0, end: 1000 });
		expect(createInitialRange(2500)).toEqual({ start: 0, end: 2500 });
	});

	it("computes scale bounds", () => {
		expect(calculateTimelineScale(0).minItemDurationMs).toBe(100);
		expect(calculateTimelineScale(100).defaultItemDurationMs).toBe(5000);
	});

	it("formats timeline and playhead labels", () => {
		expect(formatTimeLabel(1234, 100)).toBe("0:01.23");
		expect(formatPlayheadTime(1234)).toBe("1.2s");
	});

	it("normalizes wheel delta by deltaMode", () => {
		expect(normalizeWheelDeltaToPixels(2, 0)).toBe(2);
		expect(normalizeWheelDeltaToPixels(2, 1)).toBe(32);
		expect(normalizeWheelDeltaToPixels(2, 2)).toBe(480);
	});

	it("picks axis interval based on visible range", () => {
		expect(calculateAxisScale(2000).intervalMs).toBeGreaterThan(0);
	});
});
