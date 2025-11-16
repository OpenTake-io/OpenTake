import type { ExportConfig, ExportProgress, ExportResult } from './types';
import { VideoFileDecoder } from './videoDecoder';
import { FrameRenderer } from './frameRenderer';
import { VideoMuxer } from './muxer';
import type { ZoomRegion, CropRegion } from '@/components/video-editor/types';

interface VideoExporterConfig extends ExportConfig {
  videoUrl: string;
  wallpaper: string;
  zoomRegions: ZoomRegion[];
  showShadow: boolean;
  showBlur: boolean;
  cropRegion: CropRegion;
  onProgress?: (progress: ExportProgress) => void;
}

/**
 * Fast video exporter using VideoFrame and VideoEncoder APIs.
 * Avoids reading pixel data into JavaScript memory for maximum performance.
 * 
 * Based on: https://pietrasiak.com/fast-video-rendering-and-encoding-using-web-apis
 */
export class VideoExporter {
  private config: VideoExporterConfig;
  private decoder: VideoFileDecoder | null = null;
  private renderer: FrameRenderer | null = null;
  private encoder: VideoEncoder | null = null;
  private muxer: VideoMuxer | null = null;
  private cancelled = false;
  private encodedChunks: EncodedVideoChunk[] = [];
  private encodeQueue = 0;
  private readonly MAX_ENCODE_QUEUE = 30;
  private videoDescription: Uint8Array | undefined;

  constructor(config: VideoExporterConfig) {
    this.config = config;
  }

  async export(): Promise<ExportResult> {
    try {
      // Clean up any previous export state
      this.cleanup();
      this.cancelled = false;

      // Step 1: Initialize decoder and load video
      this.decoder = new VideoFileDecoder();
      const videoInfo = await this.decoder.loadVideo(this.config.videoUrl);

      // Step 2: Initialize frame renderer
      this.renderer = new FrameRenderer({
        width: this.config.width,
        height: this.config.height,
        wallpaper: this.config.wallpaper,
        zoomRegions: this.config.zoomRegions,
        showShadow: this.config.showShadow,
        showBlur: this.config.showBlur,
        cropRegion: this.config.cropRegion,
        videoWidth: videoInfo.width,
        videoHeight: videoInfo.height,
      });
      await this.renderer.initialize();

      // Step 3: Initialize video encoder
      const totalFrames = Math.ceil(videoInfo.duration * this.config.frameRate);
      await this.initializeEncoder();

      // Step 4: Initialize muxer
      this.muxer = new VideoMuxer(this.config, false);
      await this.muxer.initialize();

      // Step 5: Get the video element for frame extraction
      const videoElement = this.decoder.getVideoElement();
      if (!videoElement) {
        throw new Error('Video element not available');
      }

      // Step 6: Process frames
      const frameDuration = 1_000_000 / this.config.frameRate; // in microseconds
      let frameIndex = 0;
      const startTime = performance.now();
      const timeStep = 1 / this.config.frameRate;

      while (frameIndex < totalFrames && !this.cancelled) {
        const timestamp = frameIndex * frameDuration;
        const videoTime = frameIndex * timeStep;
        
        // Seek to the frame time
        await this.decoder.seekToTime(videoTime);

        // Create a VideoFrame from the video element (on GPU!)
        const videoFrame = new VideoFrame(videoElement, {
          timestamp,
        });

        // Render the frame with all effects
        await this.renderer.renderFrame(videoFrame, timestamp);
        
        // Close the video frame as we're done with it
        videoFrame.close();

        // Wait if encode queue is too large
        while (this.encodeQueue >= this.MAX_ENCODE_QUEUE && !this.cancelled) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        if (this.cancelled) break;

        // Create VideoFrame from rendered canvas (on GPU, no pixel read!)
        const canvas = this.renderer.getCanvas();
        const exportFrame = new VideoFrame(canvas, {
          timestamp,
          duration: frameDuration,
        });

        // Encode the frame (check if encoder is still valid)
        if (this.encoder && this.encoder.state === 'configured') {
          this.encodeQueue++;
          this.encoder.encode(exportFrame, { keyFrame: frameIndex % 150 === 0 });
        }
        exportFrame.close();

        // Report progress
        frameIndex++;
        const elapsed = (performance.now() - startTime) / 1000;
        const framesPerSecond = frameIndex / elapsed;
        const remainingFrames = totalFrames - frameIndex;
        const estimatedTimeRemaining = remainingFrames / framesPerSecond;

        if (this.config.onProgress) {
          this.config.onProgress({
            currentFrame: frameIndex,
            totalFrames,
            percentage: (frameIndex / totalFrames) * 100,
            estimatedTimeRemaining,
          });
        }
      }

      if (this.cancelled) {
        return { success: false, error: 'Export cancelled' };
      }

      // Step 7: Finalize encoding
      if (this.encoder && this.encoder.state === 'configured') {
        await this.encoder.flush();
      }

      // Step 8: Add all chunks to muxer with metadata
      for (let i = 0; i < this.encodedChunks.length; i++) {
        const chunk = this.encodedChunks[i];
        const meta: EncodedVideoChunkMetadata = {};
        
        // Add decoder config for the first chunk
        if (i === 0 && this.videoDescription) {
          meta.decoderConfig = {
            codec: this.config.codec || 'avc1.640033',
            codedWidth: this.config.width,
            codedHeight: this.config.height,
            description: this.videoDescription,
          };
        }
        
        this.muxer!.addVideoChunk(chunk, meta);
      }

      // Step 9: Finalize muxer and get output blob
      const blob = this.muxer!.finalize();

      return { success: true, blob };
    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.cleanup();
    }
  }

  private async initializeEncoder(): Promise<void> {
    this.encodedChunks = [];
    this.encodeQueue = 0;
    let videoDescription: Uint8Array | undefined;

    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        // Store the first chunk's metadata (contains codec description)
        if (meta?.decoderConfig?.description && !videoDescription) {
          const desc = meta.decoderConfig.description;
          videoDescription = new Uint8Array(desc instanceof ArrayBuffer ? desc : (desc as any));
          this.videoDescription = videoDescription;
        }
        this.encodedChunks.push(chunk);
        this.encodeQueue--;
      },
      error: (error) => {
        console.error('VideoEncoder error:', error);
      },
    });

    // Configure encoder for H.264 (AVC) with level 5.1 for high resolution support
    const codec = this.config.codec || 'avc1.640033';
    
    this.encoder.configure({
      codec,
      width: this.config.width,
      height: this.config.height,
      bitrate: this.config.bitrate,
      framerate: this.config.frameRate,
      latencyMode: 'quality',
      bitrateMode: 'variable',
    });
  }

  cancel(): void {
    this.cancelled = true;
    // Immediately cleanup to stop encoding
    this.cleanup();
  }

  private cleanup(): void {
    // Close encoder safely
    if (this.encoder) {
      try {
        if (this.encoder.state === 'configured') {
          this.encoder.close();
        }
      } catch (e) {
        console.warn('Error closing encoder:', e);
      }
      this.encoder = null;
    }

    // Destroy decoder
    if (this.decoder) {
      try {
        this.decoder.destroy();
      } catch (e) {
        console.warn('Error destroying decoder:', e);
      }
      this.decoder = null;
    }

    // Destroy renderer
    if (this.renderer) {
      try {
        this.renderer.destroy();
      } catch (e) {
        console.warn('Error destroying renderer:', e);
      }
      this.renderer = null;
    }

    this.muxer = null;
    this.encodedChunks = [];
    this.encodeQueue = 0;
    this.videoDescription = undefined;
  }
}
