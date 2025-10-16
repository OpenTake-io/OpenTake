
import { useEffect, useRef, useState } from "react";

export default function VideoEditor() {
  // --- State ---
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- Load video path on mount ---
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

  // --- Canvas drawing and video event listeners ---
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    let animationId: number;

    function drawFrame() {
      if (!video || !canvas) return;
      if (video.paused || video.ended) return;
      // Keep canvas size in sync with video
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

    function handlePlay() {
      drawFrame();
    }
    function handlePause() {
      cancelAnimationFrame(animationId);
    }

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

  // --- Handlers ---
  function togglePlayPause() {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    if (!videoRef.current) return;
    const newTime = parseFloat(e.target.value);
    videoRef.current.currentTime = newTime;
  }

  function formatTime(seconds: number) {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // --- Early returns for loading/error ---
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

  // --- Main render ---
  return (
    <div className="flex h-screen bg-background p-6 gap-6">
      <div className="flex flex-col flex-[7] min-w-0 h-full">
        <div className="flex flex-col h-full justify-center overflow-hidden relative bg-black/5 rounded-lg p-4" style={{ flex: '0 0 60%' }}>
          {videoPath && (
            <>
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full"
                style={{ 
                  borderRadius: 8,
                  objectFit: 'contain',
                  width: 'auto',
                  height: 'auto',
                  maxHeight: '80%',
                  maxWidth: '90%'
                }}
              />
              <video
                ref={videoRef}
                src={videoPath}
                style={{ display: 'none' }}
                preload="metadata"
                onLoadedMetadata={e => {
                  const video = e.currentTarget;
                  if (isFinite(video.duration) && !isNaN(video.duration) && video.duration > 0) {
                    setDuration(video.duration);
                  }
                }}
                onCanPlay={() => {
                  const video = videoRef.current;
                  if (video && isFinite(video.duration) && video.duration > 0) {
                    setDuration(video.duration);
                  }
                }}
                onTimeUpdate={e => {
                  const time = e.currentTarget.currentTime;
                  if (isFinite(time) && !isNaN(time)) {
                    setCurrentTime(time);
                  }
                }}
                onError={() => setError('Failed to play video')}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            </>
          )}
          <div className="mt-4 bg-card border border-border rounded-lg p-4 flex items-center gap-4">
            <button
              onClick={togglePlayPause}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="4" y="3" width="3" height="10" rx="0.5" />
                  <rect x="9" y="3" width="3" height="10" rx="0.5" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5 3.5v9l7-4.5z" />
                </svg>
              )}
            </button>
            <span className="text-sm text-muted-foreground font-mono min-w-[80px]">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              step="0.01"
              className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-primary/80"
            />
            <span className="text-sm text-muted-foreground font-mono min-w-[80px] text-right">
              {formatTime(duration)}
            </span>
          </div>
        </div>
        <div className="mt-6 bg-card border border-border rounded-lg p-4 min-h-[100px] flex flex-col justify-center" style={{ flex: '1 1 0', minHeight: 0 }}>
          <div className="h-8 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
            Timeline/Editor controls coming soon...
          </div>
        </div>
      </div>
      <div className="flex-[3] min-w-0 bg-white border border-border rounded-lg p-6 flex flex-col items-center justify-start">
        <div className="w-full h-8 bg-muted rounded mb-4" />
        <div className="flex-1 w-full flex items-center justify-center text-muted-foreground text-lg">
          Settings panel (coming soon)
        </div>
      </div>
    </div>
  );
}