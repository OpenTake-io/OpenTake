import { describe, expect, it } from "vitest";

import { getExportFinalizationTimeoutMs } from "./finalizationTimeout";

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
});
