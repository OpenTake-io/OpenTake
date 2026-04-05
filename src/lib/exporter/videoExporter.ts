import type {
	AutoCaptionSettings,
	AnnotationRegion,
	AudioRegion,
	CaptionCue,
	CropRegion,
	CursorStyle,
	CursorTelemetryPoint,
	SpeedRegion,
	TrimRegion,
	WebcamOverlaySettings,
	ZoomTransitionEasing,
	ZoomRegion,
} from "@/components/video-editor/types";
import { AudioProcessor } from "./audioEncoder";
import { FrameRenderer } from "./frameRenderer";
import type { SupportedMp4EncoderPath } from "./mp4Support";
import { captureCanvasFrameForNativeExport } from "./nativeFrameCapture";
import { VideoMuxer } from "./muxer";
import { type DecodedVideoInfo, StreamingVideoDecoder } from "./streamingDecoder";
import type { ExportConfig, ExportProgress, ExportResult } from "./types";

const DEFAULT_MAX_ENCODE_QUEUE = 240;
const PROGRESS_SAMPLE_WINDOW_MS = 1_000;
let nativeExportDisabledWarningShown = false;

interface VideoExporterConfig extends ExportConfig {
	videoUrl: string;
	wallpaper: string;
	zoomRegions: ZoomRegion[];
	trimRegions?: TrimRegion[];
	speedRegions?: SpeedRegion[];
	showShadow: boolean;
	shadowIntensity: number;
	backgroundBlur: number;
	zoomMotionBlur?: number;
	connectZooms?: boolean;
	zoomInDurationMs?: number;
	zoomInOverlapMs?: number;
	zoomOutDurationMs?: number;
	connectedZoomGapMs?: number;
	connectedZoomDurationMs?: number;
	zoomInEasing?: ZoomTransitionEasing;
	zoomOutEasing?: ZoomTransitionEasing;
	connectedZoomEasing?: ZoomTransitionEasing;
	borderRadius?: number;
	padding?: number;
	videoPadding?: number;
	cropRegion: CropRegion;
	webcam?: WebcamOverlaySettings;
	webcamUrl?: string | null;
	annotationRegions?: AnnotationRegion[];
	autoCaptions?: CaptionCue[];
	autoCaptionSettings?: AutoCaptionSettings;
	cursorTelemetry?: CursorTelemetryPoint[];
	showCursor?: boolean;
	cursorStyle?: CursorStyle;
	cursorSize?: number;
	cursorSmoothing?: number;
	cursorMotionBlur?: number;
	cursorClickBounce?: number;
	cursorClickBounceDuration?: number;
	cursorSway?: number;
	audioRegions?: AudioRegion[];
	sourceAudioFallbackPaths?: string[];
	previewWidth?: number;
	previewHeight?: number;
	onProgress?: (progress: ExportProgress) => void;
	preferredEncoderPath?: SupportedMp4EncoderPath | null;
}

type NativeAudioPlan =
	| {
			audioMode: "none";
	  }
	| {
			audioMode: "copy-source" | "trim-source";
			audioSourcePath: string;
			trimSegments?: Array<{ startMs: number; endMs: number }>;
	  }
	| {
			audioMode: "edited-track";
	  };

export class VideoExporter {
	private config: VideoExporterConfig;
	private streamingDecoder: StreamingVideoDecoder | null = null;
	private renderer: FrameRenderer | null = null;
	private encoder: VideoEncoder | null = null;
	private muxer: VideoMuxer | null = null;
	private audioProcessor: AudioProcessor | null = null;
	private cancelled = false;
	private encodeQueue = 0;
	private videoDescription: Uint8Array | undefined;
	private videoColorSpace: VideoColorSpaceInit | undefined;
	private pendingMuxing: Promise<void> = Promise.resolve();
	private chunkCount = 0;
	private readonly WINDOWS_FINALIZATION_TIMEOUT_MS = 180_000;
	private exportStartTimeMs = 0;
	private progressSampleStartTimeMs = 0;
	private progressSampleStartFrame = 0;
	private encoderError: Error | null = null;
	private nativeExportSessionId: string | null = null;

