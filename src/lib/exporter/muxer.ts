import type { ExportConfig } from './types';

interface MP4MuxerOptions {
  target: any; // ArrayBufferTarget instance
  video: {
    codec: string;
    width: number;
    height: number;
  };
  audio?: {
    codec: string;
    numberOfChannels: number;
    sampleRate: number;
  };
  fastStart?: 'in-memory' | 'fragmented';
}

interface Muxer {
  addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): void;
  addAudioChunk(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata): void;
  finalize(): void;
  target?: any;
}

export class VideoMuxer {
  private muxer: Muxer | null = null;
  private config: ExportConfig;
  private hasAudio: boolean;

  constructor(config: ExportConfig, hasAudio = false) {
    this.config = config;
    this.hasAudio = hasAudio;
  }

  async initialize(): Promise<void> {
    const MP4MuxerModule = await import('mp4-muxer');
    const MP4MuxerClass = (MP4MuxerModule as any).Muxer || MP4MuxerModule.default;
    const ArrayBufferTarget = (MP4MuxerModule as any).ArrayBufferTarget;
    
    const target = new ArrayBufferTarget();
    
    const options: MP4MuxerOptions = {
      target,
      video: {
        codec: 'avc',
        width: this.config.width,
        height: this.config.height,
      },
      fastStart: 'in-memory',
    };

    if (this.hasAudio) {
      options.audio = {
        codec: 'opus',
        numberOfChannels: 2,
        sampleRate: 48000,
      };
    }

    this.muxer = new MP4MuxerClass(options) as Muxer;
  }

  addVideoChunk(chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata): void {
    if (!this.muxer) {
      throw new Error('Muxer not initialized');
    }
    this.muxer.addVideoChunk(chunk, meta);
  }

  addAudioChunk(chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata): void {
    if (!this.muxer) {
      throw new Error('Muxer not initialized');
    }
    if (!this.hasAudio) {
      throw new Error('Audio not configured for this muxer');
    }
    this.muxer.addAudioChunk(chunk, meta);
  }

  finalize(): Blob {
    if (!this.muxer) {
      throw new Error('Muxer not initialized');
    }
    
    this.muxer.finalize();
    const buffer = this.muxer.target.buffer;
    return new Blob([buffer], { type: 'video/mp4' });
  }
}
