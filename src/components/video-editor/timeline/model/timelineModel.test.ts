import { describe, expect, it } from "vitest";
import { buildAllRegionSpans, buildTimelineItems, resolveDropRowId } from "./timelineModel";

describe("timeline model", () => {
	it("maps regions to timeline items and labels", () => {
		const items = buildTimelineItems({
			zoomRegions: [
				{ id: "z1", startMs: 0, endMs: 1000, depth: 2, focus: { cx: 0.5, cy: 0.5 } },
			],
			clipRegions: [{ id: "c1", startMs: 0, endMs: 4000, speed: 1 }],
			annotationRegions: [
				{
					id: "a1",
					startMs: 200,
					endMs: 1200,
					type: "text",
					content: "Hello timeline",
					position: { x: 0, y: 0 },
					size: { width: 1, height: 1 },
					style: {
						fontSize: 12,
						color: "#fff",
						backgroundColor: "transparent",
						borderRadius: 0,
						fontFamily: "Inter",
						fontWeight: "normal",
						fontStyle: "normal",
						textDecoration: "none",
						textAlign: "left",
					},
					zIndex: 0,
					trackIndex: 1,
				},
			],
			audioRegions: [
				{
					id: "au1",
					startMs: 500,
					endMs: 2000,
					audioPath: "/tmp/foo.mp3",
					volume: 1,
					trackIndex: 0,
				},
			],
		});

		expect(items).toHaveLength(4);
		expect(items.find((i) => i.id === "a1")?.rowId).toBe("row-annotation-1");
		expect(items.find((i) => i.id === "au1")?.label).toBe("foo");
	});

	it("builds row spans for dnd constraints", () => {
		const spans = buildAllRegionSpans({
			zoomRegions: [
				{ id: "z1", startMs: 0, endMs: 1000, depth: 2, focus: { cx: 0.5, cy: 0.5 } },
			],
			clipRegions: [{ id: "c1", startMs: 0, endMs: 4000, speed: 1 }],
			audioRegions: [
				{
					id: "au1",
					startMs: 500,
					endMs: 2000,
					audioPath: "x.wav",
					volume: 1,
					trackIndex: 2,
				},
			],
		});
		expect(spans.map((s) => s.rowId)).toEqual(["row-zoom", "row-clip", "row-audio-2"]);
	});

	it("keeps items in their domain rows during dnd", () => {
		const items = [
			{
				id: "a1",
				rowId: "row-annotation-1",
				span: { start: 0, end: 1 },
				label: "A",
				variant: "annotation" as const,
			},
		];
		expect(resolveDropRowId("a1", "row-audio-0", items)).toBe("row-annotation-1");
		expect(resolveDropRowId("a1", "row-annotation-3", items)).toBe("row-annotation-3");
	});
});
