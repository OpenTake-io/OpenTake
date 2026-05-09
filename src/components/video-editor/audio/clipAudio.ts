import { mapSourceTimeToTimelineTime } from "../types";
import type { ClipRegion } from "../types";

export function getActiveClipIdAtSourceTime(
  sourceTimeSeconds: number,
  clipRegions: ClipRegion[],
): string | null {
  const sourceMs = sourceTimeSeconds * 1000;
  const timelineMs = mapSourceTimeToTimelineTime(sourceMs, clipRegions);
  const activeClip = clipRegions.find(
    (clip) => timelineMs >= clip.startMs && timelineMs < clip.endMs,
  );
  return activeClip?.id ?? null;
}

export function isClipMutedById(clipId: string | null, clipRegions: ClipRegion[]): boolean {
  if (!clipId) return false;
  return clipRegions.find((clip) => clip.id === clipId)?.muted ?? false;
}
