import { describe, expect, it, vi } from "vitest";
import {
	isCssGradientBackground,
	paintCssGradientBackground,
} from "./cssGradientBackground";

function createMockGradient() {
	return {
		addColorStop: vi.fn(),
	};
}

function createMockContext() {
	return {
		createLinearGradient: vi.fn(() => createMockGradient()),
		createRadialGradient: vi.fn(() => createMockGradient()),
		fillRect: vi.fn(),
		save: vi.fn(),
		restore: vi.fn(),
		translate: vi.fn(),
		scale: vi.fn(),
		fillStyle: "",
	} as unknown as CanvasRenderingContext2D;
}

describe("cssGradientBackground", () => {
	it("recognizes layered css gradients", () => {
		expect(
			isCssGradientBackground(
				"radial-gradient(20% 30% at 10% 20%, #ffffff 0%, #00000000 100%), linear-gradient(135deg, #111111 0%, #222222 100%)",
			),
		).toBe(true);
	});

	it("renders layered gradients back-to-front onto canvas", () => {
		const ctx = createMockContext();
		const gradient =
			"radial-gradient(22% 34% at 12% 18%, #CEFAFFCC 0%, #00000000 78%), radial-gradient(28% 36% at 86% 84%, #8A4FFFF5 10%, #00000000 84%), linear-gradient(125deg, #4EB5FFFF 1%, #4C00FCFF 100%)";

		expect(paintCssGradientBackground(ctx, gradient, 1920, 1080)).toBe(true);
		expect(ctx.createLinearGradient).toHaveBeenCalledTimes(1);
		expect(ctx.createRadialGradient).toHaveBeenCalledTimes(2);
		expect(ctx.fillRect).toHaveBeenCalledTimes(3);
	});
});