	constructor(config: VideoExporterConfig) {
		this.config = config;
	}

	async export(): Promise<ExportResult> {
		try {
			this.cleanup();
			this.cancelled = false;
			this.encoderError = null;
			this.exportStartTimeMs = this.getNowMs();
			this.progressSampleStartTimeMs = this.exportStartTimeMs;
			this.progressSampleStartFrame = 0;

			// Initialize streaming decoder and load video metadata
			this.streamingDecoder = new StreamingVideoDecoder({
				maxDecodeQueue: this.config.maxDecodeQueue,
				maxPendingFrames: this.config.maxPendingFrames,
			});
			const videoInfo = await this.streamingDecoder.loadMetadata(this.config.videoUrl);
			const shouldUseExperimentalNativeExport = this.shouldUseExperimentalNativeExport();
			const nativeAudioPlan = shouldUseExperimentalNativeExport
				? this.buildNativeAudioPlan(videoInfo)
				: null;
			let useNativeEncoder = shouldUseExperimentalNativeExport
				? await this.tryStartNativeVideoExport()
				: false;

			if (!useNativeEncoder) {
				await this.initializeEncoder();
			}

			// Initialize frame renderer
			this.renderer = new FrameRenderer({
				width: this.config.width,
				height: this.config.height,
				preferredRenderBackend: useNativeEncoder ? "webgl" : undefined,
				wallpaper: this.config.wallpaper,
				zoomRegions: this.config.zoomRegions,
				showShadow: this.config.showShadow,
				shadowIntensity: this.config.shadowIntensity,
				backgroundBlur: this.config.backgroundBlur,
				zoomMotionBlur: this.config.zoomMotionBlur,
				connectZooms: this.config.connectZooms,
				zoomInDurationMs: this.config.zoomInDurationMs,
				zoomInOverlapMs: this.config.zoomInOverlapMs,
				zoomOutDurationMs: this.config.zoomOutDurationMs,
				connectedZoomGapMs: this.config.connectedZoomGapMs,
				connectedZoomDurationMs: this.config.connectedZoomDurationMs,
				zoomInEasing: this.config.zoomInEasing,
				zoomOutEasing: this.config.zoomOutEasing,
				connectedZoomEasing: this.config.connectedZoomEasing,
				borderRadius: this.config.borderRadius,
				padding: this.config.padding,
				cropRegion: this.config.cropRegion,
				webcam: this.config.webcam,
				webcamUrl: this.config.webcamUrl,
				videoWidth: videoInfo.width,
				videoHeight: videoInfo.height,
				annotationRegions: this.config.annotationRegions,
				autoCaptions: this.config.autoCaptions,
				autoCaptionSettings: this.config.autoCaptionSettings,
				speedRegions: this.config.speedRegions,
				previewWidth: this.config.previewWidth,
				previewHeight: this.config.previewHeight,
				cursorTelemetry: this.config.cursorTelemetry,
				showCursor: this.config.showCursor,
				cursorStyle: this.config.cursorStyle,
				cursorSize: this.config.cursorSize,
				cursorSmoothing: this.config.cursorSmoothing,
				cursorMotionBlur: this.config.cursorMotionBlur,
				cursorClickBounce: this.config.cursorClickBounce,
				cursorClickBounceDuration: this.config.cursorClickBounceDuration,
				cursorSway: this.config.cursorSway,
			});
			await this.renderer.initialize();

			const hasAudioRegions = (this.config.audioRegions ?? []).length > 0;
			const hasSourceAudioFallback = (this.config.sourceAudioFallbackPaths ?? []).length > 0;
			const hasAudio = videoInfo.hasAudio || hasAudioRegions || hasSourceAudioFallback;

			if (!useNativeEncoder) {
				this.muxer = new VideoMuxer(this.config, hasAudio);
				await this.muxer.initialize();
			}

			// Calculate effective duration and frame count (excluding trim regions)
			const effectiveDuration = this.streamingDecoder.getEffectiveDuration(
				this.config.trimRegions,
				this.config.speedRegions,
			);
			const totalFrames = Math.ceil(effectiveDuration * this.config.frameRate);

			console.log("[VideoExporter] Original duration:", videoInfo.duration, "s");
			console.log("[VideoExporter] Effective duration:", effectiveDuration, "s");
			console.log("[VideoExporter] Total frames to export:", totalFrames);
			console.log("[VideoExporter] Using streaming decode (web-demuxer + VideoDecoder)");
			console.log(
				`[VideoExporter] Using ${useNativeEncoder ? "native ffmpeg" : "WebCodecs"} encode path`,
			);

			const frameDuration = 1_000_000 / this.config.frameRate; // in microseconds
			let frameIndex = 0;

			// Stream decode and process frames — no seeking!
			await this.streamingDecoder.decodeAll(
				this.config.frameRate,
				this.config.trimRegions,
				this.config.speedRegions,
				async (videoFrame, _exportTimestampUs, sourceTimestampMs) => {
					if (this.cancelled) {
						videoFrame.close();
						return;
					}

					const timestamp = frameIndex * frameDuration;
					const sourceTimestampUs = sourceTimestampMs * 1000;
					await this.renderer!.renderFrame(videoFrame, sourceTimestampUs);
					videoFrame.close();

					if (useNativeEncoder) {
						await this.encodeRenderedFrameNative(timestamp);
					} else {
						await this.encodeRenderedFrame(timestamp, frameDuration, frameIndex);
					}
					frameIndex++;
					this.reportProgress(frameIndex, totalFrames);
				},
			);

			if (this.cancelled) {
				const encoderError = this.encoderError as Error | null;
				if (encoderError) {
					return { success: false, error: encoderError.message };
				}

				return { success: false, error: "Export cancelled" };
			}

			if (useNativeEncoder && nativeAudioPlan) {
				return await this.finishNativeVideoExport(nativeAudioPlan);
			}

			// Finalize encoding
			if (this.encoder && this.encoder.state === "configured") {
				await this.awaitWithWindowsTimeout(this.encoder.flush(), "encoder flush");
			}

			// Wait for queued muxing operations to complete
			await this.awaitWithWindowsTimeout(this.pendingMuxing, "muxing queued video chunks");

			if (hasAudio && !this.cancelled) {
				const demuxer = this.streamingDecoder.getDemuxer();
				if (demuxer || hasAudioRegions || hasSourceAudioFallback) {
					this.audioProcessor = new AudioProcessor();
					await this.awaitWithWindowsTimeout(
						this.audioProcessor.process(
							demuxer,
							this.muxer!,
							this.config.videoUrl,
							this.config.trimRegions,
							this.config.speedRegions,
							undefined,
							this.config.audioRegions,
							this.config.sourceAudioFallbackPaths,
						),
						"audio processing",
					);
				}
			}

			// Finalize muxer and get output blob
			const blob = await this.awaitWithWindowsTimeout(this.muxer!.finalize(), "muxer finalization");

			return { success: true, blob };
		} catch (error) {
			if (this.cancelled && !this.encoderError) {
				return { success: false, error: "Export cancelled" };
			}

			const resolvedError = this.encoderError ?? error;
			console.error("Export error:", error);
			return {
				success: false,
				error: resolvedError instanceof Error ? resolvedError.message : String(resolvedError),
			};
		} finally {
			this.cleanup();
		}
	}

