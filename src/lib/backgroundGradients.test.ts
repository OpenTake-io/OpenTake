import { describe, expect, it } from "vitest";
import { blobGradientPreviewCss, GRADIENTS } from "./backgroundGradients";

describe("backgroundGradients", () => {
	it("builds deterministic blob previews", () => {
		const first = blobGradientPreviewCss({
			baseMode: "light",
			baseA: "#3182ce",
			baseB: "#4fd1c5",
			colors: ["#feb2b2", "rgba(252, 184, 219, 0.75)", "rgba(239, 194, 250, 0.5)"],
			seed: 910001,
			blobCount: 9,
			intensity: 0.74,
			angleDeg: 135,
		});
		const second = blobGradientPreviewCss({
			baseMode: "light",
			baseA: "#3182ce",
			baseB: "#4fd1c5",
			colors: ["#feb2b2", "rgba(252, 184, 219, 0.75)", "rgba(239, 194, 250, 0.5)"],
			seed: 910001,
			blobCount: 9,
			intensity: 0.74,
			angleDeg: 135,
		});

		expect(first).toBe(second);
		expect(first).toContain("linear-gradient(");
		expect(first).toContain("radial-gradient(");
	});

	it("keeps two blob rows and one linear row", () => {
		expect(GRADIENTS).toHaveLength(24);
		expect(GRADIENTS.slice(0, 16).every((gradient) => gradient.includes("radial-gradient("))).toBe(
			true,
		);
		expect(GRADIENTS.slice(16).every((gradient) => gradient.startsWith("linear-gradient("))).toBe(
			true,
		);
	});
});