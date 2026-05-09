import WorkerConstructor from "./waveform.worker?worker";
import type { AudioPeaksData } from "../../timeline/core/timelineTypes";
import { WAVEFORM_DEFAULT_PEAK_COUNT } from "../../timeline/core/constants";

export class WaveformGenerator {
	private audioContext: AudioContext;
	private worker: Worker;
	private peaksCache = new Map<string, AudioPeaksData>();
	private pending = new Map<string, Promise<AudioPeaksData>>();
	private workerRequestSeq = 0;
	private workerResolvers = new Map<number, (peaks: Float32Array) => void>();

	constructor() {
		this.audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
		this.worker = new WorkerConstructor();
		this.worker.addEventListener(
			"message",
			(event: MessageEvent<{ requestId: number; peaks: Float32Array }>) => {
				const { requestId, peaks } = event.data;
				const resolve = this.workerResolvers.get(requestId);
				if (!resolve) return;
				this.workerResolvers.delete(requestId);
				resolve(peaks);
			},
		);
	}

	private computePeaksWithWorker(channelData: Float32Array, samples: number): Promise<Float32Array> {
		return new Promise((resolve, reject) => {
			const requestId = ++this.workerRequestSeq;
			const onError = (error: ErrorEvent) => {
				this.worker.removeEventListener("error", onError);
				this.workerResolvers.delete(requestId);
				reject(error.error ?? new Error(error.message));
			};
			this.worker.addEventListener("error", onError, { once: true });
			this.workerResolvers.set(requestId, (peaks) => {
				this.worker.removeEventListener("error", onError);
				resolve(peaks);
			});
			this.worker.postMessage(
				{
					requestId,
					channelData,
					samples,
				},
				[channelData.buffer],
			);
		});
	}

	public async generate(url: string, peakCount = WAVEFORM_DEFAULT_PEAK_COUNT): Promise<AudioPeaksData> {
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
