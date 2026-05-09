import { useEffect, useRef } from "react";
import { resolveMediaElementSource } from "@/lib/exporter/localMediaSource";
import {
  clampMediaTimeToDuration,
  enablePitchPreservingPlayback,
  estimateCompanionAudioStartDelaySeconds,
  getMediaSyncPlaybackRate,
} from "@/lib/mediaTiming";
import type { AudioRegion, SpeedRegion } from "../types";

const SOURCE_AUDIO_PREVIEW_PLAYING_SEEK_DRIFT_SECONDS = 0.18;
const SOURCE_AUDIO_PREVIEW_PAUSED_SEEK_DRIFT_SECONDS = 0.01;
const SOURCE_AUDIO_PREVIEW_RATE_TOLERANCE_SECONDS = 0.08;
const SOURCE_AUDIO_PREVIEW_RATE_CORRECTION_WINDOW_SECONDS = 8;
const SOURCE_AUDIO_PREVIEW_MAX_RATE_ADJUSTMENT = 0.015;

interface UseAudioPreviewSyncParams {
  audioRegions: AudioRegion[];
  previewVolume: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  effectiveSpeedRegions: SpeedRegion[];
  previewSourceAudioFallbackPaths: string[];
  sourceAudioFallbackStartDelayMsByPath: Record<string, number>;
  isCurrentClipMuted: boolean;
  getSourceTrackPreviewGain: (audioPath: string) => number;
  onSourceFallbackLoadError: (error: unknown) => void;
}

