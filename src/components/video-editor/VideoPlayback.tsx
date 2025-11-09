import type React from "react";
import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useMemo, useCallback } from "react";
import * as PIXI from 'pixi.js';
import { ZOOM_DEPTH_SCALES, clampFocusToDepth, type ZoomRegion, type ZoomFocus, type ZoomDepth } from "./types";

const DEFAULT_FOCUS: ZoomFocus = { cx: 0.5, cy: 0.5 };
const TRANSITION_WINDOW_MS = 320;
const SMOOTHING_FACTOR = 0.12;
const MIN_DELTA = 0.0001;
const VIEWPORT_SCALE = 0.8;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smoothStep(t: number) {
  const clamped = clamp01(t);
  return clamped * clamped * (3 - 2 * clamped);
}

function computeRegionStrength(region: ZoomRegion, timeMs: number) {
  const leadInStart = region.startMs - TRANSITION_WINDOW_MS;
  const leadOutEnd = region.endMs + TRANSITION_WINDOW_MS;

  if (timeMs < leadInStart || timeMs > leadOutEnd) {
    return 0;
  }

  const fadeIn = smoothStep((timeMs - leadInStart) / TRANSITION_WINDOW_MS);
  const fadeOut = smoothStep((leadOutEnd - timeMs) / TRANSITION_WINDOW_MS);
  return Math.min(fadeIn, fadeOut);
}

function findDominantRegion(regions: ZoomRegion[], timeMs: number) {
  let bestRegion: ZoomRegion | null = null;
  let bestStrength = 0;

  for (const region of regions) {
    const strength = computeRegionStrength(region, timeMs);
    if (strength > bestStrength) {
      bestStrength = strength;
      bestRegion = region;
    }
  }

  return { region: bestRegion, strength: bestStrength };
}

