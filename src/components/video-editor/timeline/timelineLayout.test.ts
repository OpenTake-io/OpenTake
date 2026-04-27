import { describe, expect, it } from "vitest";
import {
	getTimelineContentMinHeightPx,
	getTimelineRowsMinHeightPx,
	TIMELINE_AXIS_HEIGHT_PX,
	TIMELINE_ROW_MIN_HEIGHT_PX,
	TIMELINE_VIEWPORT_MIN_HEIGHT_PX,
	TIMELINE_VISIBLE_ROW_COUNT,
} from "./timelineLayout";

describe("timelineLayout", () => {
	it("reserves vertical space for every rendered timeline row", () => {
		expect(getTimelineRowsMinHeightPx(5)).toBe(5 * TIMELINE_ROW_MIN_HEIGHT_PX);
		expect(getTimelineContentMinHeightPx(5)).toBe(
			TIMELINE_AXIS_HEIGHT_PX + 5 * TIMELINE_ROW_MIN_HEIGHT_PX,
		);
	});

	it("ignores invalid row counts", () => {
		expect(getTimelineRowsMinHeightPx(-1)).toBe(0);
		expect(getTimelineRowsMinHeightPx(Number.NaN)).toBe(0);
		expect(getTimelineContentMinHeightPx(Number.POSITIVE_INFINITY)).toBe(
			TIMELINE_AXIS_HEIGHT_PX,
		);
	});

	it("floors fractional row counts", () => {
		expect(getTimelineRowsMinHeightPx(2.9)).toBe(2 * TIMELINE_ROW_MIN_HEIGHT_PX);
		expect(getTimelineContentMinHeightPx(2.9)).toBe(
			TIMELINE_AXIS_HEIGHT_PX + 2 * TIMELINE_ROW_MIN_HEIGHT_PX,
		);
	});

	it("caps the default timeline viewport to two visible rows", () => {
		expect(TIMELINE_VISIBLE_ROW_COUNT).toBe(2);
		expect(TIMELINE_VIEWPORT_MIN_HEIGHT_PX).toBe(
			TIMELINE_AXIS_HEIGHT_PX + TIMELINE_VISIBLE_ROW_COUNT * TIMELINE_ROW_MIN_HEIGHT_PX,
		);
	});
});