export function useAudioPreviewSync({
  audioRegions,
  previewVolume,
  isPlaying,
  currentTime,
  duration,
  effectiveSpeedRegions,
  previewSourceAudioFallbackPaths,
  sourceAudioFallbackStartDelayMsByPath,
  isCurrentClipMuted,
  getSourceTrackPreviewGain,
  onSourceFallbackLoadError,
}: UseAudioPreviewSyncParams) {
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioElementRevokersRef = useRef<Map<string, () => void>>(new Map());
  const audioElementResourcesRef = useRef<Map<string, string>>(new Map());
  const sourceAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const sourceAudioElementRevokersRef = useRef<Map<string, () => void>>(new Map());
  const sourceAudioElementResourcesRef = useRef<Map<string, string>>(new Map());
  const lastSourceAudioSyncTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const existing = audioElementsRef.current;
    const currentIds = new Set(audioRegions.map((r) => r.id));

    for (const [id, audio] of existing) {
      if (!currentIds.has(id)) {
        audio.pause();
        audio.src = "";
        audioElementRevokersRef.current.get(id)?.();
        audioElementRevokersRef.current.delete(id);
        audioElementResourcesRef.current.delete(id);
        existing.delete(id);
      }
    }

    for (const region of audioRegions) {
      let audio = existing.get(region.id);
      if (!audio) {
        audio = new Audio();
        audio.preload = "auto";
        existing.set(region.id, audio);
      }

      if (audioElementResourcesRef.current.get(region.id) !== region.audioPath) {
        audio.pause();
        audio.src = "";
        audioElementRevokersRef.current.get(region.id)?.();
        audioElementRevokersRef.current.delete(region.id);
        audioElementResourcesRef.current.set(region.id, region.audioPath);

        void (async () => {
          const resolved = await resolveMediaElementSource(region.audioPath);
          const latestAudio = existing.get(region.id);

          if (
            cancelled ||
            latestAudio !== audio ||
            audioElementResourcesRef.current.get(region.id) !== region.audioPath
          ) {
            resolved.revoke();
            return;
          }

          audioElementRevokersRef.current.set(region.id, resolved.revoke);
          latestAudio.src = resolved.src;
        })();
      }

      audio.volume = Math.max(0, Math.min(1, region.volume * previewVolume));
    }

    return () => {
      cancelled = true;
    };
  }, [audioRegions, previewVolume]);

  useEffect(() => {
    let cancelled = false;
    const existing = sourceAudioElementsRef.current;
    const currentIds = new Set(previewSourceAudioFallbackPaths);

    for (const [id, audio] of existing) {
      if (!currentIds.has(id)) {
        audio.pause();
        audio.src = "";
        sourceAudioElementRevokersRef.current.get(id)?.();
        sourceAudioElementRevokersRef.current.delete(id);
        sourceAudioElementResourcesRef.current.delete(id);
        existing.delete(id);
      }
    }

    for (const audioPath of previewSourceAudioFallbackPaths) {
      let audio = existing.get(audioPath);
      if (!audio) {
        audio = new Audio();
        audio.preload = "auto";
        existing.set(audioPath, audio);
      }
      audio.dataset.sourceAudioPath = audioPath;

      if (sourceAudioElementResourcesRef.current.get(audioPath) !== audioPath) {
        audio.pause();
        audio.src = "";
        sourceAudioElementRevokersRef.current.get(audioPath)?.();
        sourceAudioElementRevokersRef.current.delete(audioPath);
        sourceAudioElementResourcesRef.current.set(audioPath, audioPath);

        void (async () => {
          try {
            const resolved = await resolveMediaElementSource(audioPath);
            const latestAudio = existing.get(audioPath);

            if (
              cancelled ||
              latestAudio !== audio ||
              sourceAudioElementResourcesRef.current.get(audioPath) !== audioPath
            ) {
              resolved.revoke();
              return;
            }

            sourceAudioElementRevokersRef.current.set(audioPath, resolved.revoke);
            latestAudio.src = resolved.src;
          } catch (error) {
            if (cancelled) {
              return;
            }

            sourceAudioElementRevokersRef.current.get(audioPath)?.();
            sourceAudioElementRevokersRef.current.delete(audioPath);
            sourceAudioElementResourcesRef.current.delete(audioPath);
            const latestAudio = existing.get(audioPath);
            if (latestAudio === audio) {
              latestAudio.pause();
              latestAudio.src = "";
            }
            onSourceFallbackLoadError(error);
          }
        })();
      }

      audio.volume = isCurrentClipMuted
        ? 0
        : Math.max(0, Math.min(1, previewVolume * getSourceTrackPreviewGain(audioPath)));
    }

    if (previewSourceAudioFallbackPaths.length === 0) {
      lastSourceAudioSyncTimeRef.current = null;
    }

    return () => {
      cancelled = true;
    };
  }, [
    getSourceTrackPreviewGain,
    isCurrentClipMuted,
    onSourceFallbackLoadError,
    previewSourceAudioFallbackPaths,
    previewVolume,
  ]);

  useEffect(() => {
    return () => {
      for (const audio of audioElementsRef.current.values()) {
        audio.pause();
        audio.src = "";
      }
      for (const revoke of audioElementRevokersRef.current.values()) {
        revoke();
      }
      audioElementsRef.current.clear();
      audioElementRevokersRef.current.clear();
      audioElementResourcesRef.current.clear();
      for (const audio of sourceAudioElementsRef.current.values()) {
        audio.pause();
        audio.src = "";
      }
      for (const revoke of sourceAudioElementRevokersRef.current.values()) {
        revoke();
      }
      sourceAudioElementsRef.current.clear();
      sourceAudioElementRevokersRef.current.clear();
      sourceAudioElementResourcesRef.current.clear();
      lastSourceAudioSyncTimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const currentTimeMs = currentTime * 1000;
    const activeSpeedRegion = effectiveSpeedRegions.find(
      (region) => currentTimeMs >= region.startMs && currentTimeMs < region.endMs,
    );
    const targetPlaybackRate = activeSpeedRegion ? activeSpeedRegion.speed : 1;

    for (const region of audioRegions) {
      const audio = audioElementsRef.current.get(region.id);
      if (!audio) continue;

      const isInRegion = currentTimeMs >= region.startMs && currentTimeMs < region.endMs;

      if (isPlaying && isInRegion) {
        enablePitchPreservingPlayback(audio);
        const audioOffset = (currentTimeMs - region.startMs) / 1000;
        if (Math.abs(audio.currentTime - audioOffset) > 0.2) {
          audio.currentTime = audioOffset;
        }
        const syncedPlaybackRate = getMediaSyncPlaybackRate({
          basePlaybackRate: targetPlaybackRate,
          currentTime: audio.currentTime,
          targetTime: audioOffset,
        });
        if (Math.abs(audio.playbackRate - syncedPlaybackRate) > 0.001) {
          audio.playbackRate = syncedPlaybackRate;
        }
        if (audio.paused) {
          audio.play().catch(() => undefined);
        }
      } else if (!audio.paused) {
        audio.pause();
      }
    }
  }, [audioRegions, currentTime, effectiveSpeedRegions, isPlaying]);

  useEffect(() => {
    if (previewSourceAudioFallbackPaths.length === 0) {
      lastSourceAudioSyncTimeRef.current = null;
      return;
    }

    const activeSpeedRegion = effectiveSpeedRegions.find(
      (region) => currentTime * 1000 >= region.startMs && currentTime * 1000 < region.endMs,
    );
    const targetPlaybackRate = activeSpeedRegion ? activeSpeedRegion.speed : 1;
    const previousTimelineTime = lastSourceAudioSyncTimeRef.current;
    const timelineJumped =
      previousTimelineTime === null || Math.abs(currentTime - previousTimelineTime) > 0.25;
    const driftThreshold = isPlaying
      ? SOURCE_AUDIO_PREVIEW_PLAYING_SEEK_DRIFT_SECONDS
      : SOURCE_AUDIO_PREVIEW_PAUSED_SEEK_DRIFT_SECONDS;

    for (const audio of sourceAudioElementsRef.current.values()) {
      enablePitchPreservingPlayback(audio);
      const audioDuration = Number.isFinite(audio.duration) ? audio.duration : null;
      const startDelaySeconds = estimateCompanionAudioStartDelaySeconds(
        duration,
        audioDuration,
        sourceAudioFallbackStartDelayMsByPath[audio.dataset.sourceAudioPath ?? ""],
      );
      const beforeAudioStart = currentTime + 0.001 < startDelaySeconds;
      const targetTime = clampMediaTimeToDuration(currentTime - startDelaySeconds, audioDuration);

      if (timelineJumped || Math.abs(audio.currentTime - targetTime) > driftThreshold) {
        try {
          audio.currentTime = targetTime;
        } catch {
          // no-op
        }
      }

      const syncedPlaybackRate = getMediaSyncPlaybackRate({
        basePlaybackRate: targetPlaybackRate,
        currentTime: audio.currentTime,
        targetTime,
        toleranceSeconds: SOURCE_AUDIO_PREVIEW_RATE_TOLERANCE_SECONDS,
        correctionWindowSeconds: SOURCE_AUDIO_PREVIEW_RATE_CORRECTION_WINDOW_SECONDS,
        maxAdjustment: SOURCE_AUDIO_PREVIEW_MAX_RATE_ADJUSTMENT,
      });
      if (Math.abs(audio.playbackRate - syncedPlaybackRate) > 0.001) {
        audio.playbackRate = syncedPlaybackRate;
      }

      const atEnd = audioDuration !== null && targetTime >= audioDuration;
      if (isPlaying && !beforeAudioStart && !atEnd) {
        audio.play().catch(() => undefined);
      } else if (!audio.paused) {
        audio.pause();
      }
    }

    lastSourceAudioSyncTimeRef.current = currentTime;
  }, [
    currentTime,
    duration,
    effectiveSpeedRegions,
    isPlaying,
    previewSourceAudioFallbackPaths,
    sourceAudioFallbackStartDelayMsByPath,
  ]);
}
