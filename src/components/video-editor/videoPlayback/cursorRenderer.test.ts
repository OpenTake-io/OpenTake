import { describe, expect, it } from "vitest";

import { resolveCursorDrawHeight } from "./cursorRenderer";

describe("resolveCursorDrawHeight", () => {
	const viewport = {
		x: 100,
		y: 50,
		width: 960,
		height: 540,
	};

	it("keeps cursor output size stable when the zoom parent scales up", () => {
		const baseHeight = resolveCursorDrawHeight(viewport, 70, 1);
		const zoomedLocalHeight = resolveCursorDrawHeight(viewport, 70, 2);

		expect(zoomedLocalHeight).toBeCloseTo(baseHeight / 2, 6);
		expect(zoomedLocalHeight * 2).toBeCloseTo(baseHeight, 6);
	});

	it("falls back to unscaled sizing for invalid parent scale values", () => {
		const baseHeight = resolveCursorDrawHeight(viewport, 70, 1);

		expect(resolveCursorDrawHeight(viewport, 70, 0)).toBe(baseHeight);
		expect(resolveCursorDrawHeight(viewport, 70, Number.NaN)).toBe(baseHeight);
	});
});
