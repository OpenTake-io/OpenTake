import React, { useCallback, useMemo, useState } from "react";
import type { SourceAudioTrackSettings } from "../types";

export type SourceAudioTrackMeta = Array<{ id: string; label: string }>;

interface UseSourceAudioTrackSettingsParams {
  selectedClipId: string | null;
  activeClipId: string | null;
  sourceAudioTrackSettingsByClip: Record<string, SourceAudioTrackSettings>;
  setSourceAudioTrackSettingsByClip: React.Dispatch<
    React.SetStateAction<Record<string, SourceAudioTrackSettings>>
  >;
  defaultSourceAudioTrackSettings: SourceAudioTrackSettings;
  setDefaultSourceAudioTrackSettings: React.Dispatch<React.SetStateAction<SourceAudioTrackSettings>>;
}

export interface UseSourceAudioTrackSettingsResult {
  sourceAudioTrackMeta: SourceAudioTrackMeta;
  activeSourceAudioTrackSettings: SourceAudioTrackSettings;
  selectedClipSourceAudioTrackSettings: SourceAudioTrackSettings;
  getSourceAudioTrackSettingsForClip: (clipId: string | null) => SourceAudioTrackSettings;
  onSourceAudioTracksMetaChange: (tracks: SourceAudioTrackMeta) => void;
  onSelectedClipSourceAudioTrackVolumeChange: (id: string, volume: number) => void;
  onSelectedClipSourceAudioTrackNormalizeChange: (id: string, normalize: boolean) => void;
}

export function useSourceAudioTrackSettings({
  selectedClipId,
  activeClipId,
  sourceAudioTrackSettingsByClip,
  setSourceAudioTrackSettingsByClip,
  defaultSourceAudioTrackSettings,
  setDefaultSourceAudioTrackSettings,
}: UseSourceAudioTrackSettingsParams): UseSourceAudioTrackSettingsResult {
  const [sourceAudioTrackMeta, setSourceAudioTrackMeta] = useState<SourceAudioTrackMeta>([]);

  const activeSourceAudioTrackSettings = useMemo(() => {
    if (!activeClipId) {
      return defaultSourceAudioTrackSettings;
    }
    return {
      ...defaultSourceAudioTrackSettings,
      ...(sourceAudioTrackSettingsByClip[activeClipId] ?? {}),
    };
  }, [activeClipId, defaultSourceAudioTrackSettings, sourceAudioTrackSettingsByClip]);

  const selectedClipSourceAudioTrackSettings = useMemo(() => {
    if (!selectedClipId) {
      return defaultSourceAudioTrackSettings;
    }
    return {
      ...defaultSourceAudioTrackSettings,
      ...(sourceAudioTrackSettingsByClip[selectedClipId] ?? {}),
    };
  }, [defaultSourceAudioTrackSettings, selectedClipId, sourceAudioTrackSettingsByClip]);

  const onSourceAudioTracksMetaChange = useCallback((tracks: SourceAudioTrackMeta) => {
    setSourceAudioTrackMeta(tracks);
    setDefaultSourceAudioTrackSettings((prev) => {
      const next: SourceAudioTrackSettings = {};
      for (const track of tracks) {
        next[track.id] = prev[track.id] ?? { volume: 1, normalize: false };
      }
      return next;
    });
  }, []);

  const getSourceAudioTrackSettingsForClip = useCallback(
    (clipId: string | null): SourceAudioTrackSettings => {
      if (!clipId) {
        return defaultSourceAudioTrackSettings;
      }
      return {
        ...defaultSourceAudioTrackSettings,
        ...(sourceAudioTrackSettingsByClip[clipId] ?? {}),
      };
    },
    [defaultSourceAudioTrackSettings, sourceAudioTrackSettingsByClip],
  );

  const onSelectedClipSourceAudioTrackVolumeChange = useCallback(
    (id: string, volume: number) => {
      if (!selectedClipId) return;
      setSourceAudioTrackSettingsByClip((prev) => {
        const prevClip = prev[selectedClipId] ?? defaultSourceAudioTrackSettings;
        return {
          ...prev,
          [selectedClipId]: {
            ...prevClip,
            [id]: {
              volume: Math.max(0, Math.min(2, volume)),
              normalize: prevClip[id]?.normalize ?? false,
            },
          },
        };
      });
    },
    [defaultSourceAudioTrackSettings, selectedClipId],
  );

  const onSelectedClipSourceAudioTrackNormalizeChange = useCallback(
    (id: string, normalize: boolean) => {
      if (!selectedClipId) return;
      setSourceAudioTrackSettingsByClip((prev) => {
        const prevClip = prev[selectedClipId] ?? defaultSourceAudioTrackSettings;
        return {
          ...prev,
          [selectedClipId]: {
            ...prevClip,
            [id]: {
              volume: prevClip[id]?.volume ?? 1,
              normalize,
            },
          },
        };
      });
    },
    [defaultSourceAudioTrackSettings, selectedClipId],
  );

  return {
    sourceAudioTrackMeta,
    activeSourceAudioTrackSettings,
    selectedClipSourceAudioTrackSettings,
    getSourceAudioTrackSettingsForClip,
    onSourceAudioTracksMetaChange,
    onSelectedClipSourceAudioTrackVolumeChange,
    onSelectedClipSourceAudioTrackNormalizeChange,
  };
}
