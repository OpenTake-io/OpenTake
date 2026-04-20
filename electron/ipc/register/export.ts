import type { ChildProcessByStdio } from "node:child_process";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { Readable, Writable } from "node:stream";
import type { SaveDialogOptions } from "electron";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import {
	enqueueNativeVideoExportFrameWrite,
	flushNativeVideoExportPendingWriteRequests,
	getNativeVideoExportMaxQueuedWriteBytes,
	getNativeVideoExportSessionError,
	isHardwareAcceleratedVideoEncoder,
	isIgnorableNativeVideoExportStreamError,
	muxExportedVideoAudioBuffer,
	muxNativeVideoExportAudio,
	type NativeVideoExportSession,
	nativeVideoExportSessions,
	removeTemporaryExportFile,
	resolveNativeVideoEncoder,
	sendNativeVideoExportWriteFrameResult,
	settleNativeVideoExportWriteFrameRequest,
} from "../export/native-video";
import { getFfmpegBinaryPath } from "../ffmpeg/binary";
import {
	buildNativeH264StreamExportArgs,
	buildNativeVideoExportArgs,
	getNativeVideoInputByteSize,
	type NativeExportEncodingMode,
	type NativeVideoExportFinishOptions,
} from "../nativeVideoExport";
import { approveUserPath } from "../utils";

