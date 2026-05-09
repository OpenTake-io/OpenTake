import { useCallback, useMemo, useState } from "react";

export type SourceAudioTrackSetting = { volume: number; normalize: boolean };
export type SourceAudioTrackSettings = Record<string, SourceAudioTrackSetting>;
export type SourceAudioTrackMeta = Array<{ id: string; label: string }>;

interface UseSourceAudioTrackSettingsParams {
  selectedClipId: string | null;
  activeClipId: string | null;
}

export interface UseSourceAudioTrackSettingsResult {
  sourceAudioTrackMeta: SourceAudioTrackMeta;
  activeSourceAudioTrackSettings: SourceAudioTrackSettings;
  selectedClipSourceAudioTrackSettings: SourceAudioTrackSettings;
  onSourceAudioTracksMetaChange: (tracks: SourceAudioTrackMeta) => void;
  onSelectedClipSourceAudioTrackVolumeChange: (id: string, volume: number) => void;
  onSelectedClipSourceAudioTrackNormalizeChange: (id: string, normalize: boolean) => void;
}

export function useSourceAudioTrackSettings({
  selectedClipId,
  activeClipId,
}: UseSourceAudioTrackSettingsParams): UseSourceAudioTrackSettingsResult {
  const [sourceAudioTrackMeta, setSourceAudioTrackMeta] = useState<SourceAudioTrackMeta>([]);
  const [sourceAudioTrackSettingsByClip, setSourceAudioTrackSettingsByClip] = useState<
    Record<string, SourceAudioTrackSettings>
  >({});
  const [defaultSourceAudioTrackSettings, setDefaultSourceAudioTrackSettings] = useState<
    SourceAudioTrackSettings
  >({});

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
    onSourceAudioTracksMetaChange,
    onSelectedClipSourceAudioTrackVolumeChange,
    onSelectedClipSourceAudioTrackNormalizeChange,
  };
}
