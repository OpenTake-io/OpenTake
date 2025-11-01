

import { useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";

import VideoPlayback, { VideoPlaybackRef } from "./VideoPlayback";
import PlaybackControls from "./PlaybackControls";
import TimelineEditor from "./timeline/TimelineEditor";
import SettingsPanel from "./SettingsPanel";

const WALLPAPER_COUNT = 12;
const WALLPAPER_PATHS = Array.from({ length: WALLPAPER_COUNT }, (_, i) => `/wallpapers/wallpaper${i + 1}.jpg`);

export default function VideoEditor() {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [wallpaper, setWallpaper] = useState<string>(WALLPAPER_PATHS[0]);

  const videoPlaybackRef = useRef<VideoPlaybackRef>(null);

  useEffect(() => {
    async function loadVideo() {
      try {
        const result = await window.electronAPI.getRecordedVideoPath();
        if (result.success && result.path) {
          setVideoPath(`file://${result.path}`);
        } else {
          setError(result.message || 'Failed to load video');
        }
      } catch (err) {
        setError('Error loading video: ' + String(err));
      } finally {
        setLoading(false);
      }
    }
    loadVideo();
  }, []);

  function togglePlayPause() {
    const video = videoPlaybackRef.current?.video;
    if (!video) return;
    isPlaying ? video.pause() : video.play();
  }

  function handleSeek(time: number) {
    const video = videoPlaybackRef.current?.video;
    if (!video) return;
    video.currentTime = time;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-foreground">Loading video...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background p-8 gap-8">
      <Toaster position="top-center" />
      <div className="flex flex-col flex-[7] min-w-0 gap-8">
        <div className="flex flex-col gap-6 flex-1">
          {videoPath && (
            <>
              <div className="flex justify-center w-full">
                <VideoPlayback
                  ref={videoPlaybackRef}
                  videoPath={videoPath}
                  onDurationChange={setDuration}
                  onTimeUpdate={setCurrentTime}
                  onPlayStateChange={setIsPlaying}
                  onError={setError}
                  wallpaper={wallpaper}
                />
              </div>
              <PlaybackControls
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                onTogglePlayPause={togglePlayPause}
                onSeek={handleSeek}
              />
            </>
          )}
        </div>
        <TimelineEditor videoDuration={duration} currentTime={currentTime} onSeek={handleSeek} />
      </div>
      <SettingsPanel selected={wallpaper} onWallpaperChange={setWallpaper} />
    </div>
  );
}