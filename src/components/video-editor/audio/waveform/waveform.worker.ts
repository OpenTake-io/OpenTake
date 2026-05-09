type WaveformWorkerRequest = {
	requestId: number;
	channels: Float32Array[];
	samples: number;
};

interface WorkerContext {
	onmessage: (e: MessageEvent<WaveformWorkerRequest>) => void;
	postMessage: (message: any, transfer?: Transferable[]) => void;
}

const workerScope = self as unknown as WorkerContext;

workerScope.onmessage = (e: MessageEvent<WaveformWorkerRequest>) => {
	const { requestId, channels, samples } = e.data;

	if (!channels || channels.length === 0 || samples <= 0) {
		const empty = new Float32Array(0);
		workerScope.postMessage({ requestId, peaks: empty }, [empty.buffer]);
		return;
	}

	try {
		const firstChannel = channels[0];
		const result = new Float32Array(samples);
		const total = firstChannel.length;

		for (let i = 0; i < samples; i++) {
			const start = Math.floor((i * total) / samples);
			const end = Math.floor(((i + 1) * total) / samples);
			let max = 0;
			for (let j = start; j < end; j++) {
				for (let c = 0; c < channels.length; c++) {
					const val = Math.abs(channels[c][j]);
					if (val > max) max = val;
				}
			}
			result[i] = max;
		}

		workerScope.postMessage({ requestId, peaks: result }, [result.buffer]);
	} catch (err) {
		workerScope.postMessage({
			requestId,
			error: err instanceof Error ? err.message : "Unknown worker error",
		});
	}
};