interface VideoPlaybackProps {
  videoPath: string;
  onDurationChange: (duration: number) => void;
  onTimeUpdate: (time: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  onError: (error: string) => void;
  wallpaper?: string;
  zoomRegions: ZoomRegion[];
  selectedZoomId: string | null;
  onSelectZoom: (id: string | null) => void;
  onZoomFocusChange: (id: string, focus: ZoomFocus) => void;
  isPlaying: boolean;
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
  zoomRegions,
  selectedZoomId,
  onSelectZoom,
  onZoomFocusChange,
  isPlaying,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const videoSpriteRef = useRef<PIXI.Sprite | null>(null);
  const videoContainerRef = useRef<PIXI.Container | null>(null);
  const timeUpdateAnimationRef = useRef<number | null>(null);
  const [pixiReady, setPixiReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const focusIndicatorRef = useRef<HTMLDivElement | null>(null);
  const currentTimeRef = useRef(0);
  const zoomRegionsRef = useRef<ZoomRegion[]>([]);
  const selectedZoomIdRef = useRef<string | null>(null);
  const animationStateRef = useRef({ scale: 1, focusX: DEFAULT_FOCUS.cx, focusY: DEFAULT_FOCUS.cy });
  const blurFilterRef = useRef<PIXI.BlurFilter | null>(null);
  const isDraggingFocusRef = useRef(false);
  const stageSizeRef = useRef({ width: 0, height: 0 });
  const videoSizeRef = useRef({ width: 0, height: 0 });
  const baseScaleRef = useRef(1);
  const baseOffsetRef = useRef({ x: 0, y: 0 });
  const maskGraphicsRef = useRef<PIXI.Graphics | null>(null);
  const isPlayingRef = useRef(isPlaying);

  const clampFocusToStage = useCallback((focus: ZoomFocus, depth: ZoomDepth) => {
    const stageSize = stageSizeRef.current;
    const videoSize = videoSizeRef.current;
    const baseScale = baseScaleRef.current;

    if (!stageSize.width || !stageSize.height || !videoSize.width || !videoSize.height || baseScale <= 0) {
      return clampFocusToDepth(focus, depth);
    }

    const zoomScale = ZOOM_DEPTH_SCALES[depth];
    const indicatorWidth = (videoSize.width / zoomScale) * baseScale;
    const indicatorHeight = (videoSize.height / zoomScale) * baseScale;

    const normalizedWidth = stageSize.width > 0 ? Math.min(1, indicatorWidth / stageSize.width) : 1;
    const normalizedHeight = stageSize.height > 0 ? Math.min(1, indicatorHeight / stageSize.height) : 1;

    const baseFocus = clampFocusToDepth(focus, depth);

    const marginX = normalizedWidth >= 1 ? 0.5 : normalizedWidth / 2;
    const marginY = normalizedHeight >= 1 ? 0.5 : normalizedHeight / 2;

    const minX = marginX;
    const maxX = normalizedWidth >= 1 ? 0.5 : 1 - marginX;
    const minY = marginY;
    const maxY = normalizedHeight >= 1 ? 0.5 : 1 - marginY;

    return {
      cx: Math.min(maxX, Math.max(minX, baseFocus.cx)),
      cy: Math.min(maxY, Math.max(minY, baseFocus.cy)),
    };
  }, []);

  const stageFocusToVideoSpace = useCallback((focus: ZoomFocus): ZoomFocus => {
    const stageSize = stageSizeRef.current;
    const videoSize = videoSizeRef.current;
    const baseScale = baseScaleRef.current;
    const baseOffset = baseOffsetRef.current;

    if (!stageSize.width || !stageSize.height || !videoSize.width || !videoSize.height || baseScale <= 0) {
      return focus;
    }

    const stageX = focus.cx * stageSize.width;
    const stageY = focus.cy * stageSize.height;

    const videoNormX = (stageX - baseOffset.x) / (videoSize.width * baseScale);
    const videoNormY = (stageY - baseOffset.y) / (videoSize.height * baseScale);

    return {
      cx: videoNormX,
      cy: videoNormY,
    };
  }, []);

  const updateOverlayForRegion = useCallback((region: ZoomRegion | null, focusOverride?: ZoomFocus) => {
    const overlayEl = overlayRef.current;
    const indicatorEl = focusIndicatorRef.current;
    if (!overlayEl || !indicatorEl) {
      return;
    }

    if (!region) {
      indicatorEl.style.display = 'none';
      overlayEl.style.pointerEvents = 'none';
      return;
    }

    const stageWidth = overlayEl.clientWidth;
    const stageHeight = overlayEl.clientHeight;
    if (!stageWidth || !stageHeight) {
      indicatorEl.style.display = 'none';
      overlayEl.style.pointerEvents = 'none';
      return;
    }

    stageSizeRef.current = { width: stageWidth, height: stageHeight };

    const baseScale = baseScaleRef.current;
    const videoSize = videoSizeRef.current;

    if (!videoSize.width || !videoSize.height || baseScale <= 0) {
      indicatorEl.style.display = 'none';
      overlayEl.style.pointerEvents = isPlayingRef.current ? 'none' : 'auto';
      return;
    }

    const zoomScale = ZOOM_DEPTH_SCALES[region.depth];
    const focus = clampFocusToStage(focusOverride ?? region.focus, region.depth);

    const indicatorWidth = (videoSize.width / zoomScale) * baseScale;
    const indicatorHeight = (videoSize.height / zoomScale) * baseScale;

    const rawLeft = focus.cx * stageWidth - indicatorWidth / 2;
    const rawTop = focus.cy * stageHeight - indicatorHeight / 2;

    const adjustedLeft = indicatorWidth >= stageWidth
      ? (stageWidth - indicatorWidth) / 2
      : Math.max(0, Math.min(stageWidth - indicatorWidth, rawLeft));

    const adjustedTop = indicatorHeight >= stageHeight
      ? (stageHeight - indicatorHeight) / 2
      : Math.max(0, Math.min(stageHeight - indicatorHeight, rawTop));

    indicatorEl.style.display = 'block';
    indicatorEl.style.width = `${indicatorWidth}px`;
    indicatorEl.style.height = `${indicatorHeight}px`;
    indicatorEl.style.left = `${adjustedLeft}px`;
    indicatorEl.style.top = `${adjustedTop}px`;
    overlayEl.style.pointerEvents = isPlayingRef.current ? 'none' : 'auto';
  }, [clampFocusToStage]);

  const layoutVideoContent = useCallback(() => {
    const container = containerRef.current;
    const app = appRef.current;
    const videoSprite = videoSpriteRef.current;
    const maskGraphics = maskGraphicsRef.current;
    const videoElement = videoRef.current;

    if (!container || !app || !videoSprite || !videoElement) {
      return;
    }

    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    if (!videoWidth || !videoHeight) {
      return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    if (!width || !height) {
      return;
    }

    app.renderer.resize(width, height);
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';

    const maxDisplayWidth = width * VIEWPORT_SCALE;
    const maxDisplayHeight = height * VIEWPORT_SCALE;

    const scale = Math.min(
      maxDisplayWidth / videoWidth,
      maxDisplayHeight / videoHeight,
      1
    );

    videoSprite.scale.set(scale);
    const displayWidth = videoWidth * scale;
    const displayHeight = videoHeight * scale;

    const offsetX = (width - displayWidth) / 2;
    const offsetY = (height - displayHeight) / 2;
    videoSprite.position.set(offsetX, offsetY);

    stageSizeRef.current = { width, height };
    videoSizeRef.current = { width: videoWidth, height: videoHeight };
    baseScaleRef.current = scale;
    baseOffsetRef.current = { x: offsetX, y: offsetY };

    if (maskGraphics) {
      const radius = Math.min(displayWidth, displayHeight) * 0.02;
      maskGraphics.clear();
      maskGraphics.roundRect(offsetX, offsetY, displayWidth, displayHeight, radius);
      maskGraphics.fill({ color: 0xffffff });
    }

    const selectedId = selectedZoomIdRef.current;
    const activeRegion = selectedId
      ? zoomRegionsRef.current.find((region) => region.id === selectedId) ?? null
      : null;

    updateOverlayForRegion(activeRegion);
  }, [updateOverlayForRegion]);

  const selectedZoom = useMemo(() => {
    if (!selectedZoomId) return null;
    return zoomRegions.find((region) => region.id === selectedZoomId) ?? null;
  }, [zoomRegions, selectedZoomId]);

  useImperativeHandle(ref, () => ({
    video: videoRef.current,
    app: appRef.current,
    videoSprite: videoSpriteRef.current,
    videoContainer: videoContainerRef.current,
  }));

  const updateFocusFromClientPoint = (clientX: number, clientY: number) => {
    const overlayEl = overlayRef.current;
    if (!overlayEl) return;

    const regionId = selectedZoomIdRef.current;
    if (!regionId) return;

    const region = zoomRegionsRef.current.find((r) => r.id === regionId);
    if (!region) return;

    const rect = overlayEl.getBoundingClientRect();
    const stageWidth = rect.width;
    const stageHeight = rect.height;

    if (!stageWidth || !stageHeight) {
      return;
    }

    stageSizeRef.current = { width: stageWidth, height: stageHeight };

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    const unclampedFocus: ZoomFocus = {
      cx: clamp01(localX / stageWidth),
      cy: clamp01(localY / stageHeight),
    };
    const clampedFocus = clampFocusToStage(unclampedFocus, region.depth);

    onZoomFocusChange(region.id, clampedFocus);
    updateOverlayForRegion({ ...region, focus: clampedFocus }, clampedFocus);
  };

  const handleOverlayPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isPlayingRef.current) return;
    const regionId = selectedZoomIdRef.current;
    if (!regionId) return;
    const region = zoomRegionsRef.current.find((r) => r.id === regionId);
    if (!region) return;
    onSelectZoom(region.id);
    event.preventDefault();
    isDraggingFocusRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFocusFromClientPoint(event.clientX, event.clientY);
  };

  const handleOverlayPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingFocusRef.current) return;
    event.preventDefault();
    updateFocusFromClientPoint(event.clientX, event.clientY);
  };

  const endFocusDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingFocusRef.current) return;
    isDraggingFocusRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore release errors when pointer capture is already cleared
    }
  };

  const handleOverlayPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    endFocusDrag(event);
  };

  const handleOverlayPointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    endFocusDrag(event);
  };

  useEffect(() => {
    zoomRegionsRef.current = zoomRegions;
  }, [zoomRegions]);

  useEffect(() => {
    selectedZoomIdRef.current = selectedZoomId;
  }, [selectedZoomId]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!pixiReady || !videoReady) return;
    layoutVideoContent();
  }, [pixiReady, videoReady, layoutVideoContent]);

  useEffect(() => {
    if (!pixiReady || !videoReady) return;
    const container = containerRef.current;
    if (!container) return;

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      layoutVideoContent();
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [pixiReady, videoReady, layoutVideoContent]);

  useEffect(() => {
    if (!pixiReady || !videoReady) return;
    updateOverlayForRegion(selectedZoom);
  }, [selectedZoom, pixiReady, videoReady, updateOverlayForRegion]);

  useEffect(() => {
    const overlayEl = overlayRef.current;
    if (!overlayEl) return;
    if (!selectedZoom) {
      overlayEl.style.cursor = 'default';
      overlayEl.style.pointerEvents = 'none';
      return;
    }
    overlayEl.style.cursor = isPlaying ? 'not-allowed' : 'grab';
    overlayEl.style.pointerEvents = isPlaying ? 'none' : 'auto';
  }, [selectedZoom, isPlaying]);

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
    videoContainer.mask = maskGraphics;
    maskGraphicsRef.current = maskGraphics;

    animationStateRef.current = {
      scale: 1,
      focusX: DEFAULT_FOCUS.cx,
      focusY: DEFAULT_FOCUS.cy,
    };

    const blurFilter = new PIXI.BlurFilter();
    blurFilter.quality = 3;
    blurFilter.resolution = app.renderer.resolution;
    blurFilter.blur = 0;
    videoContainer.filters = [blurFilter];
    blurFilterRef.current = blurFilter;
    
    layoutVideoContent();
    
    // Ensure Pixi does not trigger autoplay
    video.pause();

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
      isPlayingRef.current = true;
      onPlayStateChange(true);
      updateTime();
    };
    
    const handlePause = () => {
      isPlayingRef.current = false;
      if (timeUpdateAnimationRef.current) {
        cancelAnimationFrame(timeUpdateAnimationRef.current);
        timeUpdateAnimationRef.current = null;
      }
      emitTime(video.currentTime);
      onPlayStateChange(false);
    };
    
    const handleSeeked = () => {
      emitTime(video.currentTime);
    };
    
    const handleSeeking = () => {
      emitTime(video.currentTime);
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
      videoContainer.mask = null;
      maskGraphicsRef.current = null;
      if (blurFilterRef.current) {
        videoContainer.filters = [];
        blurFilterRef.current.destroy();
        blurFilterRef.current = null;
      }
      videoTexture.destroy(true);
      
      videoSpriteRef.current = null;
    };
  }, [pixiReady, videoReady, onTimeUpdate, updateOverlayForRegion]);

  useEffect(() => {
    if (!pixiReady || !videoReady) return;

    const app = appRef.current;
    const videoSprite = videoSpriteRef.current;
    const videoContainer = videoContainerRef.current;
    if (!app || !videoSprite || !videoContainer) return;

    const applyTransform = (motionIntensity: number) => {
      const stageSize = stageSizeRef.current;
      const videoSize = videoSizeRef.current;
      const baseScale = baseScaleRef.current;
      const baseOffset = baseOffsetRef.current;
      const state = animationStateRef.current;

      if (!stageSize.width || !stageSize.height || !videoSize.width || !videoSize.height || baseScale <= 0) {
        return;
      }

      // Zoom scale determines how much we're zooming in
      // scale=1 means show everything at normal size
      // scale=2 means zoom in 2x (show half the stage, magnified 2x)
      const zoomScale = state.scale;

      // The focus point in stage coordinates (0-1 normalized to actual pixels)
      const focusStagePxX = state.focusX * stageSize.width;
      const focusStagePxY = state.focusY * stageSize.height;

      // When zoomed, we want the focus point to remain at the center of the viewport
      // The stage center in pixels
      const stageCenterX = stageSize.width / 2;
      const stageCenterY = stageSize.height / 2;

      // Calculate the video's new scale and position
      // The video should scale up by the zoom factor
      const actualScale = baseScale * zoomScale;
      videoSprite.scale.set(actualScale);

      // To keep the focus point centered:
      // 1. In the "virtual stage space", the focus is at (focusStagePxX, focusStagePxY)
      // 2. We want this point to appear at the stage center after transformation
      // 3. The video's position offset needs to shift so focus → center
      
      // The video's base position at no zoom
      const baseVideoX = baseOffset.x;
      const baseVideoY = baseOffset.y;

      // The focus point relative to the video's top-left (in stage pixels, no zoom)
      const focusInVideoSpaceX = focusStagePxX - baseVideoX;
      const focusInVideoSpaceY = focusStagePxY - baseVideoY;

      // After scaling the video by zoomScale, the focus point in video would be at:
      // (focusInVideoSpaceX * zoomScale, focusInVideoSpaceY * zoomScale) relative to video's top-left
      
      // We want: videoPosition + focusInVideoSpace * zoomScale = stageCenterX
      // So: videoPosition = stageCenterX - focusInVideoSpace * zoomScale
      const newVideoX = stageCenterX - focusInVideoSpaceX * zoomScale;
      const newVideoY = stageCenterY - focusInVideoSpaceY * zoomScale;

      videoSprite.position.set(newVideoX, newVideoY);

      if (blurFilterRef.current) {
        const shouldBlur = isPlayingRef.current && motionIntensity > 0.0005;
        const motionBlur = shouldBlur ? Math.min(6, motionIntensity * 120) : 0;
        blurFilterRef.current.blur = motionBlur;
      }

      const maskGraphics = maskGraphicsRef.current;
      if (maskGraphics) {
        const videoWidth = videoSize.width * actualScale;
        const videoHeight = videoSize.height * actualScale;
        const radius = Math.min(videoWidth, videoHeight) * 0.02;
        maskGraphics.clear();
        maskGraphics.roundRect(
          newVideoX,
          newVideoY,
          videoWidth,
          videoHeight,
          radius
        );
        maskGraphics.fill({ color: 0xffffff });
      }
    };

    const ticker = () => {
      const { region, strength } = findDominantRegion(zoomRegionsRef.current, currentTimeRef.current);
      
      // Default is to show the entire stage at center
      const defaultFocus = DEFAULT_FOCUS;

      let targetScaleFactor = 1;
      let targetFocus = defaultFocus;

      if (region && strength > 0) {
        const zoomScale = ZOOM_DEPTH_SCALES[region.depth];
        
        // The region focus is already in stage space (0-1 normalized coordinates)
        // We need to ensure it stays within valid bounds for the given zoom level
        const regionFocus = clampFocusToStage(region.focus, region.depth);
        
        // Interpolate scale: from 1 (no zoom) to zoomScale (full zoom)
        targetScaleFactor = 1 + (zoomScale - 1) * strength;
        
        // Interpolate focus position: from center to region focus
        targetFocus = {
          cx: defaultFocus.cx + (regionFocus.cx - defaultFocus.cx) * strength,
          cy: defaultFocus.cy + (regionFocus.cy - defaultFocus.cy) * strength,
        };
      }

      const state = animationStateRef.current;

      const prevScale = state.scale;
      const prevFocusX = state.focusX;
      const prevFocusY = state.focusY;

      const scaleDelta = targetScaleFactor - state.scale;
      const focusXDelta = targetFocus.cx - state.focusX;
      const focusYDelta = targetFocus.cy - state.focusY;

      let nextScale = prevScale;
      let nextFocusX = prevFocusX;
      let nextFocusY = prevFocusY;

      if (Math.abs(scaleDelta) > MIN_DELTA) {
        nextScale = prevScale + scaleDelta * SMOOTHING_FACTOR;
      } else {
        nextScale = targetScaleFactor;
      }

      if (Math.abs(focusXDelta) > MIN_DELTA) {
        nextFocusX = prevFocusX + focusXDelta * SMOOTHING_FACTOR;
      } else {
        nextFocusX = targetFocus.cx;
      }

      if (Math.abs(focusYDelta) > MIN_DELTA) {
        nextFocusY = prevFocusY + focusYDelta * SMOOTHING_FACTOR;
      } else {
        nextFocusY = targetFocus.cy;
      }

      state.scale = nextScale;
      state.focusX = nextFocusX;
      state.focusY = nextFocusY;

      const motionIntensity = Math.max(
        Math.abs(nextScale - prevScale),
        Math.abs(nextFocusX - prevFocusX),
        Math.abs(nextFocusY - prevFocusY)
      );

      applyTransform(motionIntensity);
    };

    app.ticker.add(ticker);
    return () => {
      app.ticker.remove(ticker);
    };
  }, [pixiReady, videoReady, stageFocusToVideoSpace, clampFocusToStage]);

  // Handle video metadata loaded
  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    onDurationChange(video.duration);
    video.currentTime = 0;
    video.pause();
    currentTimeRef.current = 0;
    setVideoReady(true);
  };

  const isImageUrl = wallpaper?.startsWith('/wallpapers/') || wallpaper?.startsWith('http');
  const backgroundStyle = isImageUrl 
    ? { backgroundImage: `url(${wallpaper || '/wallpapers/wallpaper1.jpg'})` }
    : { background: wallpaper || '/wallpapers/wallpaper1.jpg' };

  return (
    <div
      className="relative aspect-video rounded-sm overflow-hidden bg-cover bg-center"
      style={{ ...backgroundStyle, width: '100%' }}
    >
      <div ref={containerRef} className="absolute inset-0" />
      <div
        ref={overlayRef}
        className="absolute inset-0 select-none"
        style={{ pointerEvents: 'none' }}
        onPointerDown={handleOverlayPointerDown}
        onPointerMove={handleOverlayPointerMove}
        onPointerUp={handleOverlayPointerUp}
        onPointerLeave={handleOverlayPointerLeave}
      >
        <div
          ref={focusIndicatorRef}
          className="absolute rounded-md border border-sky-400/80 bg-sky-400/20 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]"
          style={{ display: 'none', pointerEvents: 'none' }}
        />
      </div>
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
      />
    </div>
  );
});

VideoPlayback.displayName = 'VideoPlayback';

export default VideoPlayback;
