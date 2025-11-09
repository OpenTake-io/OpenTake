interface VideoEventHandlersParams {
  video: HTMLVideoElement;
  isSeekingRef: React.MutableRefObject<boolean>;
  isPlayingRef: React.MutableRefObject<boolean>;
  allowPlaybackRef: React.MutableRefObject<boolean>;
  currentTimeRef: React.MutableRefObject<number>;
  timeUpdateAnimationRef: React.MutableRefObject<number | null>;
  onPlayStateChange: (playing: boolean) => void;
  onTimeUpdate: (time: number) => void;
}

export function createVideoEventHandlers(params: VideoEventHandlersParams) {
  const {
    video,
    isSeekingRef,
    isPlayingRef,
    allowPlaybackRef,
    currentTimeRef,
    timeUpdateAnimationRef,
    onPlayStateChange,
    onTimeUpdate,
  } = params;

  const emitTime = (timeValue: number) => {
    currentTimeRef.current = timeValue * 1000;
    onTimeUpdate(timeValue);
  };

  function updateTime() {
    if (!video) return;
    emitTime(video.currentTime);
    if (!video.paused && !video.ended) {
      timeUpdateAnimationRef.current = requestAnimationFrame(updateTime);
    }
  }

  const handlePlay = () => {
    // Prevent autoplay during seek operations
    if (isSeekingRef.current) {
      video.pause();
      return;
    }

    if (!allowPlaybackRef.current) {
      video.pause();
      return;
    }

    allowPlaybackRef.current = false;
    isPlayingRef.current = true;
    onPlayStateChange(true);
    updateTime();
  };

  const handlePause = () => {
    allowPlaybackRef.current = false;
    isPlayingRef.current = false;
    if (timeUpdateAnimationRef.current) {
      cancelAnimationFrame(timeUpdateAnimationRef.current);
      timeUpdateAnimationRef.current = null;
    }
    emitTime(video.currentTime);
    onPlayStateChange(false);
  };

  const handleSeeked = () => {
    isSeekingRef.current = false;

    // Keep video paused after seek if it wasn't playing
    if (!isPlayingRef.current && !video.paused) {
      video.pause();
    }
    emitTime(video.currentTime);
  };

  const handleSeeking = () => {
    isSeekingRef.current = true;

    // Prevent autoplay during seek if video was paused
    if (!isPlayingRef.current && !video.paused) {
      video.pause();
    }
    emitTime(video.currentTime);
  };

  return {
    handlePlay,
    handlePause,
    handleSeeked,
    handleSeeking,
  };
}
