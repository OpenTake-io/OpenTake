import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import * as PIXI from 'pixi.js';

interface VideoPlaybackProps {
  videoPath: string;
  onDurationChange: (duration: number) => void;
  onTimeUpdate: (time: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onError: (error: string) => void;
  wallpaper?: string;
}

export interface VideoPlaybackRef {
  video: HTMLVideoElement | null;
  app: PIXI.Application | null;
  videoSprite: PIXI.Sprite | null;
  videoContainer: PIXI.Container | null;
}

const VideoPlayback = forwardRef<VideoPlaybackRef, VideoPlaybackProps>(({
  videoPath,
  onDurationChange,
  onTimeUpdate,
  onPlayStateChange,
  onError,
  wallpaper,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const videoSpriteRef = useRef<PIXI.Sprite | null>(null);
  const videoContainerRef = useRef<PIXI.Container | null>(null);
  const timeUpdateAnimationRef = useRef<number | null>(null);
  const [pixiReady, setPixiReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useImperativeHandle(ref, () => ({
    video: videoRef.current,
    app: appRef.current,
    videoSprite: videoSpriteRef.current,
    videoContainer: videoContainerRef.current,
  }));

  // Initialize PixiJS application
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
    let app: PIXI.Application | null = null;

    // Initialize the app
    (async () => {
      app = new PIXI.Application();
      
      await app.init({
        width: container.clientWidth,
        height: container.clientHeight,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (!mounted) {
        app.destroy(true, { children: true, texture: true, textureSource: true });
        return;
      }

      appRef.current = app;
      container.appendChild(app.canvas);

      // Create a container for the video (this will hold animations later)
      const videoContainer = new PIXI.Container();
      videoContainerRef.current = videoContainer;
      app.stage.addChild(videoContainer);
      
      setPixiReady(true);
    })();

    // Cleanup
    return () => {
      mounted = false;
      setPixiReady(false);
      if (app && app.renderer) {
        app.destroy(true, { children: true, texture: true, textureSource: true });
      }
      appRef.current = null;
      videoContainerRef.current = null;
      videoSpriteRef.current = null;
    };
  }, []);

  // Ensure video starts paused whenever the source changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  }, [videoPath]);

  // Setup video sprite when both PixiJS and video are ready
  useEffect(() => {
    if (!pixiReady || !videoReady) return;

    const video = videoRef.current;
    const app = appRef.current;
    const videoContainer = videoContainerRef.current;
    
    if (!video || !app || !videoContainer) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    
    // Create texture from video element
    const source = PIXI.VideoSource.from(video);
    const videoTexture = PIXI.Texture.from(source);
    
    // Create sprite with the video texture
    const videoSprite = new PIXI.Sprite(videoTexture);
    videoSpriteRef.current = videoSprite;
    
    // Create rounded rectangle mask
    const maskGraphics = new PIXI.Graphics();
    
    videoContainer.addChild(videoSprite);
    videoContainer.addChild(maskGraphics);
    videoSprite.mask = maskGraphics;
    
    // Position and scale video
    const containerWidth = app.canvas.width / app.renderer.resolution;
    const containerHeight = app.canvas.height / app.renderer.resolution;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    const scale = Math.min(
      containerWidth / videoWidth,
      containerHeight / videoHeight
    );
    
    videoSprite.width = videoWidth * scale;
    videoSprite.height = videoHeight * scale;
    videoSprite.x = (containerWidth - videoSprite.width) / 2;
    videoSprite.y = (containerHeight - videoSprite.height) / 2;
    
    // Draw rounded mask
    const radius = Math.min(videoSprite.width, videoSprite.height) * 0.02;
    maskGraphics.roundRect(
      videoSprite.x,
      videoSprite.y,
      videoSprite.width,
      videoSprite.height,
      radius
    );
    maskGraphics.fill({ color: 0xffffff });
    
  // Ensure Pixi does not trigger autoplay
  video.pause();

    function updateTime() {
      if (!video) return;
      onTimeUpdate(video.currentTime);
      if (!video.paused && !video.ended) {
        timeUpdateAnimationRef.current = requestAnimationFrame(updateTime);
      }
    }
    
    const handlePlay = () => {
      updateTime();
    };
    
    const handlePause = () => {
      if (timeUpdateAnimationRef.current) {
        cancelAnimationFrame(timeUpdateAnimationRef.current);
        timeUpdateAnimationRef.current = null;
      }
      onTimeUpdate(video.currentTime);
    };
    
    const handleSeeked = () => {
      onTimeUpdate(video.currentTime);
    };
    
    const handleSeeking = () => {
      onTimeUpdate(video.currentTime);
    };
    
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handlePause);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('seeking', handleSeeking);
    
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handlePause);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('seeking', handleSeeking);
      
      if (timeUpdateAnimationRef.current) {
        cancelAnimationFrame(timeUpdateAnimationRef.current);
      }
      
      // Clean up PixiJS resources
      if (videoSprite) {
        videoContainer.removeChild(videoSprite);
        videoSprite.destroy();
      }
      if (maskGraphics) {
        videoContainer.removeChild(maskGraphics);
        maskGraphics.destroy();
      }
      videoTexture.destroy(true);
      
      videoSpriteRef.current = null;
    };
  }, [pixiReady, videoReady, onTimeUpdate]);

  // Handle video metadata loaded
  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    onDurationChange(video.duration);
    video.currentTime = 0;
    video.pause();
    setVideoReady(true);
  };

  const isImageUrl = wallpaper?.startsWith('/wallpapers/') || wallpaper?.startsWith('http');
  const backgroundStyle = isImageUrl 
    ? { backgroundImage: `url(${wallpaper || '/wallpapers/wallpaper1.jpg'})` }
    : { background: wallpaper || '/wallpapers/wallpaper1.jpg' };

  return (
    <div
      className="aspect-video rounded-sm p-12 flex items-center justify-center overflow-hidden bg-cover bg-center"
      style={{ ...backgroundStyle, width: '90%' }}
    >
      <div 
        ref={containerRef}
        className="w-full h-full"
        style={{ position: 'relative' }}
      />
      <video
        ref={videoRef}
        src={videoPath}
        className="hidden"
        preload="metadata"
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={e => {
          onDurationChange(e.currentTarget.duration);
        }}
        onError={() => onError('Failed to load video')}
        onPlay={() => onPlayStateChange(true)}
        onPause={() => onPlayStateChange(false)}
        onEnded={() => onPlayStateChange(false)}
      />
    </div>
  );
});

VideoPlayback.displayName = 'VideoPlayback';

export default VideoPlayback;
