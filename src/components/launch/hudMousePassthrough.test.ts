import { describe, expect, it } from "vitest";

import { shouldRestoreHudMousePassthroughAfterDrag } from "./hudMousePassthrough";

describe("shouldRestoreHudMousePassthroughAfterDrag", () => {
	it("keeps the HUD interactive when the pointer is still inside the HUD", () => {
		expect(
			shouldRestoreHudMousePassthroughAfterDrag(
				{ left: 100, top: 200, right: 300, bottom: 260 },
				180,
				230,
			),
		).toBe(false);
	});

	it("keeps the HUD interactive when the pointer ends on the HUD edge", () => {
		expect(
			shouldRestoreHudMousePassthroughAfterDrag(
				{ left: 100, top: 200, right: 300, bottom: 260 },
				300,
				260,
			),
		).toBe(false);
	});

	it("restores passthrough when the pointer ends outside the HUD", () => {
		expect(
			shouldRestoreHudMousePassthroughAfterDrag(
				{ left: 100, top: 200, right: 300, bottom: 260 },
				301,
				261,
			),
		).toBe(true);
	});

	it("restores passthrough when no HUD bounds are available", () => {
		expect(shouldRestoreHudMousePassthroughAfterDrag(null, 180, 230)).toBe(true);
	});
});
