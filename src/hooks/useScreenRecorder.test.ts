import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the MediaRecorder pause/stop state machine logic
 * extracted from useScreenRecorder.
 *
 * These verify that:
 * - Stop works from both "recording" and "paused" states
 * - Resume is called before stop when stopping from paused state
 * - Pause is a no-op when already paused or not recording
 * - Resume is a no-op when not paused
 */

function createMockMediaRecorder(initialState: RecordingState = "inactive") {
	let _state: RecordingState = initialState;
	return {
		get state() {
			return _state;
		},
		pause: vi.fn(() => {
			if (_state === "recording") _state = "paused";
		}),
		resume: vi.fn(() => {
			if (_state === "paused") _state = "recording";
		}),
		stop: vi.fn(() => {
			_state = "inactive";
		}),
		start: vi.fn(() => {
			_state = "recording";
		}),
	};
}

/**
 * Extracted state machine logic matching useScreenRecorder's stopRecording,
 * pauseRecording, and resumeRecording implementations.
 */
function stopRecording(
	recorder: ReturnType<typeof createMockMediaRecorder>,
	isNativeRecording: boolean,
) {
	if (isNativeRecording) {
		return { stopped: true, wasNative: true };
	}

	const recorderState = recorder.state;
	if (recorderState === "recording" || recorderState === "paused") {
		if (recorderState === "paused") {
			recorder.resume();
		}
		recorder.stop();
		return { stopped: true, wasNative: false };
	}
	return { stopped: false, wasNative: false };
}

function pauseRecording(
	recorder: ReturnType<typeof createMockMediaRecorder>,
	recording: boolean,
	paused: boolean,
	isNativeRecording: boolean,
): boolean {
	if (!recording || paused) return false;
	if (isNativeRecording) return false;
	if (recorder.state === "recording") {
		recorder.pause();
		return true;
	}
	return false;
}

function resumeRecording(
	recorder: ReturnType<typeof createMockMediaRecorder>,
	recording: boolean,
	paused: boolean,
): boolean {
	if (!recording || !paused) return false;
	if (recorder.state === "paused") {
		recorder.resume();
		return true;
	}
	return false;
}

describe("useScreenRecorder state machine", () => {
	let recorder: ReturnType<typeof createMockMediaRecorder>;

	beforeEach(() => {
		recorder = createMockMediaRecorder("recording");
	});

	describe("stopRecording", () => {
		it("stops from recording state", () => {
			const result = stopRecording(recorder, false);

			expect(result.stopped).toBe(true);
			expect(recorder.stop).toHaveBeenCalled();
			expect(recorder.resume).not.toHaveBeenCalled();
			expect(recorder.state).toBe("inactive");
		});

		it("resumes then stops from paused state", () => {
			recorder.pause();
			expect(recorder.state).toBe("paused");

			const result = stopRecording(recorder, false);

			expect(result.stopped).toBe(true);
			expect(recorder.resume).toHaveBeenCalled();
			expect(recorder.stop).toHaveBeenCalled();
			expect(recorder.state).toBe("inactive");
		});

		it("resume is called before stop when paused", () => {
			recorder.pause();
			const callOrder: string[] = [];
			recorder.resume.mockImplementation(() => {
				callOrder.push("resume");
			});
			recorder.stop.mockImplementation(() => {
				callOrder.push("stop");
			});

			stopRecording(recorder, false);

			expect(callOrder).toEqual(["resume", "stop"]);
		});

		it("does nothing when already inactive", () => {
			const inactiveRecorder = createMockMediaRecorder("inactive");

			const result = stopRecording(inactiveRecorder, false);

			expect(result.stopped).toBe(false);
			expect(inactiveRecorder.stop).not.toHaveBeenCalled();
		});

		it("delegates to native path for native recordings", () => {
			const result = stopRecording(recorder, true);

			expect(result.stopped).toBe(true);
			expect(result.wasNative).toBe(true);
			expect(recorder.stop).not.toHaveBeenCalled();
		});
	});

	describe("pauseRecording", () => {
		it("pauses an active recording", () => {
			const result = pauseRecording(recorder, true, false, false);

			expect(result).toBe(true);
			expect(recorder.pause).toHaveBeenCalled();
			expect(recorder.state).toBe("paused");
		});

		it("does nothing when already paused", () => {
			recorder.pause();
			recorder.pause.mockClear();

			const result = pauseRecording(recorder, true, true, false);

			expect(result).toBe(false);
			expect(recorder.pause).not.toHaveBeenCalled();
		});

		it("does nothing when not recording", () => {
			const result = pauseRecording(recorder, false, false, false);

			expect(result).toBe(false);
			expect(recorder.pause).not.toHaveBeenCalled();
		});

		it("does nothing for native recordings", () => {
			const result = pauseRecording(recorder, true, false, true);

			expect(result).toBe(false);
			expect(recorder.pause).not.toHaveBeenCalled();
		});
	});

	describe("resumeRecording", () => {
		it("resumes a paused recording", () => {
			recorder.pause();

			const result = resumeRecording(recorder, true, true);

			expect(result).toBe(true);
			expect(recorder.resume).toHaveBeenCalled();
			expect(recorder.state).toBe("recording");
		});

		it("does nothing when not paused", () => {
			const result = resumeRecording(recorder, true, false);

			expect(result).toBe(false);
			expect(recorder.resume).not.toHaveBeenCalled();
		});

		it("does nothing when not recording", () => {
			const result = resumeRecording(recorder, false, true);

			expect(result).toBe(false);
		});
	});

	describe("pause → stop → editor flow", () => {
		it("full lifecycle: record → pause → stop completes cleanly", () => {
			expect(recorder.state).toBe("recording");

			pauseRecording(recorder, true, false, false);
			expect(recorder.state).toBe("paused");

			const result = stopRecording(recorder, false);
			expect(result.stopped).toBe(true);
			expect(recorder.state).toBe("inactive");
		});

		it("full lifecycle: record → pause → resume → stop completes cleanly", () => {
			expect(recorder.state).toBe("recording");

			pauseRecording(recorder, true, false, false);
			expect(recorder.state).toBe("paused");

			resumeRecording(recorder, true, true);
			expect(recorder.state).toBe("recording");

			const result = stopRecording(recorder, false);
			expect(result.stopped).toBe(true);
			expect(recorder.state).toBe("inactive");
		});
	});
});