export function registerExportHandlers() {
	ipcMain.handle(
		"native-video-export-start",
		async (
			event,
			options: {
				width: number;
				height: number;
				frameRate: number;
				bitrate: number;
				encodingMode: NativeExportEncodingMode;
				inputMode?: "rawvideo" | "h264-stream";
			},
		) => {
			try {
				if (options.width % 2 !== 0 || options.height % 2 !== 0) {
					throw new Error("Native export requires even output dimensions");
				}

				const ffmpegPath = getFfmpegBinaryPath();
				const inputMode = options.inputMode ?? "rawvideo";
				const sessionId = `recordly-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
				const outputPath = path.join(app.getPath("temp"), `${sessionId}.mp4`);

				let encoderName: string;
				let ffmpegArgs: string[];

				if (inputMode === "h264-stream") {
					// Pre-encoded H.264 Annex B from browser VideoEncoder — just stream-copy into MP4
					encoderName = "h264-stream-copy";
					ffmpegArgs = buildNativeH264StreamExportArgs({
						frameRate: options.frameRate,
						outputPath,
					});
				} else {
					encoderName = await resolveNativeVideoEncoder(ffmpegPath, options.encodingMode);
					ffmpegArgs = buildNativeVideoExportArgs(encoderName, options, outputPath);
				}

				const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
					stdio: ["pipe", "ignore", "pipe"],
				}) as ChildProcessByStdio<Writable, null, Readable>;
				// For rawvideo, frames are a fixed RGBA size. For h264-stream, chunks are variable.
				const inputByteSize =
					inputMode === "rawvideo"
						? getNativeVideoInputByteSize(options.width, options.height)
						: 0;

				const session: NativeVideoExportSession = {
					ffmpegProcess,
					outputPath,
					inputByteSize,
					inputMode,
					maxQueuedWriteBytes:
						inputMode === "h264-stream"
							? 8 * 1024 * 1024
							: getNativeVideoExportMaxQueuedWriteBytes(inputByteSize),
					stderrOutput: "",
					encoderName,
					processError: null,
					stdinError: null,
					terminating: false,
					writeSequence: Promise.resolve(),
					sender: event.sender,
					pendingWriteRequestIds: new Set<number>(),
					completionPromise: new Promise<void>((resolve, reject) => {
						ffmpegProcess.once("error", (error) => {
							const processError =
								error instanceof Error ? error : new Error(String(error));
							if (session.terminating) {
								resolve();
								return;
							}

							session.processError = processError;
							reject(processError);
						});
						ffmpegProcess.stdin.once("error", (error) => {
							const stdinError =
								error instanceof Error ? error : new Error(String(error));
							if (
								session.terminating &&
								isIgnorableNativeVideoExportStreamError(stdinError)
							) {
								return;
							}

							session.stdinError = stdinError;
						});
						ffmpegProcess.once("close", (code, signal) => {
							if (session.terminating) {
								resolve();
								return;
							}

							if (code === 0) {
								resolve();
								return;
							}

							reject(
								new Error(
									getNativeVideoExportSessionError(
										session,
										`FFmpeg exited with code ${code ?? "unknown"}${signal ? ` (signal ${signal})` : ""}`,
									),
								),
							);
						});
					}),
				};
				void session.completionPromise.catch(() => undefined);

				ffmpegProcess.stderr.on("data", (chunk: Buffer) => {
					session.stderrOutput += chunk.toString();
				});

				nativeVideoExportSessions.set(sessionId, session);

				console.log(
					`[native-export] Started ${isHardwareAcceleratedVideoEncoder(encoderName) ? "hardware" : "software"} session ${sessionId} with ${encoderName}`,
				);

				return {
					success: true,
					sessionId,
					encoderName,
				};
			} catch (error) {
				console.error(
					"[native-export] Failed to start native video export session:",
					error,
				);
				return {
					success: false,
					error: String(error),
				};
			}
		},
	);

	ipcMain.on(
		"native-video-export-write-frame-async",
		(
			event,
			payload: {
				sessionId: string;
				requestId: number;
				frameData: Uint8Array;
			},
		) => {
			const sessionId = payload?.sessionId;
			const requestId = payload?.requestId;
			const frameData = payload?.frameData;

			if (typeof sessionId !== "string" || typeof requestId !== "number" || !frameData) {
				return;
			}

			const session = nativeVideoExportSessions.get(sessionId);
			if (!session) {
				sendNativeVideoExportWriteFrameResult(event.sender, sessionId, requestId, {
					success: false,
					error: "Invalid native export session",
				});
				return;
			}

			session.sender = event.sender;
			session.pendingWriteRequestIds.add(requestId);

			if (session.terminating) {
				settleNativeVideoExportWriteFrameRequest(sessionId, session, requestId, {
					success: false,
					error: "Native video export session was cancelled",
				});
				return;
			}

			if (
				session.inputMode !== "h264-stream" &&
				frameData.byteLength !== session.inputByteSize
			) {
				settleNativeVideoExportWriteFrameRequest(sessionId, session, requestId, {
					success: false,
					error: `Native video export expected ${session.inputByteSize} bytes per frame but received ${frameData.byteLength}`,
				});
				return;
			}

			void enqueueNativeVideoExportFrameWrite(session, frameData)
				.then(() => {
					settleNativeVideoExportWriteFrameRequest(sessionId, session, requestId, {
						success: true,
					});
				})
				.catch((error) => {
					session.stdinError = error instanceof Error ? error : new Error(String(error));
					settleNativeVideoExportWriteFrameRequest(sessionId, session, requestId, {
						success: false,
						error: getNativeVideoExportSessionError(
							session,
							session.stdinError.message,
						),
					});
				});
		},
	);

	ipcMain.handle(
		"native-video-export-finish",
		async (_, sessionId: string, options?: NativeVideoExportFinishOptions) => {
			const session = nativeVideoExportSessions.get(sessionId);
			if (!session) {
				return { success: false, error: "Invalid native export session" };
			}

			try {
				await session.writeSequence;
				if (
					!session.ffmpegProcess.stdin.destroyed &&
					!session.ffmpegProcess.stdin.writableEnded
				) {
					session.ffmpegProcess.stdin.end();
				}
				await session.completionPromise;

				const finalized = await muxNativeVideoExportAudio(
					session.outputPath,
					options ?? {},
				);
				const muxedVideoReadStartedAt = performance.now();
				const data = await fs.readFile(finalized.outputPath);
				nativeVideoExportSessions.delete(sessionId);
				await removeTemporaryExportFile(finalized.outputPath);

				return {
					success: true,
					data: new Uint8Array(data),
					encoderName: session.encoderName,
					metrics: {
						...finalized.metrics,
						muxedVideoReadMs: performance.now() - muxedVideoReadStartedAt,
						muxedVideoBytes: data.byteLength,
					},
				};
			} catch (error) {
				flushNativeVideoExportPendingWriteRequests(sessionId, session, String(error));
				nativeVideoExportSessions.delete(sessionId);
				await removeTemporaryExportFile(session.outputPath);
				const finalizedSuffix = session.outputPath.replace(/\.mp4$/, "-final.mp4");
				await removeTemporaryExportFile(finalizedSuffix);
				return {
					success: false,
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle(
		"mux-exported-video-audio",
		async (_, videoData: ArrayBuffer, options?: NativeVideoExportFinishOptions) => {
			try {
				const result = await muxExportedVideoAudioBuffer(videoData, options ?? {});
				return {
					success: true,
					data: result.data,
					metrics: result.metrics,
				};
			} catch (error) {
				return {
					success: false,
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle("native-video-export-cancel", async (_, sessionId: string) => {
		const session = nativeVideoExportSessions.get(sessionId);
		if (!session) {
			return { success: true };
		}

		session.terminating = true;
		nativeVideoExportSessions.delete(sessionId);
		flushNativeVideoExportPendingWriteRequests(
			sessionId,
			session,
			"Native video export session was cancelled",
		);

		try {
			if (
				!session.ffmpegProcess.stdin.destroyed &&
				!session.ffmpegProcess.stdin.writableEnded
			) {
				session.ffmpegProcess.stdin.destroy();
			}
		} catch {
			// Stream may already be closed.
		}

		try {
			session.ffmpegProcess.kill("SIGKILL");
		} catch {
			// Process may already be closed.
		}

		await session.completionPromise.catch(() => undefined);
		await removeTemporaryExportFile(session.outputPath);
		return { success: true };
	});

	ipcMain.handle(
		"save-exported-video",
		async (event, videoData: ArrayBuffer, fileName: string) => {
			try {
				// Determine file type from extension
				const isGif = fileName.toLowerCase().endsWith(".gif");
				const filters = isGif
					? [{ name: "GIF Image", extensions: ["gif"] }]
					: [{ name: "MP4 Video", extensions: ["mp4"] }];
				const parentWindow = BrowserWindow.fromWebContents(event.sender);
				const saveDialogOptions: SaveDialogOptions = {
					title: isGif ? "Save Exported GIF" : "Save Exported Video",
					defaultPath: path.join(app.getPath("downloads"), fileName),
					filters,
					properties: ["createDirectory", "showOverwriteConfirmation"],
				};

				const result = parentWindow
					? await dialog.showSaveDialog(parentWindow, saveDialogOptions)
					: await dialog.showSaveDialog(saveDialogOptions);

				if (result.canceled || !result.filePath) {
					return {
						success: false,
						canceled: true,
						message: "Export canceled",
					};
				}

				await fs.writeFile(result.filePath, Buffer.from(videoData));
				approveUserPath(result.filePath);

				return {
					success: true,
					path: result.filePath,
					message: "Video exported successfully",
				};
			} catch (error) {
				console.error("Failed to save exported video:", error);
				return {
					success: false,
					message: "Failed to save exported video",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle(
		"write-exported-video-to-path",
		async (_event, videoData: ArrayBuffer, outputPath: string) => {
			try {
				const resolvedPath = path.resolve(outputPath);
				await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
				await fs.writeFile(resolvedPath, Buffer.from(videoData));
				approveUserPath(resolvedPath);

				return {
					success: true,
					path: resolvedPath,
					message: "Video exported successfully",
					canceled: false,
				};
			} catch (error) {
				console.error("Failed to write exported video to path:", error);
				return {
					success: false,
					message: "Failed to write exported video",
					canceled: false,
					error: String(error),
				};
			}
		},
	);
}
