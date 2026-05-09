import WorkerConstructor from "./waveform.worker?worker";
import type { AudioPeaksData } from "../../timeline/core/timelineTypes";
import { WAVEFORM_DEFAULT_PEAK_COUNT } from "../../timeline/core/constants";

export class WaveformGenerator {
	private audioContext: AudioContext;
	private worker: Worker;
	private peaksCache = new Map<string, AudioPeaksData>();
	private pending = new Map<string, Promise<AudioPeaksData>>();
	private workerRequestSeq = 0;
	private workerResolvers = new Map<number, { resolve: (peaks: Float32Array) => void; reject: (err: Error) => void }>();

	constructor() {
		this.audioContext = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
		this.worker = new WorkerConstructor();
		
		this.worker.addEventListener(
			"message",
			(event: MessageEvent<{ requestId: number; peaks?: Float32Array; error?: string }>) => {
				const { requestId, peaks, error } = event.data;
				const resolver = this.workerResolvers.get(requestId);
				if (!resolver) return;
				
				this.workerResolvers.delete(requestId);
				if (error) {
					resolver.reject(new Error(error));
				} else if (peaks) {
					resolver.resolve(peaks);
				}
			},
		);

		this.worker.addEventListener("error", (error: ErrorEvent) => {
			console.error("[WaveformGenerator] Worker fatal error:", error);
			const fatalError = error.error ?? new Error(error.message || "Worker crashed");
			
			// Reject all pending requests if the worker itself crashes
			for (const resolver of this.workerResolvers.values()) {
				resolver.reject(fatalError);
			}
			this.workerResolvers.clear();
		});
	}

	private computePeaksWithWorker(channels: Float32Array[], samples: number): Promise<Float32Array> {
		return new Promise((resolve, reject) => {
			const requestId = ++this.workerRequestSeq;
			this.workerResolvers.set(requestId, { resolve, reject });
			
			this.worker.postMessage(
				{
					requestId,
					channels,
					samples,
				},
				channels.map(c => c.buffer),
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
			
			const channels: Float32Array[] = [];
			for (let i = 0; i < decoded.numberOfChannels; i++) {
				// We slice to transfer the underlying buffer to the worker
				channels.push(decoded.getChannelData(i).slice());
			}
			
			const peaks = await this.computePeaksWithWorker(channels, peakCount);

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
