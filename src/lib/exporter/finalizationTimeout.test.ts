import { describe, expect, it, vi } from "vitest";

import {
	type FinalizationProgressWatchdog,
	getExportFinalizationIdleTimeoutMs,
	getExportFinalizationTimeoutMs,
	withFinalizationTimeout,
} from "./finalizationTimeout";

describe("finalizationTimeout", () => {
	it("keeps non-audio finalization on the existing 10 minute timeout", () => {
		expect(getExportFinalizationTimeoutMs({ workload: "default" })).toBe(600_000);
		expect(
			getExportFinalizationTimeoutMs({
				workload: "default",
				effectiveDurationSec: 7_200,
			}),
		).toBe(600_000);
	});

	it("gives audio finalization more headroom on longer exports", () => {
		expect(
			getExportFinalizationTimeoutMs({
				workload: "audio",
				effectiveDurationSec: 1_200,
			}),
		).toBe(1_200_000);
		expect(
			getExportFinalizationTimeoutMs({
				workload: "audio",
				effectiveDurationSec: 2_700,
			}),
		).toBe(1_950_000);
	});

	it("caps adaptive audio timeout growth", () => {
		expect(
			getExportFinalizationTimeoutMs({
				workload: "audio",
				effectiveDurationSec: 10_800,
			}),
		).toBe(2_700_000);
	});

	it("falls back to the base timeout for invalid audio durations", () => {
		expect(
			getExportFinalizationTimeoutMs({
				workload: "audio",
				effectiveDurationSec: 0,
			}),
		).toBe(600_000);
		expect(
			getExportFinalizationTimeoutMs({
				workload: "audio",
				effectiveDurationSec: Number.NaN,
			}),
		).toBe(600_000);
	});

	it("derives a bounded idle watchdog window from the total timeout", () => {
		expect(
			getExportFinalizationIdleTimeoutMs({
				workload: "default",
			}),
		).toBe(150_000);
		expect(
			getExportFinalizationIdleTimeoutMs({
				workload: "audio",
				effectiveDurationSec: 1_200,
			}),
		).toBe(300_000);
		expect(
			getExportFinalizationIdleTimeoutMs({
				workload: "audio",
				effectiveDurationSec: 2_700,
			}),
		).toBe(300_000);
		expect(
			getExportFinalizationIdleTimeoutMs({
				workload: "audio",
				effectiveDurationSec: 0,
			}),
		).toBe(150_000);
		expect(
			getExportFinalizationIdleTimeoutMs({
				workload: "audio",
				effectiveDurationSec: Number.NaN,
			}),
		).toBe(150_000);
	});

	it("rejects when a progress-aware finalization stage stops reporting progress", async () => {
		vi.useFakeTimers();

		try {
			const idleTimeoutMs = getExportFinalizationIdleTimeoutMs({
				workload: "audio",
				effectiveDurationSec: 1_200,
			});

			const pendingStage = withFinalizationTimeout({
				promise: new Promise<never>(() => {}),
				stage: "audio processing",
				workload: "audio",
				effectiveDurationSec: 1_200,
				progressAware: true,
			});

			const rejection = pendingStage.then(
				() => null,
				(error) => (error instanceof Error ? error.message : String(error)),
			);

			await vi.advanceTimersByTimeAsync(idleTimeoutMs + 1);

			await expect(rejection).resolves.toContain("without observable progress");
		} finally {
			vi.useRealTimers();
		}
	});

	it("resets the idle watchdog when finalization progress continues", async () => {
		vi.useFakeTimers();

		try {
			const idleTimeoutMs = getExportFinalizationIdleTimeoutMs({
				workload: "audio",
				effectiveDurationSec: 1_200,
			});
			let watchdog: FinalizationProgressWatchdog | null = null;
			const pendingStage = withFinalizationTimeout({
				promise: new Promise<never>(() => {}),
				stage: "audio processing",
				workload: "audio",
				effectiveDurationSec: 1_200,
				progressAware: true,
				onWatchdogChanged: (nextWatchdog) => {
					watchdog = nextWatchdog;
				},
			});
			const rejection = pendingStage.then(
				() => null,
				(error) => (error instanceof Error ? error.message : String(error)),
			);

			await vi.advanceTimersByTimeAsync(idleTimeoutMs - 1_000);
			expect(watchdog).not.toBeNull();

			watchdog?.refreshProgress();
			await vi.advanceTimersByTimeAsync(idleTimeoutMs - 1_000);

			const pendingSentinel = Symbol("pending");
			await expect(Promise.race([rejection, Promise.resolve(pendingSentinel)])).resolves.toBe(
				pendingSentinel,
			);

			await vi.advanceTimersByTimeAsync(1_001);
			await expect(rejection).resolves.toContain("without observable progress");
		} finally {
			vi.useRealTimers();
		}
	});
});
