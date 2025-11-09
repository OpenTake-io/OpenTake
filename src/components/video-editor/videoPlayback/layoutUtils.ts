import * as PIXI from 'pixi.js';
import { VIEWPORT_SCALE } from "./constants";

interface LayoutParams {
  container: HTMLDivElement;
  app: PIXI.Application;
  videoSprite: PIXI.Sprite;
  maskGraphics: PIXI.Graphics;
  videoElement: HTMLVideoElement;
}

interface LayoutResult {
  stageSize: { width: number; height: number };
  videoSize: { width: number; height: number };
  baseScale: number;
  baseOffset: { x: number; y: number };
}

export function layoutVideoContent(params: LayoutParams): LayoutResult | null {
  const { container, app, videoSprite, maskGraphics, videoElement } = params;

  const videoWidth = videoElement.videoWidth;
  const videoHeight = videoElement.videoHeight;

  if (!videoWidth || !videoHeight) {
    return null;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;

  if (!width || !height) {
    return null;
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

  const radius = Math.min(displayWidth, displayHeight) * 0.02;
  maskGraphics.clear();
  maskGraphics.roundRect(offsetX, offsetY, displayWidth, displayHeight, radius);
  maskGraphics.fill({ color: 0xffffff });

  return {
    stageSize: { width, height },
    videoSize: { width: videoWidth, height: videoHeight },
    baseScale: scale,
    baseOffset: { x: offsetX, y: offsetY },
  };
}
