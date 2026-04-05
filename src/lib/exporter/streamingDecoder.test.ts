import { describe, expect, it } from 'vitest';
import { getDecodedFrameStartupOffsetUs } from './streamingDecoder';

describe('getDecodedFrameStartupOffsetUs', () => {
  it('ignores positive stream start metadata when the first decoded frame matches it', () => {
    expect(
      getDecodedFrameStartupOffsetUs(4_978_000, {
        streamStartTime: 4.978,
      }),
    ).toBe(0);
  });

  it('returns only the startup gap beyond the stream start timestamp', () => {
    expect(
      getDecodedFrameStartupOffsetUs(5_128_000, {
        streamStartTime: 4.978,
      }),
    ).toBe(150_000);
  });

  it('falls back to media start time and then zero when stream metadata is missing', () => {
    expect(
      getDecodedFrameStartupOffsetUs(250_000, {
        mediaStartTime: 0.1,
      }),
    ).toBe(150_000);

    expect(getDecodedFrameStartupOffsetUs(250_000, {})).toBe(250_000);
  });
});