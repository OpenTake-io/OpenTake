self.onmessage = (e: MessageEvent) => {
	const { requestId, channelData, samples } = e.data as {
		requestId: number;
		channelData: Float32Array;
		samples: number;
	};

	if (!channelData || samples <= 0) {
		const empty = new Float32Array(0);
		(self as any).postMessage({ requestId, peaks: empty }, [empty.buffer]);
		return;
	}

	try {
		const step = Math.max(1, Math.floor(channelData.length / samples));
		const result = new Float32Array(samples);

		for (let i = 0; i < samples; i++) {
			const start = i * step;
			const end = Math.min(start + step, channelData.length);
			let max = 0;
			for (let j = start; j < end; j++) {
				const val = Math.abs(channelData[j]);
				if (val > max) max = val;
			}
			result[i] = max;
		}

		(self as any).postMessage({ requestId, peaks: result }, [result.buffer]);
	} catch {
		const empty = new Float32Array(0);
		(self as any).postMessage({ requestId, peaks: empty }, [empty.buffer]);
	}
};
