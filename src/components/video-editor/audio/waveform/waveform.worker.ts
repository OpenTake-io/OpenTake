self.onmessage = (e: MessageEvent) => {
	const { requestId, channels, samples } = e.data as {
		requestId: number;
		channels: Float32Array[];
		samples: number;
	};

	if (!channels || channels.length === 0 || samples <= 0) {
		const empty = new Float32Array(0);
		(self as any).postMessage({ requestId, peaks: empty }, [empty.buffer]);
		return;
	}

	try {
		const firstChannel = channels[0];
		const step = Math.max(1, Math.floor(firstChannel.length / samples));
		const result = new Float32Array(samples);

		for (let i = 0; i < samples; i++) {
			const start = i * step;
			const end = Math.min(start + step, firstChannel.length);
			let max = 0;
			for (let j = start; j < end; j++) {
				for (let c = 0; c < channels.length; c++) {
					const val = Math.abs(channels[c][j]);
					if (val > max) max = val;
				}
			}
			result[i] = max;
		}

		(self as any).postMessage({ requestId, peaks: result }, [result.buffer]);
	} catch (err) {
		(self as any).postMessage({
			requestId,
			error: err instanceof Error ? err.message : "Unknown worker error",
		});
	}
};
