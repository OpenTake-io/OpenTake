import type { WebDemuxer } from 'web-demuxer'
import type { TrimRegion } from '@/components/video-editor/types'
import type { VideoMuxer } from './muxer'

const AUDIO_BITRATE = 128_000
const DECODE_BACKPRESSURE_LIMIT = 20

export class AudioProcessor {
  private cancelled = false

  async process(demuxer: WebDemuxer, muxer: VideoMuxer, trimRegions?: TrimRegion[]): Promise<void> {
    let audioConfig: AudioDecoderConfig
    try {
      audioConfig = (await demuxer.getDecoderConfig('audio')) as AudioDecoderConfig
    } catch {
      console.warn('[AudioProcessor] No audio track found, skipping')
      return
    }

    const codecCheck = await AudioDecoder.isConfigSupported(audioConfig)
    if (!codecCheck.supported) {
      console.warn('[AudioProcessor] Audio codec not supported:', audioConfig.codec)
      return
    }

    const sortedTrims = trimRegions ? [...trimRegions].sort((a, b) => a.startMs - b.startMs) : []
    const decodedFrames: AudioData[] = []

    const decoder = new AudioDecoder({
      output: (data: AudioData) => decodedFrames.push(data),
      error: (error: DOMException) => console.error('[AudioProcessor] Decode error:', error),
    })
    decoder.configure(audioConfig)

    const reader = (demuxer.read('audio') as ReadableStream<EncodedAudioChunk>).getReader()

    while (!this.cancelled) {
      const { done, value: chunk } = await reader.read()
      if (done || !chunk) break

      const timestampMs = chunk.timestamp / 1000
      if (this.isInTrimRegion(timestampMs, sortedTrims)) continue

      decoder.decode(chunk)

      while (decoder.decodeQueueSize > DECODE_BACKPRESSURE_LIMIT && !this.cancelled) {
        await new Promise((resolve) => setTimeout(resolve, 1))
      }
    }

    if (decoder.state === 'configured') {
      await decoder.flush()
      decoder.close()
    }

    if (this.cancelled || decodedFrames.length === 0) {
      for (const frame of decodedFrames) frame.close()
      return
    }

    const encodedChunks: { chunk: EncodedAudioChunk; meta?: EncodedAudioChunkMetadata }[] = []
    const encoder = new AudioEncoder({
      output: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => {
        encodedChunks.push({ chunk, meta })
      },
      error: (error: DOMException) => console.error('[AudioProcessor] Encode error:', error),
    })

    const sampleRate = audioConfig.sampleRate || 48_000
    const channels = audioConfig.numberOfChannels || 2
    const encodeConfig: AudioEncoderConfig = {
      codec: 'opus',
      sampleRate,
      numberOfChannels: channels,
      bitrate: AUDIO_BITRATE,
    }

    const encodeSupport = await AudioEncoder.isConfigSupported(encodeConfig)
    if (!encodeSupport.supported) {
      console.warn('[AudioProcessor] Opus encoding not supported, skipping audio')
      for (const frame of decodedFrames) frame.close()
      return
    }

    encoder.configure(encodeConfig)

    for (const audioData of decodedFrames) {
      if (this.cancelled) {
        audioData.close()
        continue
      }

      const timestampMs = audioData.timestamp / 1000
      const trimOffsetMs = this.computeTrimOffset(timestampMs, sortedTrims)
      const adjustedTimestampUs = audioData.timestamp - trimOffsetMs * 1000

      const adjusted = this.cloneWithTimestamp(audioData, Math.max(0, adjustedTimestampUs))
      audioData.close()

      encoder.encode(adjusted)
      adjusted.close()
    }

    if (encoder.state === 'configured') {
      await encoder.flush()
      encoder.close()
    }

    for (const { chunk, meta } of encodedChunks) {
      if (this.cancelled) break
      await muxer.addAudioChunk(chunk, meta)
    }
  }

  private cloneWithTimestamp(src: AudioData, newTimestamp: number): AudioData {
    const isPlanar = src.format?.includes('planar') ?? false
    const numPlanes = isPlanar ? src.numberOfChannels : 1

    let totalSize = 0
    for (let planeIndex = 0; planeIndex < numPlanes; planeIndex++) {
      totalSize += src.allocationSize({ planeIndex })
    }

    const buffer = new ArrayBuffer(totalSize)
    let offset = 0

    for (let planeIndex = 0; planeIndex < numPlanes; planeIndex++) {
      const planeSize = src.allocationSize({ planeIndex })
      src.copyTo(new Uint8Array(buffer, offset, planeSize), { planeIndex })
      offset += planeSize
    }

    return new AudioData({
      format: src.format!,
      sampleRate: src.sampleRate,
      numberOfFrames: src.numberOfFrames,
      numberOfChannels: src.numberOfChannels,
      timestamp: newTimestamp,
      data: buffer,
    })
  }

  private isInTrimRegion(timestampMs: number, trims: TrimRegion[]) {
    return trims.some((trim) => timestampMs >= trim.startMs && timestampMs < trim.endMs)
  }

  private computeTrimOffset(timestampMs: number, trims: TrimRegion[]) {
    let offset = 0
    for (const trim of trims) {
      if (trim.endMs <= timestampMs) {
        offset += trim.endMs - trim.startMs
      }
    }
    return offset
  }

  cancel() {
    this.cancelled = true
  }
}