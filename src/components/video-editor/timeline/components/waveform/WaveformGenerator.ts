import WorkerConstructor from "./waveform.worker?worker";
import type { AudioPeaksData } from "../../core/timelineTypes";

const DEFAULT_PEAK_COUNT = 2048;

export class WaveformGenerator {
	private audioContext: AudioContext;
	private worker: Worker;
	private peaksCache = new Map<string, AudioPeaksData>();
	private pending = new Map<string, Promise<AudioPeaksData>>();

	constructor() {
		this.audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
		this.worker = new WorkerConstructor();
	}

	private computePeaksWithWorker(channelData: Float32Array, samples: number): Promise<Float32Array> {
		return new Promise((resolve, reject) => {
			const onMessage = (event: MessageEvent<Float32Array>) => {
				this.worker.removeEventListener("message", onMessage);
				this.worker.removeEventListener("error", onError);
				resolve(event.data);
			};
			const onError = (error: ErrorEvent) => {
				this.worker.removeEventListener("message", onMessage);
				this.worker.removeEventListener("error", onError);
				reject(error.error ?? new Error(error.message));
			};

			this.worker.addEventListener("message", onMessage);
			this.worker.addEventListener("error", onError);
			this.worker.postMessage(
				{
					channelData,
					samples,
				},
				[channelData.buffer],
			);
		});
	}

	public async generate(url: string, peakCount = DEFAULT_PEAK_COUNT): Promise<AudioPeaksData> {
		const cacheKey = `${url}::${peakCount}`;
		const cached = this.peaksCache.get(cacheKey);
		if (cached) return cached;

		const inflight = this.pending.get(cacheKey);
		if (inflight) return inflight;

		const request = (async () => {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to load media: ${response.status}`);
			}

			const arrayBuffer = await response.arrayBuffer();
			const decoded = await this.audioContext.decodeAudioData(arrayBuffer);
			const channelData = decoded.getChannelData(0).slice();
			const peaks = await this.computePeaksWithWorker(channelData, peakCount);

			let max = 0;
			for (let i = 0; i < peaks.length; i++) {
				if (peaks[i] > max) max = peaks[i];
			}
			if (max > 0) {
				for (let i = 0; i < peaks.length; i++) {
					peaks[i] /= max;
				}
			}

			const result: AudioPeaksData = {
				peaks,
				durationMs: decoded.duration * 1000,
			};
			this.peaksCache.set(cacheKey, result);
			this.pending.delete(cacheKey);
			return result;
		})().catch((error) => {
			this.pending.delete(cacheKey);
			throw error;
		});

		this.pending.set(cacheKey, request);
		return request;
	}
}

export const waveformGenerator = new WaveformGenerator();
