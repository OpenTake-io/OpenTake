import { describe, expect, it } from "vitest";

import {
	getDefaultLightningRenderBackend,
	normalizeLightningRuntimePlatform,
	planLightningExportRoutes,
	shouldPreferNativeAutoBackend,
	shouldPreferNativeStaticLayoutBeforeBreeze,
} from "./backendPolicy";

describe("backendPolicy", () => {
	it("normalizes common platform hints", () => {
		expect(normalizeLightningRuntimePlatform("Win32")).toBe("win32");
		expect(normalizeLightningRuntimePlatform("Linux x86_64")).toBe("linux");
		expect(normalizeLightningRuntimePlatform("MacIntel")).toBe("darwin");
		expect(normalizeLightningRuntimePlatform("unknown")).toBe("unknown");
	});

	it("prefers native auto backend on desktop platforms with the fastest native path", () => {
		expect(shouldPreferNativeAutoBackend("win32")).toBe(true);
		expect(shouldPreferNativeAutoBackend("linux")).toBe(false);
		expect(shouldPreferNativeAutoBackend("darwin")).toBe(true);
		expect(shouldPreferNativeAutoBackend("unknown")).toBe(false);
	});

	it("keeps Lightning exports on the stable WebGL renderer by default", () => {
		expect(getDefaultLightningRenderBackend()).toBe("webgl");
	});

	it("puts visually compatible Windows auto exports on native static layout before Breeze", () => {
		expect(shouldPreferNativeStaticLayoutBeforeBreeze("win32", "auto")).toBe(true);
		expect(shouldPreferNativeStaticLayoutBeforeBreeze("darwin", "auto")).toBe(false);

		expect(
			planLightningExportRoutes({
				backendPreference: "auto",
				platform: "win32",
				nativeStaticLayoutAvailable: true,
			}),
		).toMatchObject({
			selectedRoute: "native-static-layout",
			decisions: [
				{ route: "native-static-layout", status: "selected" },
				{ route: "breeze-stream", status: "fallback" },
				{ route: "webcodecs", status: "fallback" },
			],
		});
	});

	it("documents the Breeze fallback when Windows static native is rejected", () => {
		expect(
			planLightningExportRoutes({
				backendPreference: "auto",
				platform: "win32",
				nativeStaticLayoutAvailable: true,
				nativeStaticLayoutSkipReasons: ["unsupported-frame-overlay"],
			}),
		).toEqual({
			selectedRoute: "breeze-stream",
			decisions: [
				{
					route: "native-static-layout",
					status: "rejected",
					reasons: ["unsupported-frame-overlay"],
				},
				{
					route: "breeze-stream",
					status: "selected",
					reasons: ["windows-native-static-fallback"],
				},
				{
					route: "webcodecs",
					status: "fallback",
					reasons: ["breeze-unavailable-fallback"],
				},
			],
		});
	});
});
