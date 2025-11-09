import * as PIXI from 'pixi.js';

interface TransformParams {
  videoSprite: PIXI.Sprite;
  maskGraphics: PIXI.Graphics;
  blurFilter: PIXI.BlurFilter | null;
  stageSize: { width: number; height: number };
  videoSize: { width: number; height: number };
  baseScale: number;
  baseOffset: { x: number; y: number };
  zoomScale: number;
  focusX: number;
  focusY: number;
  motionIntensity: number;
  isPlaying: boolean;
}

export function applyZoomTransform(params: TransformParams) {
  const {
    videoSprite,
    maskGraphics,
    blurFilter,
    stageSize,
    videoSize,
    baseScale,
    baseOffset,
    zoomScale,
    focusX,
    focusY,
    motionIntensity,
    isPlaying,
  } = params;

  if (!stageSize.width || !stageSize.height || !videoSize.width || !videoSize.height || baseScale <= 0) {
    return;
  }

  const focusStagePxX = focusX * stageSize.width;
  const focusStagePxY = focusY * stageSize.height;
  const stageCenterX = stageSize.width / 2;
  const stageCenterY = stageSize.height / 2;

  const actualScale = baseScale * zoomScale;
  videoSprite.scale.set(actualScale);

  // Keep the focus point centered in viewport after zoom transformation
  const baseVideoX = baseOffset.x;
  const baseVideoY = baseOffset.y;
  const focusInVideoSpaceX = focusStagePxX - baseVideoX;
  const focusInVideoSpaceY = focusStagePxY - baseVideoY;

  // Position formula: stageCenterX - focusInVideoSpace * zoomScale
  const newVideoX = stageCenterX - focusInVideoSpaceX * zoomScale;
  const newVideoY = stageCenterY - focusInVideoSpaceY * zoomScale;

  videoSprite.position.set(newVideoX, newVideoY);

  if (blurFilter) {
    const shouldBlur = isPlaying && motionIntensity > 0.0005;
    const motionBlur = shouldBlur ? Math.min(6, motionIntensity * 120) : 0;
    blurFilter.blur = motionBlur;
  }

  const videoWidth = videoSize.width * actualScale;
  const videoHeight = videoSize.height * actualScale;
  const radius = Math.min(videoWidth, videoHeight) * 0.02;
  maskGraphics.clear();
  maskGraphics.roundRect(newVideoX, newVideoY, videoWidth, videoHeight, radius);
  maskGraphics.fill({ color: 0xffffff });
}
