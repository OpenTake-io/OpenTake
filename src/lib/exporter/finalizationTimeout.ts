export type FinalizationTimeoutWorkload = "default" | "audio";

const BASE_FINALIZATION_TIMEOUT_MS = 10 * 60_000;
const AUDIO_TIMEOUT_HEADROOM_PER_OUTPUT_SECOND_MS = 500;
const MAX_AUDIO_FINALIZATION_TIMEOUT_MS = 45 * 60_000;

export function getExportFinalizationTimeoutMs({
	effectiveDurationSec,
	workload = "default",
}: {
	effectiveDurationSec?: number | null;
	workload?: FinalizationTimeoutWorkload;
}): number {
	if (workload !== "audio") {
		return BASE_FINALIZATION_TIMEOUT_MS;
	}

	if (!Number.isFinite(effectiveDurationSec) || (effectiveDurationSec ?? 0) <= 0) {
		return BASE_FINALIZATION_TIMEOUT_MS;
	}

	// Audio finalization work scales with the output timeline, so long exports need
	// more headroom without making unrelated finalization hangs wait longer.
	const safeEffectiveDurationSec = Math.max(0, effectiveDurationSec ?? 0);
	const adaptiveTimeoutMs =
		BASE_FINALIZATION_TIMEOUT_MS +
		safeEffectiveDurationSec * AUDIO_TIMEOUT_HEADROOM_PER_OUTPUT_SECOND_MS;

	return Math.min(adaptiveTimeoutMs, MAX_AUDIO_FINALIZATION_TIMEOUT_MS);
}
