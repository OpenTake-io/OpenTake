import * as PIXI from 'pixi.js';

interface TransformParams {
  videoSprite: PIXI.Sprite;
  maskGraphics: PIXI.Graphics;
  blurFilter: PIXI.BlurFilter | null;
  stageSize: { width: number; height: number };
  videoSize: { width: number; height: number };
  baseScale: number;
  baseOffset: { x: number; y: number };
  baseMask: { x: number; y: number; width: number; height: number };
  cropOffset: { x: number; y: number };
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
    baseMask,
  cropOffset,
    zoomScale,
    focusX,
    focusY,
    motionIntensity,
    isPlaying,
  } = params;

  if (
    !stageSize.width ||
    !stageSize.height ||
    !videoSize.width ||
    !videoSize.height ||
    baseScale <= 0 ||
    baseMask.width <= 0 ||
    baseMask.height <= 0
  ) {
    return;
  }

  const focusStagePxX = baseMask.x + focusX * stageSize.width;
  const focusStagePxY = baseMask.y + focusY * stageSize.height;
  const stageCenterX = baseMask.x + stageSize.width / 2;
  const stageCenterY = baseMask.y + stageSize.height / 2;

  const actualScale = baseScale * zoomScale;
  videoSprite.scale.set(actualScale);

  // Keep the focus point centered in viewport after zoom transformation
  const baseVideoX = baseOffset.x;
  const baseVideoY = baseOffset.y;
  const baseMaskX = baseMask.x;
  const baseMaskY = baseMask.y;
  const focusInVideoSpaceX = focusStagePxX - baseVideoX;
  const focusInVideoSpaceY = focusStagePxY - baseVideoY;

  // Position formula: stageCenterX - focusInVideoSpace * zoomScale
  let newVideoX = stageCenterX - focusInVideoSpaceX * zoomScale;
  let newVideoY = stageCenterY - focusInVideoSpaceY * zoomScale;

  const cropStartX = cropOffset.x;
  const cropStartY = cropOffset.y;
  const cropEndX = cropOffset.x + videoSize.width;
  const cropEndY = cropOffset.y + videoSize.height;
  const maskWidth = baseMask.width;
  const maskHeight = baseMask.height;

  const minVideoX = baseMaskX + maskWidth - cropEndX * actualScale;
  const maxVideoX = baseMaskX - cropStartX * actualScale;
  const minVideoY = baseMaskY + maskHeight - cropEndY * actualScale;
  const maxVideoY = baseMaskY - cropStartY * actualScale;

  if (minVideoX <= maxVideoX) {
    newVideoX = Math.max(minVideoX, Math.min(maxVideoX, newVideoX));
  }

  if (minVideoY <= maxVideoY) {
    newVideoY = Math.max(minVideoY, Math.min(maxVideoY, newVideoY));
  }

  videoSprite.position.set(newVideoX, newVideoY);

  if (blurFilter) {
    const shouldBlur = isPlaying && motionIntensity > 0.0005;
    const motionBlur = shouldBlur ? Math.min(6, motionIntensity * 120) : 0;
    blurFilter.blur = motionBlur;
  }

  const maskX = baseMaskX;
  const maskY = baseMaskY;
  const radius = Math.min(maskWidth, maskHeight) * 0.02;

  maskGraphics.clear();
  maskGraphics.roundRect(maskX, maskY, maskWidth, maskHeight, radius);
  maskGraphics.fill({ color: 0xffffff });
}