	private shouldUseExperimentalNativeExport(): boolean {
		if (this.config.experimentalNativeExport === true) {
			return true;
		}

		if (typeof window !== "undefined" && !nativeExportDisabledWarningShown) {
			nativeExportDisabledWarningShown = true;
			console.info(
				"[VideoExporter] Native ffmpeg export is disabled by default until direct GPU readback is restored.",
			);
		}

		return false;
	}

	private isWindowsPlatform(): boolean {
		if (typeof navigator === "undefined") {
			return false;
		}
		return /Win/i.test(navigator.platform);
	}

	private async awaitWithWindowsTimeout<T>(promise: Promise<T>, stage: string): Promise<T> {
		if (!this.isWindowsPlatform()) {
			return promise;
		}

		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		try {
			return await Promise.race([
				promise,
				new Promise<T>((_, reject) => {
					timeoutId = setTimeout(() => {
						reject(new Error(`Export timed out during ${stage} on Windows`));
					}, this.WINDOWS_FINALIZATION_TIMEOUT_MS);
				}),
			]);
		} finally {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		}
	}

	private getNativeVideoSourcePath(): string | null {
		const resource = this.config.videoUrl;
		if (!resource) {
			return null;
		}

		if (/^file:\/\//i.test(resource)) {
			try {
				const url = new URL(resource);
				const pathname = decodeURIComponent(url.pathname);
				if (url.host && url.host !== "localhost") {
					return `//${url.host}${pathname}`;
				}
				if (/^\/[A-Za-z]:/.test(pathname)) {
					return pathname.slice(1);
				}
				return pathname;
			} catch {
				return resource.replace(/^file:\/\//i, "");
			}
		}

		if (
			resource.startsWith("/") ||
			/^[A-Za-z]:[\\/]/.test(resource) ||
			/^\\\\[^\\]+\\[^\\]+/.test(resource)
		) {
			return resource;
		}

		return null;
	}

	private buildNativeTrimSegments(durationMs: number): Array<{ startMs: number; endMs: number }> {
		const trimRegions = [...(this.config.trimRegions ?? [])].sort((a, b) => a.startMs - b.startMs);
		if (trimRegions.length === 0) {
			return [{ startMs: 0, endMs: Math.max(0, durationMs) }];
		}

		const segments: Array<{ startMs: number; endMs: number }> = [];
		let cursorMs = 0;

		for (const region of trimRegions) {
			const startMs = Math.max(0, Math.min(region.startMs, durationMs));
			const endMs = Math.max(startMs, Math.min(region.endMs, durationMs));
			if (startMs > cursorMs) {
				segments.push({ startMs: cursorMs, endMs: startMs });
			}
			cursorMs = Math.max(cursorMs, endMs);
		}

		if (cursorMs < durationMs) {
			segments.push({ startMs: cursorMs, endMs: durationMs });
		}

		return segments.filter((segment) => segment.endMs - segment.startMs > 0.5);
	}

	private buildNativeAudioPlan(videoInfo: DecodedVideoInfo): NativeAudioPlan {
		const speedRegions = this.config.speedRegions ?? [];
		const audioRegions = this.config.audioRegions ?? [];
		const sourceAudioFallbackPaths = (this.config.sourceAudioFallbackPaths ?? []).filter(
			(audioPath) => typeof audioPath === "string" && audioPath.trim().length > 0,
		);
		const localVideoSourcePath = this.getNativeVideoSourcePath();
		const primaryAudioSourcePath =
			(videoInfo.hasAudio ? localVideoSourcePath : null) ?? sourceAudioFallbackPaths[0] ?? null;

		if (!videoInfo.hasAudio && sourceAudioFallbackPaths.length === 0 && audioRegions.length === 0) {
			return { audioMode: "none" };
		}

		if (speedRegions.length > 0 || audioRegions.length > 0 || sourceAudioFallbackPaths.length > 1) {
			return { audioMode: "edited-track" };
		}

		if (!primaryAudioSourcePath) {
			return { audioMode: "edited-track" };
		}

		if ((this.config.trimRegions ?? []).length > 0) {
			const sourceDurationMs = Math.max(
				0,
				Math.round((videoInfo.streamDuration ?? videoInfo.duration) * 1000),
			);
			const trimSegments = this.buildNativeTrimSegments(sourceDurationMs);
			if (trimSegments.length === 0) {
				return { audioMode: "none" };
			}

			return {
				audioMode: "trim-source",
				audioSourcePath: primaryAudioSourcePath,
				trimSegments,
			};
		}

		return {
			audioMode: "copy-source",
			audioSourcePath: primaryAudioSourcePath,
		};
	}

	private async tryStartNativeVideoExport(): Promise<boolean> {
		if (typeof window === "undefined" || !window.electronAPI?.nativeVideoExportStart) {
			return false;
		}

		if (this.config.width % 2 !== 0 || this.config.height % 2 !== 0) {
			console.warn(
				`[VideoExporter] Native export requires even output dimensions, falling back to WebCodecs (${this.config.width}x${this.config.height})`,
			);
			return false;
		}

		const result = await window.electronAPI.nativeVideoExportStart({
			width: this.config.width,
			height: this.config.height,
			frameRate: this.config.frameRate,
			bitrate: this.config.bitrate,
			encodingMode: this.config.encodingMode ?? "balanced",
		});

		if (!result.success || !result.sessionId) {
			console.warn("[VideoExporter] Native export unavailable", result.error);
			return false;
		}

		this.nativeExportSessionId = result.sessionId;
		return true;
	}

	private async encodeRenderedFrameNative(timestamp: number): Promise<void> {
		const sessionId = this.nativeExportSessionId;
		if (!sessionId) {
			if (this.cancelled) {
				return;
			}

			throw new Error("Native export session is not active");
		}

		const frameData = await captureCanvasFrameForNativeExport(
			this.renderer!.getCanvas(),
			timestamp,
			true,
		);

		if (this.cancelled) {
			return;
		}

		const result = await window.electronAPI.nativeVideoExportWriteFrame(sessionId, frameData);
		if (!result.success) {
			if (this.cancelled || result.error === "Native video export session was cancelled") {
				return;
			}

			throw new Error(result.error || "Failed to write frame to native encoder");
		}
	}

	private async finishNativeVideoExport(audioPlan: NativeAudioPlan): Promise<ExportResult> {
		if (!this.nativeExportSessionId) {
			return { success: false, error: "Native export session is not active" };
		}

		let editedAudioBuffer: ArrayBuffer | undefined;
		let editedAudioMimeType: string | null = null;

		if (audioPlan.audioMode === "edited-track") {
			this.audioProcessor = new AudioProcessor();
			const audioBlob = await this.awaitWithWindowsTimeout(
				this.audioProcessor.renderEditedAudioTrack(
					this.config.videoUrl,
					this.config.trimRegions,
					this.config.speedRegions,
					this.config.audioRegions,
					this.config.sourceAudioFallbackPaths,
				),
				"native edited audio rendering",
			);
			editedAudioBuffer = await audioBlob.arrayBuffer();
			editedAudioMimeType = audioBlob.type || null;
		}

		const sessionId = this.nativeExportSessionId;
		this.nativeExportSessionId = null;

		const result = await this.awaitWithWindowsTimeout(
			window.electronAPI.nativeVideoExportFinish(sessionId, {
				audioMode: audioPlan.audioMode,
				audioSourcePath:
					audioPlan.audioMode === "copy-source" || audioPlan.audioMode === "trim-source"
						? audioPlan.audioSourcePath
						: null,
				trimSegments: audioPlan.audioMode === "trim-source" ? audioPlan.trimSegments : undefined,
				editedAudioData: editedAudioBuffer,
				editedAudioMimeType,
			}),
			"native export finalization",
		);

		if (!result.success || !result.data) {
			return {
				success: false,
				error: result.error || "Failed to finalize native video export",
			};
		}

		const blobData = new Uint8Array(result.data.byteLength);
		blobData.set(result.data);

		return {
			success: true,
			blob: new Blob([blobData.buffer], { type: "video/mp4" }),
		};
	}

	private async encodeRenderedFrame(timestamp: number, frameDuration: number, frameIndex: number) {
		const canvas = this.renderer!.getCanvas();

		// @ts-expect-error - colorSpace not in TypeScript definitions but works at runtime
		const exportFrame = new VideoFrame(canvas, {
			timestamp,
			duration: frameDuration,
			colorSpace: {
				primaries: "bt709",
				transfer: "iec61966-2-1",
				matrix: "rgb",
				fullRange: true,
			},
		});

		while (
			this.encoder &&
			this.encoder.encodeQueueSize >=
				Math.max(1, Math.floor(this.config.maxEncodeQueue ?? DEFAULT_MAX_ENCODE_QUEUE)) &&
			!this.cancelled
		) {
			await new Promise((resolve) => setTimeout(resolve, 5));
		}

		if (this.encoder && this.encoder.state === "configured") {
			this.encodeQueue++;
			this.encoder.encode(exportFrame, { keyFrame: frameIndex % 150 === 0 });
		} else {
			console.warn(`[Frame ${frameIndex}] Encoder not ready! State: ${this.encoder?.state}`);
		}

		exportFrame.close();
	}

	private reportProgress(currentFrame: number, totalFrames: number) {
		const nowMs = this.getNowMs();
		const elapsedSeconds = Math.max((nowMs - this.exportStartTimeMs) / 1000, 0.001);
		const averageRenderFps = currentFrame / elapsedSeconds;
		const sampleElapsedMs = Math.max(nowMs - this.progressSampleStartTimeMs, 1);
		const sampleFrameDelta = Math.max(currentFrame - this.progressSampleStartFrame, 0);
		const renderFps = (sampleFrameDelta * 1000) / sampleElapsedMs;
		const remainingFrames = Math.max(totalFrames - currentFrame, 0);
		const estimatedTimeRemaining =
			averageRenderFps > 0 ? remainingFrames / averageRenderFps : 0;

		if (sampleElapsedMs >= PROGRESS_SAMPLE_WINDOW_MS) {
			this.progressSampleStartTimeMs = nowMs;
			this.progressSampleStartFrame = currentFrame;
		}

		if (this.config.onProgress) {
			this.config.onProgress({
				currentFrame,
				totalFrames,
				percentage: totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 100,
				estimatedTimeRemaining,
				renderFps,
			});
		}
	}

	private getNowMs(): number {
		return typeof performance !== "undefined" ? performance.now() : Date.now();
	}

	private async initializeEncoder(): Promise<void> {
		this.encodeQueue = 0;
		this.pendingMuxing = Promise.resolve();
		this.chunkCount = 0;
		let videoDescription: Uint8Array | undefined;

		// Ordered from most capable to most compatible. avc1.PPCCLL where PP=profile, CC=constraints, LL=level.
		// High 5.1 → Main 5.1 → Baseline 5.1 → Main 3.1 → Baseline 3.1
		const CODEC_FALLBACK_LIST = this.config.codec
			? [this.config.codec]
			: ["avc1.640033", "avc1.4d4033", "avc1.420033", "avc1.4d401f", "avc1.42001f"];

		let resolvedCodec: string | null = null;

		this.encoder = new VideoEncoder({
			output: (chunk, meta) => {
				// Capture decoder config metadata from encoder output
				if (meta?.decoderConfig?.description && !videoDescription) {
					const desc = meta.decoderConfig.description;
					videoDescription = ArrayBuffer.isView(desc)
						? new Uint8Array(desc.buffer, desc.byteOffset, desc.byteLength)
						: new Uint8Array(desc);
					this.videoDescription = videoDescription;
				}
				// Capture colorSpace from encoder metadata if provided
				if (meta?.decoderConfig?.colorSpace && !this.videoColorSpace) {
					this.videoColorSpace = meta.decoderConfig.colorSpace;
				}

				// Stream chunks to muxer in order without retaining an ever-growing promise array
				const isFirstChunk = this.chunkCount === 0;
				this.chunkCount++;

				this.pendingMuxing = this.pendingMuxing.then(async () => {
					try {
						if (isFirstChunk && this.videoDescription) {
							// Add decoder config for the first chunk
							const colorSpace = this.videoColorSpace || {
								primaries: "bt709",
								transfer: "iec61966-2-1",
								matrix: "rgb",
								fullRange: true,
							};

							const metadata: EncodedVideoChunkMetadata = {
								decoderConfig: {
									codec: resolvedCodec ?? (this.config.codec || "avc1.640033"),
									codedWidth: this.config.width,
									codedHeight: this.config.height,
									description: this.videoDescription,
									colorSpace,
								},
							};

							await this.muxer!.addVideoChunk(chunk, metadata);
						} else {
							await this.muxer!.addVideoChunk(chunk, meta);
						}
					} catch (error) {
						console.error("Muxing error:", error);
					}
				});
				this.encodeQueue--;
			},
			error: (error) => {
				console.error(
					`[VideoExporter] Encoder error (codec: ${resolvedCodec}, ${this.config.width}x${this.config.height}):`,
					error,
				);
				this.encoderError = error instanceof Error ? error : new Error(String(error));
				this.cancelled = true;
			},
		});

		const baseConfig: Omit<VideoEncoderConfig, "codec" | "hardwareAcceleration"> = {
			width: this.config.width,
			height: this.config.height,
			bitrate: this.config.bitrate,
			framerate: this.config.frameRate,
			latencyMode: "quality",
			bitrateMode: "variable",
		};

		for (const candidateCodec of CODEC_FALLBACK_LIST) {
			const hwConfig: VideoEncoderConfig = {
				...baseConfig,
				codec: candidateCodec,
				hardwareAcceleration: "prefer-hardware",
			};
			const hwSupport = await VideoEncoder.isConfigSupported(hwConfig);
			if (hwSupport.supported) {
				resolvedCodec = candidateCodec;
				console.log(`[VideoExporter] Using hardware acceleration with codec ${candidateCodec}`);
				this.encoder.configure(hwConfig);
				return;
			}

			const swConfig: VideoEncoderConfig = {
				...baseConfig,
				codec: candidateCodec,
				hardwareAcceleration: "prefer-software",
			};
			const swSupport = await VideoEncoder.isConfigSupported(swConfig);
			if (swSupport.supported) {
				resolvedCodec = candidateCodec;
				console.log(`[VideoExporter] Using software encoding with codec ${candidateCodec}`);
				this.encoder.configure(swConfig);
				return;
			}

			console.warn(
				`[VideoExporter] Codec ${candidateCodec} not supported (${this.config.width}x${this.config.height}), trying next...`,
			);
		}

		throw new Error(
			`Video encoding not supported on this system. ` +
				`Tried codecs: ${CODEC_FALLBACK_LIST.join(", ")} at ${this.config.width}x${this.config.height}. ` +
				`Your browser or hardware may not support H.264 encoding at this resolution. ` +
				`Try exporting at a lower quality setting.`,
		);
	}

	cancel(): void {
		this.cancelled = true;
		if (this.streamingDecoder) {
			this.streamingDecoder.cancel();
		}
		if (this.audioProcessor) {
			this.audioProcessor.cancel();
		}
		this.cleanup();
	}

	private cleanup(): void {
		if (this.nativeExportSessionId) {
			if (typeof window !== "undefined") {
				void window.electronAPI?.nativeVideoExportCancel?.(this.nativeExportSessionId);
			}
			this.nativeExportSessionId = null;
		}

		if (this.encoder) {
			try {
				if (this.encoder.state === "configured") {
					this.encoder.close();
				}
			} catch (e) {
				console.warn("Error closing encoder:", e);
			}
			this.encoder = null;
		}

		if (this.streamingDecoder) {
			try {
				this.streamingDecoder.destroy();
			} catch (e) {
				console.warn("Error destroying streaming decoder:", e);
			}
			this.streamingDecoder = null;
		}

		if (this.renderer) {
			try {
				this.renderer.destroy();
			} catch (e) {
				console.warn("Error destroying renderer:", e);
			}
			this.renderer = null;
		}

		if (this.muxer) {
			try {
				this.muxer.destroy();
			} catch (e) {
				console.warn("Error destroying muxer:", e);
			}
		}

		this.muxer = null;
		this.audioProcessor = null;
		this.encodeQueue = 0;
		this.pendingMuxing = Promise.resolve();
		this.chunkCount = 0;
		this.encoderError = null;
		this.videoDescription = undefined;
		this.videoColorSpace = undefined;
	}
}
