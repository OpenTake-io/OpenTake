export const SOURCE_AUDIO_FALLBACK_TOAST_ID = "source-audio-fallback-error";
export const SOURCE_AUDIO_NORMALIZE_GAIN = 1.35;

export function getSourceTrackIdFromPath(audioPath: string): "mic" | "system" | "mixed" {
  const normalized = audioPath.toLowerCase();
  if (normalized.includes(".mic.")) return "mic";
  if (normalized.includes(".system.")) return "system";
  return "mixed";
}
