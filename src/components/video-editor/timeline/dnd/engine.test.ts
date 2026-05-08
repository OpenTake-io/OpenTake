import { describe, expect, it } from "vitest";
import {
	clampDraggedSpanToNeighbours,
	clampRange,
	clampResizedSpanToNeighbours,
	clampSpanToBounds,
	resolveDragEnd,
	resolveResizeEnd,
} from "./engine";

const BASE_SPANS = [
	{ id: "a", start: 0, end: 1000, rowId: "row-clip" },
	{ id: "b", start: 1500, end: 2500, rowId: "row-clip" },
	{ id: "c", start: 3000, end: 3600, rowId: "row-clip" },
];

describe("timeline dnd engine", () => {
	it("clamps item span to timeline bounds and min duration", () => {
		expect(clampSpanToBounds({ start: -100, end: 20 }, { totalMs: 5000, minItemDurationMs: 100 })).toEqual({ start: 0, end: 120 });
	});

	it("clamps visible range inside total duration", () => {
		expect(clampRange({ start: 4900, end: 5200 }, { totalMs: 5000, minVisibleRangeMs: 300 })).toEqual({ start: 4700, end: 5000 });
	});

	it("clamps resize against nearest neighbours", () => {
		const resized = clampResizedSpanToNeighbours(
			{ start: 900, end: 2000 },
			"a",
			{ allRegionSpans: BASE_SPANS, minItemDurationMs: 100, totalMs: 5000 },
		);
		expect(resized.end).toBe(1500);
	});

	it("keeps drag unchanged when already inside valid neighbour gap", () => {
		const dragged = clampDraggedSpanToNeighbours(
			{ start: 1400, end: 2400 },
			"b",
			"row-clip",
			{ allRegionSpans: BASE_SPANS, minItemDurationMs: 100, totalMs: 5000 },
		);
		expect(dragged).toEqual({ start: 1400, end: 2400 });
	});

	it("resolves resize end with overlap fallback semantics", () => {
		const result = resolveResizeEnd("a", { start: 900, end: 2200 }, {
			totalMs: 5000,
			minItemDurationMs: 100,
			allRegionSpans: BASE_SPANS,
			hasOverlap: (span, id) => id === "a" && span.end > 1500,
		});
		expect(result).toEqual({ start: 900, end: 1500 });
	});

	it("resolves drag end with row resolver while preserving duration", () => {
		const result = resolveDragEnd(
			"b",
			{ start: 1200, end: 1800 },
			"row-clip",
			{
				allRegionSpans: BASE_SPANS,
				totalMs: 5000,
				minItemDurationMs: 100,
				hasOverlap: () => false,
			},
			(id, rowId) => (id === "b" ? rowId : rowId),
		);

		expect(result).toEqual({ rowId: "row-clip", span: { start: 1200, end: 2200 } });
	});
});
