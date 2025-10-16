

import { useEffect, useRef, useState } from "react";

export default function VideoEditor() {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isSeeking = useRef(false);

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

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let animationId: number;
    function drawFrame() {
      if (!video || !canvas || video.paused || video.ended) return;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      animationId = requestAnimationFrame(drawFrame);
    }
    const handlePlay = () => drawFrame();
    const handlePause = () => cancelAnimationFrame(animationId);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handlePause);
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handlePause);
      cancelAnimationFrame(animationId);
    };
  }, [videoPath]);

  function togglePlayPause() {
    if (!videoRef.current) return;
    isPlaying ? videoRef.current.pause() : videoRef.current.play();
  }
  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    if (!videoRef.current) return;
    const newTime = parseFloat(e.target.value);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }
  function handleSeekStart() {
    isSeeking.current = true;
  }
  function handleSeekEnd() {
    isSeeking.current = false;
  }
  function formatTime(seconds: number) {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      <div className="flex flex-col flex-[7] min-w-0 gap-8">
        <div className="flex flex-col gap-6 flex-1">
          <div 
            className="w-full aspect-video rounded-xl p-8 flex items-center justify-center overflow-hidden bg-cover bg-center"
            style={{ backgroundImage: 'url(/wallpaper.png)' }}
          >
            {videoPath && (
              <>
                <canvas
                  ref={canvasRef}
                  className="w-full h-full object-contain rounded-lg"
                />
                <video
                  ref={videoRef}
                  src={videoPath}
                  className="hidden"
                  preload="metadata"
                  onLoadedMetadata={e => {
                    const { duration } = e.currentTarget;
                    if (isFinite(duration) && duration > 0) setDuration(duration);
                  }}
                  onDurationChange={e => {
                    const { duration } = e.currentTarget;
                    if (isFinite(duration) && duration > 0) setDuration(duration);
                  }}
                  onTimeUpdate={e => {
                    const time = e.currentTarget.currentTime;
                    if (isFinite(time) && !isSeeking.current) setCurrentTime(time);
                  }}
                  onError={() => setError('Failed to load video')}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
              </>
            )}
          </div>

          <div className="flex items-center gap-4 px-4">
            <button
              onClick={togglePlayPause}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-md"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <span className="text-xs text-muted-foreground font-mono tabular-nums min-w-[50px]">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              onMouseDown={handleSeekStart}
              onMouseUp={handleSeekEnd}
              onTouchStart={handleSeekStart}
              onTouchEnd={handleSeekEnd}
              step="0.01"
              className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:shadow-sm hover:[&::-webkit-slider-thumb]:scale-125"
              style={{
                background: `linear-gradient(to right, rgb(59 130 246) 0%, rgb(59 130 246) ${(currentTime / (duration || 100)) * 100}%, rgb(229 231 235) ${(currentTime / (duration || 100)) * 100}%, rgb(229 231 235) 100%)`
              }}
            />
            <span className="text-xs text-muted-foreground font-mono tabular-nums min-w-[50px] text-right">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 flex-1 min-h-[180px] flex flex-col justify-center shadow-sm">
          <div className="h-12 bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm">
            Timeline/Editor controls coming soon...
          </div>
        </div>
      </div>

      <div className="flex-[3] min-w-0 bg-card border border-border rounded-xl p-8 flex flex-col shadow-sm">
        <div className="w-full h-10 bg-muted rounded-lg mb-6" />
        <div className="flex-1 w-full flex items-center justify-center text-muted-foreground text-base">
          Settings panel (coming soon)
        </div>
      </div>
    </div>
  );
}