export interface DecodedVideoInfo {
  width: number;
  height: number;
  duration: number; // in seconds
  frameRate: number;
  codec: string;
}

export class VideoFileDecoder {
  private decoder: VideoDecoder | null = null;
  private info: DecodedVideoInfo | null = null;
  private videoElement: HTMLVideoElement | null = null;

  async loadVideo(videoUrl: string): Promise<DecodedVideoInfo> {
    this.videoElement = document.createElement('video');
    this.videoElement.src = videoUrl;
    this.videoElement.preload = 'metadata';

    return new Promise((resolve, reject) => {
      this.videoElement!.addEventListener('loadedmetadata', () => {
        const video = this.videoElement!;
        
        this.info = {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
          frameRate: 60,
          codec: 'avc1.640033',
        };

        resolve(this.info);
      });

      this.videoElement!.addEventListener('error', (e) => {
        reject(new Error(`Failed to load video: ${e}`));
      });
    });
  }

  /**
   * Get video element for seeking
   */
  getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  /**
   * Seek to a specific time and wait for the frame to be ready
   */
  async seekToTime(timeInSeconds: number): Promise<void> {
    if (!this.videoElement) {
      throw new Error('Video not loaded');
    }

    return new Promise((resolve) => {
      const video = this.videoElement!;
      
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };

      video.addEventListener('seeked', onSeeked);
      video.currentTime = timeInSeconds;
    });
  }

  getInfo(): DecodedVideoInfo | null {
    return this.info;
  }

  destroy(): void {
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement = null;
    }
    
    if (this.decoder) {
      if (this.decoder.state !== 'closed') {
        this.decoder.close();
      }
      this.decoder = null;
    }
  }
}
