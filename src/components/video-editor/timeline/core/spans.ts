import type { Span } from "dnd-timeline";

export function spansOverlap(left: Span, right: Span) {
	return left.end > right.start && left.start < right.end;
}

export function normalizeRegionSpan(params: {
	startMs: number;
	endMs: number;
	totalMs: number;
	minDurationMs: number;
}) {
	const { startMs, endMs, totalMs, minDurationMs } = params;
	const clampedStart = Math.max(0, Math.min(startMs, totalMs));
	const minEnd = clampedStart + minDurationMs;
	const clampedEnd = Math.min(totalMs, Math.max(minEnd, endMs));
	const normalizedStart = Math.max(0, Math.min(clampedStart, totalMs - minDurationMs));
	const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, totalMs));

	return { start: normalizedStart, end: normalizedEnd };
}
