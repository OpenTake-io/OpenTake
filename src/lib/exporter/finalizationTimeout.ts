export type FinalizationTimeoutWorkload = "default" | "audio";

const BASE_FINALIZATION_TIMEOUT_MS = 10 * 60_000;
const AUDIO_TIMEOUT_HEADROOM_PER_OUTPUT_SECOND_MS = 500;
const MAX_AUDIO_FINALIZATION_TIMEOUT_MS = 45 * 60_000;
const MIN_PROGRESS_IDLE_TIMEOUT_MS = 90_000;
const MAX_PROGRESS_IDLE_TIMEOUT_MS = 5 * 60_000;
const PROGRESS_IDLE_TIMEOUT_FRACTION = 0.25;

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

	const safeEffectiveDurationSec =
		typeof effectiveDurationSec === "number" ? effectiveDurationSec : Number.NaN;
	if (!Number.isFinite(safeEffectiveDurationSec) || safeEffectiveDurationSec <= 0) {
		return BASE_FINALIZATION_TIMEOUT_MS;
	}

	// Audio finalization work scales with the output timeline, so long exports need
	// more headroom without making unrelated finalization hangs wait longer.
	const adaptiveTimeoutMs =
		BASE_FINALIZATION_TIMEOUT_MS +
		safeEffectiveDurationSec * AUDIO_TIMEOUT_HEADROOM_PER_OUTPUT_SECOND_MS;

	return Math.min(adaptiveTimeoutMs, MAX_AUDIO_FINALIZATION_TIMEOUT_MS);
}

export function getExportFinalizationIdleTimeoutMs({
	effectiveDurationSec,
	workload = "default",
}: {
	effectiveDurationSec?: number | null;
	workload?: FinalizationTimeoutWorkload;
}): number {
	const totalTimeoutMs = getExportFinalizationTimeoutMs({
		effectiveDurationSec,
		workload,
	});

	return Math.min(
		Math.max(
			Math.floor(totalTimeoutMs * PROGRESS_IDLE_TIMEOUT_FRACTION),
			MIN_PROGRESS_IDLE_TIMEOUT_MS,
		),
		MAX_PROGRESS_IDLE_TIMEOUT_MS,
	);
}
