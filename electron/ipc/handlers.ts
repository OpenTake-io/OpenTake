import type { ChildProcessByStdio, ChildProcessWithoutNullStreams } from "node:child_process";
import { execFile, spawn } from "node:child_process";
import { existsSync, constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { Readable, Writable } from "node:stream";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { SaveDialogOptions } from "electron";
import {
	app,
	BrowserWindow,
	desktopCapturer,
	dialog,
	ipcMain,
	shell,
	systemPreferences,
} from "electron";
import { RECORDINGS_DIR, USER_DATA_PATH } from "../appPaths";
import { hideCursor, showCursor } from "../cursorHider";
import { closeCountdownWindow, createCountdownWindow, getCountdownWindow } from "../windows";
import {
	buildNativeH264StreamExportArgs,
	buildNativeVideoExportArgs,
	getNativeVideoInputByteSize,
	type NativeExportEncodingMode,
	type NativeVideoExportFinishOptions,
} from "./nativeVideoExport";
import { resolveWindowsCaptureDisplay } from "./windowsCaptureSelection";
import {
	PROJECT_FILE_EXTENSION,
	LEGACY_PROJECT_FILE_EXTENSIONS,
	SHORTCUTS_FILE,
	RECORDINGS_SETTINGS_FILE,
	COUNTDOWN_SETTINGS_FILE,
	ALLOW_RECORDLY_WINDOW_CAPTURE,
	CURSOR_SAMPLE_INTERVAL_MS,
} from "./constants";
import type {
	SelectedSource,
	NativeMacRecordingOptions,
	PauseSegment,
	SystemCursorAsset,
	CursorTelemetryPoint,
} from "./types";
import {
	selectedSource,
	setSelectedSource,
	currentProjectPath,
	setCurrentProjectPath,
	nativeScreenRecordingActive,
	setNativeScreenRecordingActive,
	currentVideoPath,
	setCurrentVideoPath,
	currentRecordingSession,
	setCurrentRecordingSession,
	approvedLocalReadPaths,
	nativeCaptureProcess,
	setNativeCaptureProcess,
	nativeCaptureOutputBuffer,
	setNativeCaptureOutputBuffer,
	nativeCaptureTargetPath,
	setNativeCaptureTargetPath,
	setNativeCaptureStopRequested,
	nativeCaptureSystemAudioPath,
	setNativeCaptureSystemAudioPath,
	nativeCaptureMicrophonePath,
	setNativeCaptureMicrophonePath,
	nativeCapturePaused,
	setNativeCapturePaused,
	windowsCaptureProcess,
	setWindowsCaptureProcess,
	windowsCaptureOutputBuffer,
	setWindowsCaptureOutputBuffer,
	windowsCaptureTargetPath,
	setWindowsCaptureTargetPath,
	windowsNativeCaptureActive,
	setWindowsNativeCaptureActive,
	setWindowsCaptureStopRequested,
	windowsCapturePaused,
	setWindowsCapturePaused,
	windowsSystemAudioPath,
	setWindowsSystemAudioPath,
	windowsMicAudioPath,
	setWindowsMicAudioPath,
	windowsPendingVideoPath,
	setWindowsPendingVideoPath,
	lastNativeCaptureDiagnostics,
	ffmpegScreenRecordingActive,
	setFfmpegScreenRecordingActive,
	ffmpegCaptureProcess,
	setFfmpegCaptureProcess,
	ffmpegCaptureOutputBuffer,
	setFfmpegCaptureOutputBuffer,
	ffmpegCaptureTargetPath,
	setFfmpegCaptureTargetPath,
	cachedSystemCursorAssets,
	setCachedSystemCursorAssets,
	cachedSystemCursorAssetsSourceMtimeMs,
	setCachedSystemCursorAssetsSourceMtimeMs,
	countdownTimer,
	setCountdownTimer,
	countdownCancelled,
	setCountdownCancelled,
	countdownInProgress,
	setCountdownInProgress,
	countdownRemaining,
	setCountdownRemaining,
	setCursorCaptureInterval,
	setCursorCaptureStartTimeMs,
	setActiveCursorSamples,
	setPendingCursorSamples,
	setIsCursorCaptureActive,
	setLastLeftClick,
	setLinuxCursorScreenPoint,
} from "./state";
import { getFfmpegBinaryPath } from "./ffmpeg/binary";
import {
	sendWhisperModelDownloadProgress,
	getWhisperSmallModelStatus,
	downloadWhisperSmallModel,
	deleteWhisperSmallModel,
} from "./captions/whisper";
import {
	getNativeCaptureHelperBinaryPath,
	getSystemCursorHelperSourcePath,
	getSystemCursorHelperBinaryPath,
	ensureSwiftHelperBinary,
	getWindowsCaptureExePath,
	ensureNativeCaptureHelperBinary,
} from "./paths/binaries";
import {
	stopNativeCursorMonitor,
	startNativeCursorMonitor,
} from "./cursor/monitor";
import { getScreen, normalizePath, normalizeVideoSourcePath, parseWindowId, getTelemetryPathForVideo, isAutoRecordingPath, moveFileWithOverwrite, getRecordingsDir } from "./utils";
import { recordNativeCaptureDiagnostics, getFileSizeIfPresent, getCompanionAudioFallbackPaths } from "./recording/diagnostics";
import { getProjectsDir, persistRecordingsDirectorySetting, saveProjectThumbnail, rememberRecentProject, listProjectLibraryEntries, loadProjectFromPath, isAllowedLocalReadPath, rememberApprovedLocalReadPath, replaceApprovedSessionLocalReadPaths, getAssetRootPath } from "./project/manager";
import { persistRecordingSessionManifest, resolveRecordingSession } from "./project/session";
import {
	nativeVideoExportSessions,
	getNativeVideoExportMaxQueuedWriteBytes,
	isHardwareAcceleratedVideoEncoder,
	removeTemporaryExportFile,
	getNativeVideoExportSessionError,
	sendNativeVideoExportWriteFrameResult,
	settleNativeVideoExportWriteFrameRequest,
	flushNativeVideoExportPendingWriteRequests,
	isIgnorableNativeVideoExportStreamError,
	enqueueNativeVideoExportFrameWrite,
	resolveNativeVideoEncoder,
	muxNativeVideoExportAudio,
	muxExportedVideoAudioBuffer,
	type NativeVideoExportSession,
} from "./export/native-video";
import { generateAutoCaptionsFromVideo } from "./captions/generate";
import { buildFfmpegCaptureArgs, waitForFfmpegCaptureStart, waitForFfmpegCaptureStop, getDisplayBoundsForSource } from "./recording/ffmpeg";
import { isNativeWindowsCaptureAvailable, waitForWindowsCaptureStart, waitForWindowsCaptureStop, attachWindowsCaptureLifecycle, muxNativeWindowsVideoWithAudio } from "./recording/windows";
import { waitForNativeCaptureStart, waitForNativeCaptureStop, muxNativeMacRecordingWithAudio, attachNativeCaptureLifecycle, finalizeStoredVideo, recoverNativeMacCaptureOutput } from "./recording/mac";
import { clamp, stopCursorCapture, sampleCursorPoint, snapshotCursorTelemetryForPersistence } from "./cursor/telemetry";
import { getNativeMacWindowSources, stopWindowBoundsCapture, resolveMacWindowBounds, startWindowBoundsCapture, resolveLinuxWindowBounds, resolveWindowsWindowBounds } from "./cursor/bounds";
import { startInteractionCapture, stopInteractionCapture } from "./cursor/interaction";

export { cleanupNativeVideoExportSessions } from "./export/native-video";

const execFileAsync = promisify(execFile);

function normalizeRecordingTimeOffsetMs(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

function broadcastSelectedSourceChange() {
	for (const window of BrowserWindow.getAllWindows()) {
		if (!window.isDestroyed()) {
			window.webContents.send("selected-source-changed", selectedSource);
		}
	}
}


/** Returns the currently selected source ID for setDisplayMediaRequestHandler */

export function getSelectedSourceId(): string | null {
	return (selectedSource?.id as string | null) ?? null;
}

export function killWindowsCaptureProcess() {
	if (windowsCaptureProcess) {
		try {
			windowsCaptureProcess.kill();
		} catch {
			/* ignore */
		}
		setWindowsCaptureProcess(null);
		setWindowsCaptureTargetPath(null);
		setWindowsNativeCaptureActive(false);
		setNativeScreenRecordingActive(false);
		setWindowsCaptureStopRequested(false);
		setWindowsCapturePaused(false);
		setWindowsSystemAudioPath(null);
		setWindowsMicAudioPath(null);
		setWindowsPendingVideoPath(null);
	}
}

function normalizeDesktopSourceName(value: string) {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function hasUsableSourceThumbnail(
	thumbnail:
		| {
				isEmpty: () => boolean;
				getSize: () => { width: number; height: number };
		  }
		| null
		| undefined,
) {
	if (!thumbnail || thumbnail.isEmpty()) {
		return false;
	}

	const size = thumbnail.getSize();
	return size.width > 1 && size.height > 1;
}

function getMacPrivacySettingsUrl(pane: "screen" | "accessibility" | "microphone") {
	if (pane === "screen")
		return "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";
	if (pane === "microphone")
		return "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";
	return "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
}


function approveUserPath(filePath: string | null | undefined) {
	if (!filePath) {
		return;
	}

	try {
		approvedLocalReadPaths.add(path.resolve(filePath));
	} catch {
		// Ignore invalid paths; later reads will surface the underlying error.
	}
}

async function getSystemCursorAssets() {
	if (process.platform !== "darwin") {
		setCachedSystemCursorAssets({});
		setCachedSystemCursorAssetsSourceMtimeMs(null);
		return cachedSystemCursorAssets ?? {};
	}

	const sourcePath = getSystemCursorHelperSourcePath();
	const sourceStat = await fs.stat(sourcePath);
	if (cachedSystemCursorAssets && cachedSystemCursorAssetsSourceMtimeMs === sourceStat.mtimeMs) {
		return cachedSystemCursorAssets;
	}

	const binaryPath = await ensureSwiftHelperBinary(
		sourcePath,
		getSystemCursorHelperBinaryPath(),
		"system cursor helper",
		"recordly-system-cursors",
	);

	const { stdout } = await execFileAsync(binaryPath, [], {
		timeout: 15000,
		maxBuffer: 20 * 1024 * 1024,
	});
	const parsed = JSON.parse(stdout) as Record<string, Partial<SystemCursorAsset>>;
	const result = Object.fromEntries(
		Object.entries(parsed).filter(
			([, asset]) =>
				typeof asset?.dataUrl === "string" &&
				typeof asset?.hotspotX === "number" &&
				typeof asset?.hotspotY === "number" &&
				typeof asset?.width === "number" &&
				typeof asset?.height === "number",
		),
	) as Record<string, SystemCursorAsset>;
	setCachedSystemCursorAssets(result);
	setCachedSystemCursorAssetsSourceMtimeMs(sourceStat.mtimeMs);

	return result;
}

function isTrustedProjectPath(filePath?: string | null) {
	if (!filePath || !currentProjectPath) {
		return false;
	}
	return normalizePath(filePath) === normalizePath(currentProjectPath);
}

export function registerIpcHandlers(
	createEditorWindow: () => void,
	createSourceSelectorWindow: () => BrowserWindow,
	_getMainWindow: () => BrowserWindow | null,
	getSourceSelectorWindow: () => BrowserWindow | null,
	onRecordingStateChange?: (recording: boolean, sourceName: string) => void,
) {
	ipcMain.handle("get-sources", async (_, opts) => {
		const includeScreens = Array.isArray(opts?.types) ? opts.types.includes("screen") : true;
		const includeWindows = Array.isArray(opts?.types) ? opts.types.includes("window") : true;
		const electronTypes = [
			...(includeScreens ? ["screen" as const] : []),
			...(includeWindows ? ["window" as const] : []),
		];
		const electronSources =
			electronTypes.length > 0
				? await desktopCapturer
						.getSources({
							...opts,
							types: electronTypes,
						})
						.catch((error) => {
							console.warn(
								"desktopCapturer.getSources failed (screen recording permission may be missing):",
								error,
							);
							return [];
						})
				: [];
		const ownWindowNames = new Set(
			[
				app.getName(),
				"Recordly",
				...BrowserWindow.getAllWindows().flatMap((win) => {
					const title = win.getTitle().trim();
					return title ? [title] : [];
				}),
			]
				.map((name) => normalizeDesktopSourceName(name))
				.filter(Boolean),
		);
		const ownAppName = normalizeDesktopSourceName(app.getName());

		const displays = includeScreens
			? [...getScreen().getAllDisplays()].sort(
					(left, right) =>
						left.bounds.x - right.bounds.x ||
						left.bounds.y - right.bounds.y ||
						left.id - right.id,
				)
			: [];
		const primaryDisplayId = includeScreens ? String(getScreen().getPrimaryDisplay().id) : "";
		const electronScreenSourcesByDisplayId = new Map(
			electronSources
				.filter((source) => source.id.startsWith("screen:"))
				.map((source) => [String(source.display_id ?? ""), source] as const),
		);

		const screenSources = displays.map((display, index) => {
			const displayId = String(display.id);
			const matchedSource = electronScreenSourcesByDisplayId.get(displayId);
			const displayName =
				displayId === primaryDisplayId
					? `Screen ${index + 1} (Primary)`
					: `Screen ${index + 1}`;

			return {
				id: matchedSource?.id ?? `screen:fallback:${displayId}`,
				name: displayName,
				originalName: matchedSource?.name ?? displayName,
				display_id: displayId,
				thumbnail: matchedSource?.thumbnail ? matchedSource.thumbnail.toDataURL() : null,
				appIcon: matchedSource?.appIcon ? matchedSource.appIcon.toDataURL() : null,
				sourceType: "screen" as const,
			};
		});

		if (process.platform !== "darwin" || !includeWindows) {
			const windowSources = electronSources
				.filter((source) => source.id.startsWith("window:"))
				.filter((source) => hasUsableSourceThumbnail(source.thumbnail))
				.filter((source) => {
					const normalizedName = normalizeDesktopSourceName(source.name);
					if (!normalizedName) {
						return true;
					}

					if (ALLOW_RECORDLY_WINDOW_CAPTURE && normalizedName.includes("recordly")) {
						return true;
					}

					for (const ownName of ownWindowNames) {
						if (!ownName) continue;
						if (normalizedName === ownName) {
							return false;
						}
					}

					return true;
				})
				.map((source) => ({
					id: source.id,
					name: source.name,
					originalName: source.name,
					display_id: source.display_id,
					thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
					appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
					sourceType: "window" as const,
				}));

			return [...screenSources, ...windowSources];
		}

		try {
			const nativeWindowSources = await getNativeMacWindowSources();
			const electronWindowSourceMap = new Map(
				electronSources
					.filter((source) => source.id.startsWith("window:"))
					.map((source) => [source.id, source] as const),
			);

			const mergedWindowSources = nativeWindowSources
				.filter((source) => {
					const normalizedWindowName = normalizeDesktopSourceName(
						source.windowTitle ?? source.name,
					);
					const normalizedAppName = normalizeDesktopSourceName(source.appName ?? "");

					if (
						!ALLOW_RECORDLY_WINDOW_CAPTURE &&
						normalizedAppName &&
						normalizedAppName === ownAppName
					) {
						return false;
					}

					if (
						ALLOW_RECORDLY_WINDOW_CAPTURE &&
						(normalizedAppName === "recordly" ||
							normalizedWindowName?.includes("recordly"))
					) {
						return true;
					}

					if (!normalizedWindowName) {
						return true;
					}

					for (const ownName of ownWindowNames) {
						if (!ownName) continue;
						if (normalizedWindowName === ownName) {
							return false;
						}
					}

					return true;
				})
				.map((source) => {
					const electronWindowSource = electronWindowSourceMap.get(source.id);
					return {
						id: source.id,
						name: source.name,
						originalName: source.name,
						display_id: source.display_id ?? electronWindowSource?.display_id ?? "",
						thumbnail: electronWindowSource?.thumbnail
							? electronWindowSource.thumbnail.toDataURL()
							: null,
						appIcon:
							source.appIcon ??
							(electronWindowSource?.appIcon
								? electronWindowSource.appIcon.toDataURL()
								: null),
						appName: source.appName,
						windowTitle: source.windowTitle,
						sourceType: "window" as const,
					};
				});

			return [...screenSources, ...mergedWindowSources];
		} catch (error) {
			console.warn("Falling back to Electron window enumeration on macOS:", error);

			const windowSources = electronSources
				.filter((source) => source.id.startsWith("window:"))
				.filter((source) => {
					const normalizedName = normalizeDesktopSourceName(source.name);
					if (!normalizedName) {
						return true;
					}

					if (ALLOW_RECORDLY_WINDOW_CAPTURE && normalizedName.includes("recordly")) {
						return true;
					}

					for (const ownName of ownWindowNames) {
						if (!ownName) continue;
						if (
							normalizedName === ownName ||
							normalizedName.includes(ownName) ||
							ownName.includes(normalizedName)
						) {
							return false;
						}
					}

					return true;
				})
				.map((source) => ({
					id: source.id,
					name: source.name,
					originalName: source.name,
					display_id: source.display_id,
					thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null,
					appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
					sourceType: "window" as const,
				}));

			return [...screenSources, ...windowSources];
		}
	});

	ipcMain.handle("select-source", (_, source: SelectedSource) => {
		setSelectedSource(source);
		broadcastSelectedSourceChange();
		stopWindowBoundsCapture();
		const sourceSelectorWin = getSourceSelectorWindow();
		if (sourceSelectorWin) {
			sourceSelectorWin.close();
		}
		return selectedSource;
	});

	ipcMain.handle("show-source-highlight", async (_, source: SelectedSource) => {
		try {
			const isWindow = source.id?.startsWith("window:");
			const windowId = isWindow ? parseWindowId(source.id) : null;

			// ── 1. Bring window to front ──
			if (isWindow && process.platform === "darwin") {
				const appName = source.appName || source.name?.split(" — ")[0]?.trim();
				if (appName) {
					try {
						await execFileAsync(
							"osascript",
							["-e", `tell application "${appName}" to activate`],
							{ timeout: 2000 },
						);
						await new Promise((resolve) => setTimeout(resolve, 350));
					} catch {
						/* ignore */
					}
				}
			} else if (windowId && process.platform === "linux") {
				try {
					await execFileAsync("wmctrl", ["-i", "-a", `0x${windowId.toString(16)}`], {
						timeout: 1500,
					});
				} catch {
					try {
						await execFileAsync("xdotool", ["windowactivate", String(windowId)], {
							timeout: 1500,
						});
					} catch {
						/* not available */
					}
				}
				await new Promise((resolve) => setTimeout(resolve, 250));
			}

			// ── 2. Resolve bounds ──
			let bounds: { x: number; y: number; width: number; height: number } | null = null;

			if (source.id?.startsWith("screen:")) {
				bounds = getDisplayBoundsForSource(source);
			} else if (isWindow) {
				if (process.platform === "darwin") {
					bounds = await resolveMacWindowBounds(source);
				} else if (process.platform === "win32") {
					bounds = await resolveWindowsWindowBounds(source);
				} else if (process.platform === "linux") {
					bounds = await resolveLinuxWindowBounds(source);
				}
			}

			if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
				bounds = getDisplayBoundsForSource(source);
			}

			// ── 3. Show traveling wave highlight ──
			const pad = 6;
			const highlightWin = new BrowserWindow({
				x: bounds.x - pad,
				y: bounds.y - pad,
				width: bounds.width + pad * 2,
				height: bounds.height + pad * 2,
				frame: false,
				transparent: true,
				alwaysOnTop: true,
				skipTaskbar: true,
				hasShadow: false,
				resizable: false,
				focusable: false,
				webPreferences: { nodeIntegration: false, contextIsolation: true },
			});

			highlightWin.setIgnoreMouseEvents(true);

			const html = `<!DOCTYPE html>
<html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:transparent;overflow:hidden;width:100vw;height:100vh}

.border-wrap{
  position:fixed;inset:0;border-radius:10px;padding:3px;
  background:conic-gradient(from var(--angle,0deg),
    transparent 0%,
    transparent 60%,
    rgba(99,96,245,.15) 70%,
    rgba(99,96,245,.9) 80%,
    rgba(123,120,255,1) 85%,
    rgba(99,96,245,.9) 90%,
    rgba(99,96,245,.15) 95%,
    transparent 100%
  );
  -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
  -webkit-mask-composite:xor;
  mask-composite:exclude;
  animation:spin 1.2s linear forwards, fadeAll 1.6s ease-out forwards;
}

.glow-wrap{
  position:fixed;inset:-4px;border-radius:14px;padding:6px;
  background:conic-gradient(from var(--angle,0deg),
    transparent 0%,
    transparent 65%,
    rgba(99,96,245,.3) 78%,
    rgba(123,120,255,.5) 85%,
    rgba(99,96,245,.3) 92%,
    transparent 100%
  );
  -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
  -webkit-mask-composite:xor;
  mask-composite:exclude;
  filter:blur(8px);
  animation:spin 1.2s linear forwards, fadeAll 1.6s ease-out forwards;
}

@property --angle{
  syntax:'<angle>';
  initial-value:0deg;
  inherits:false;
}

@keyframes spin{
  0%{--angle:0deg}
  100%{--angle:360deg}
}

@keyframes fadeAll{
  0%,60%{opacity:1}
  100%{opacity:0}
}
</style></head><body>
<div class="glow-wrap"></div>
<div class="border-wrap"></div>
</body></html>`

      await highlightWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      setTimeout(() => {
        if (!highlightWin.isDestroyed()) highlightWin.close()
      }, 1700)

      return { success: true }
    } catch (error) {
      console.error('Failed to show source highlight:', error)
      return { success: false }
    }
  })

  ipcMain.handle('get-selected-source', () => {
    return selectedSource
  })

  ipcMain.handle('open-source-selector', () => {
    const sourceSelectorWin = getSourceSelectorWindow()
    if (sourceSelectorWin) {
      sourceSelectorWin.focus()
      return
    }
    createSourceSelectorWindow()
  })
  ipcMain.handle('switch-to-editor', () => {
    console.log('[switch-to-editor] Opening editor window')
    const sourceSelectorWin = getSourceSelectorWindow()
    if (sourceSelectorWin && !sourceSelectorWin.isDestroyed()) {
      sourceSelectorWin.close()
    }
    createEditorWindow()
  })

  ipcMain.handle('start-native-screen-recording', async (_, source: SelectedSource, options?: NativeMacRecordingOptions) => {
    // Windows native capture path
    if (process.platform === 'win32') {
      const windowsCaptureAvailable = await isNativeWindowsCaptureAvailable()
      if (!windowsCaptureAvailable) {
        return { success: false, message: 'Native Windows capture is not available on this system.' }
      }

      if (windowsCaptureProcess && !windowsNativeCaptureActive) {
        try { windowsCaptureProcess.kill() } catch { /* ignore */ }
        setWindowsCaptureProcess(null)
        setWindowsCaptureTargetPath(null)
        setWindowsCaptureStopRequested(false)
      }

      if (windowsCaptureProcess) {
        return { success: false, message: 'A native Windows screen recording is already active.' }
      }

      let wcProc: ChildProcessWithoutNullStreams | null = null
      try {
        const exePath = getWindowsCaptureExePath()
        const recordingsDir = await getRecordingsDir()
        const timestamp = Date.now()
        const outputPath = path.join(recordingsDir, `recording-${timestamp}.mp4`)
        const displayBounds = source?.id?.startsWith('window:') ? null : getDisplayBoundsForSource(source)

        const config: Record<string, unknown> = {
          outputPath,
          fps: 60,
        }

        if (options?.capturesSystemAudio) {
          const audioPath = path.join(recordingsDir, `recording-${timestamp}.system.wav`)
          config.captureSystemAudio = true
          config.audioOutputPath = audioPath
          setWindowsSystemAudioPath(audioPath)
        }

        if (options?.capturesMicrophone) {
          const micPath = path.join(recordingsDir, `recording-${timestamp}.mic.wav`)
          config.captureMic = true
          config.micOutputPath = micPath
          if (options.microphoneLabel) {
            config.micDeviceName = options.microphoneLabel
          }
          setWindowsMicAudioPath(micPath)
        }

        const windowId = parseWindowId(source?.id)
        if (windowId && source?.id?.startsWith('window:')) {
          config.windowHandle = windowId
        } else {
          const resolvedDisplay = resolveWindowsCaptureDisplay(
            source,
            getScreen().getAllDisplays(),
            getScreen().getPrimaryDisplay(),
          )
          config.displayId = resolvedDisplay.displayId

          // Monitor handle IDs can drift across Electron/Windows capture boundaries,
          // so also provide display bounds for a coordinate-based native fallback.
          config.displayX = Math.round(resolvedDisplay.bounds.x)
          config.displayY = Math.round(resolvedDisplay.bounds.y)
          config.displayW = Math.round(resolvedDisplay.bounds.width)
          config.displayH = Math.round(resolvedDisplay.bounds.height)
        }

        recordNativeCaptureDiagnostics({
          backend: 'windows-wgc',
          phase: 'start',
          sourceId: source?.id ?? null,
          sourceType: source?.sourceType ?? 'unknown',
          displayId: typeof config.displayId === 'number' ? config.displayId : null,
          displayBounds,
          windowHandle: typeof config.windowHandle === 'number' ? config.windowHandle : null,
          helperPath: exePath,
          outputPath,
          systemAudioPath: windowsSystemAudioPath,
          microphonePath: windowsMicAudioPath,
        })

        setWindowsCaptureOutputBuffer('')
        setWindowsCaptureTargetPath(outputPath)
        setWindowsCaptureStopRequested(false)
        setWindowsCapturePaused(false)
        wcProc = spawn(exePath, [JSON.stringify(config)], {
          cwd: recordingsDir,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
        setWindowsCaptureProcess(wcProc)
        attachWindowsCaptureLifecycle(wcProc)

        wcProc.stdout.on('data', (chunk: Buffer) => {
          setWindowsCaptureOutputBuffer(windowsCaptureOutputBuffer + chunk.toString())
        })
        wcProc.stderr.on('data', (chunk: Buffer) => {
          setWindowsCaptureOutputBuffer(windowsCaptureOutputBuffer + chunk.toString())
        })

        await waitForWindowsCaptureStart(wcProc)
        setWindowsNativeCaptureActive(true)
        setNativeScreenRecordingActive(true)
        recordNativeCaptureDiagnostics({
          backend: 'windows-wgc',
          phase: 'start',
          sourceId: source?.id ?? null,
          sourceType: source?.sourceType ?? 'unknown',
          displayId: typeof config.displayId === 'number' ? config.displayId : null,
          displayBounds,
          windowHandle: typeof config.windowHandle === 'number' ? config.windowHandle : null,
          helperPath: exePath,
          outputPath,
          systemAudioPath: windowsSystemAudioPath,
          microphonePath: windowsMicAudioPath,
          processOutput: windowsCaptureOutputBuffer.trim() || undefined,
        })
        return { success: true }
      } catch (error) {
        recordNativeCaptureDiagnostics({
          backend: 'windows-wgc',
          phase: 'start',
          sourceId: source?.id ?? null,
          sourceType: source?.sourceType ?? 'unknown',
          helperPath: windowsCaptureTargetPath ? getWindowsCaptureExePath() : null,
          outputPath: windowsCaptureTargetPath,
          systemAudioPath: windowsSystemAudioPath,
          microphonePath: windowsMicAudioPath,
          processOutput: windowsCaptureOutputBuffer.trim() || undefined,
          error: String(error),
        })
        console.error('Failed to start native Windows capture:', error)
        try { if (wcProc) wcProc.kill() } catch { /* ignore */ }
        setWindowsNativeCaptureActive(false)
        setNativeScreenRecordingActive(false)
        setWindowsCaptureProcess(null)
        setWindowsCaptureTargetPath(null)
        setWindowsCaptureStopRequested(false)
        setWindowsCapturePaused(false)
        return {
          success: false,
          message: 'Failed to start native Windows capture',
          error: String(error),
        }
      }
    }

    if (process.platform !== 'darwin') {
      return { success: false, message: 'Native screen recording is only available on macOS.' }
    }

    if (nativeCaptureProcess && !nativeScreenRecordingActive) {
      try {
        nativeCaptureProcess.kill()
      } catch {
        // ignore stale helper cleanup failures
      }
      setNativeCaptureProcess(null)
      setNativeCaptureTargetPath(null)
      setNativeCaptureStopRequested(false)
    }

    if (nativeCaptureProcess) {
      return { success: false, message: 'A native screen recording is already active.' }
    }

    let captProc: ChildProcessWithoutNullStreams | null = null
    try {
      const recordingsDir = await getRecordingsDir()

      // Warm up TCC: trigger an Electron-level screen capture API call so macOS
      // activates the screen-recording grant for this process tree before the
      // native helper binary spawns and calls SCStream.startCapture().
      try {
        await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } })
      } catch {
        // non-fatal – the helper will report its own TCC status
      }

      // Ensure microphone TCC is granted for this process tree when mic capture
      // is requested, so the child helper inherits the grant.
      if (options?.capturesMicrophone) {
        const micStatus = systemPreferences.getMediaAccessStatus('microphone')
        if (micStatus !== 'granted') {
          await systemPreferences.askForMediaAccess('microphone')
        }
      }

      const appName = normalizeDesktopSourceName(String(source?.appName ?? ''))
      const ownAppName = normalizeDesktopSourceName(app.getName())
      if (
        !ALLOW_RECORDLY_WINDOW_CAPTURE
        &&
        source?.id?.startsWith('window:')
        && appName
        && (appName === ownAppName || appName === 'recordly')
      ) {
        return { success: false, message: 'Cannot record Recordly windows. Please select another app window.' }
      }

      const helperPath = await ensureNativeCaptureHelperBinary()
      const timestamp = Date.now()
      const outputPath = path.join(recordingsDir, `recording-${timestamp}.mp4`)
      const capturesSystemAudio = Boolean(options?.capturesSystemAudio)
      const capturesMicrophone = Boolean(options?.capturesMicrophone)
      const systemAudioOutputPath = capturesSystemAudio
        ? path.join(recordingsDir, `recording-${timestamp}.system.m4a`)
        : null
      const microphoneOutputPath = capturesMicrophone
        ? path.join(recordingsDir, `recording-${timestamp}.mic.m4a`)
        : null
      const config: Record<string, unknown> = {
        fps: 60,
        outputPath,
        capturesSystemAudio,
        capturesMicrophone,
      }

      if (options?.microphoneDeviceId) {
        config.microphoneDeviceId = options.microphoneDeviceId
      }

      if (options?.microphoneLabel) {
        config.microphoneLabel = options.microphoneLabel
      }

      if (systemAudioOutputPath) {
        config.systemAudioOutputPath = systemAudioOutputPath
      }

      if (microphoneOutputPath) {
        config.microphoneOutputPath = microphoneOutputPath
      }

      const windowId = parseWindowId(source?.id)
      const screenId = Number(source?.display_id)

      if (Number.isFinite(windowId) && windowId && source?.id?.startsWith('window:')) {
        config.windowId = windowId
      } else if (Number.isFinite(screenId) && screenId > 0) {
        config.displayId = screenId
      } else {
        config.displayId = Number(getScreen().getPrimaryDisplay().id)
      }

      setNativeCaptureOutputBuffer('')
      setNativeCaptureTargetPath(outputPath)
      setNativeCaptureSystemAudioPath(systemAudioOutputPath)
      setNativeCaptureMicrophonePath(microphoneOutputPath)
      setNativeCaptureStopRequested(false)
      setNativeCapturePaused(false)
      captProc = spawn(helperPath, [JSON.stringify(config)], {
        cwd: recordingsDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      setNativeCaptureProcess(captProc)
      attachNativeCaptureLifecycle(captProc)

      captProc.stdout.on('data', (chunk: Buffer) => {
        setNativeCaptureOutputBuffer(nativeCaptureOutputBuffer + chunk.toString())
      })
      captProc.stderr.on('data', (chunk: Buffer) => {
        setNativeCaptureOutputBuffer(nativeCaptureOutputBuffer + chunk.toString())
      })

      await waitForNativeCaptureStart(captProc)
      setNativeScreenRecordingActive(true)

      // If the native helper reported MICROPHONE_CAPTURE_UNAVAILABLE, it started
      // capture without microphone.  Clear the mic path so the renderer can fall
      // back to a browser-side sidecar recording for the microphone track.
      const micUnavailableNatively = nativeCaptureOutputBuffer.includes('MICROPHONE_CAPTURE_UNAVAILABLE')
      if (micUnavailableNatively) {
        setNativeCaptureMicrophonePath(null)
      }

      recordNativeCaptureDiagnostics({
        backend: 'mac-screencapturekit',
        phase: 'start',
        sourceId: source?.id ?? null,
        sourceType: source?.sourceType ?? 'unknown',
        displayId: typeof config.displayId === 'number' ? config.displayId : null,
        helperPath,
        outputPath,
        systemAudioPath: systemAudioOutputPath,
        microphonePath: nativeCaptureMicrophonePath,
        processOutput: nativeCaptureOutputBuffer.trim() || undefined,
      })
      return { success: true, microphoneFallbackRequired: micUnavailableNatively }
    } catch (error) {
      console.error('Failed to start native ScreenCaptureKit recording:', error)
      const errorStr = String(error)

      // Detect TCC (screen recording permission) errors and show a helpful dialog
      if (errorStr.includes('declined TCC') || errorStr.includes('declined TCCs') || errorStr.includes('SCREEN_RECORDING_PERMISSION_DENIED')) {
        const { response } = await dialog.showMessageBox({
          type: 'warning',
          title: 'Screen Recording Permission Required',
          message: 'Recordly needs screen recording permission to capture your screen.',
          detail: 'Please open System Settings > Privacy & Security > Screen Recording, make sure Recordly is toggled ON, then try recording again.',
          buttons: ['Open System Settings', 'Cancel'],
          defaultId: 0,
          cancelId: 1,
        })
        if (response === 0) {
          await shell.openExternal(getMacPrivacySettingsUrl('screen'))
        }
        try { if (captProc) captProc.kill() } catch { /* ignore */ }
        setNativeScreenRecordingActive(false)
        setNativeCaptureProcess(null)
        setNativeCaptureTargetPath(null)
        setNativeCaptureSystemAudioPath(null)
        setNativeCaptureMicrophonePath(null)
        setNativeCaptureStopRequested(false)
        setNativeCapturePaused(false)
        return {
          success: false,
          message: 'Screen recording permission not granted. Please allow access in System Settings and restart the app.',
          userNotified: true,
        }
      }

      if (errorStr.includes('MICROPHONE_PERMISSION_DENIED')) {
        const { response } = await dialog.showMessageBox({
          type: 'warning',
          title: 'Microphone Permission Required',
          message: 'Recordly needs microphone permission to record audio.',
          detail: 'Please open System Settings > Privacy & Security > Microphone, make sure Recordly is toggled ON, then try recording again.',
          buttons: ['Open System Settings', 'Cancel'],
          defaultId: 0,
          cancelId: 1,
        })
        if (response === 0) {
          await shell.openExternal(getMacPrivacySettingsUrl('microphone'))
        }
        try { if (captProc) captProc.kill() } catch { /* ignore */ }
        setNativeScreenRecordingActive(false)
        setNativeCaptureProcess(null)
        setNativeCaptureTargetPath(null)
        setNativeCaptureSystemAudioPath(null)
        setNativeCaptureMicrophonePath(null)
        setNativeCaptureStopRequested(false)
        setNativeCapturePaused(false)
        return {
          success: false,
          message: 'Microphone permission not granted. Please allow access in System Settings.',
          userNotified: true,
        }
      }

      recordNativeCaptureDiagnostics({
        backend: 'mac-screencapturekit',
        phase: 'start',
        sourceId: source?.id ?? null,
        sourceType: source?.sourceType ?? 'unknown',
        helperPath: getNativeCaptureHelperBinaryPath(),
        outputPath: nativeCaptureTargetPath,
        systemAudioPath: nativeCaptureSystemAudioPath,
        microphonePath: nativeCaptureMicrophonePath,
        processOutput: nativeCaptureOutputBuffer.trim() || undefined,
        fileSizeBytes: await getFileSizeIfPresent(nativeCaptureTargetPath),
        error: String(error),
      })
      try {
        if (captProc) captProc.kill()
      } catch {
        // ignore cleanup failures
      }
      setNativeScreenRecordingActive(false)
      setNativeCaptureProcess(null)
      setNativeCaptureTargetPath(null)
      setNativeCaptureSystemAudioPath(null)
      setNativeCaptureMicrophonePath(null)
      setNativeCaptureStopRequested(false)
      setNativeCapturePaused(false)
      return {
        success: false,
        message: 'Failed to start native ScreenCaptureKit recording',
        error: String(error),
      }
    }
  })

  ipcMain.handle('stop-native-screen-recording', async () => {
    // Windows native capture stop path
    if (process.platform === 'win32' && windowsNativeCaptureActive) {
      try {
        if (!windowsCaptureProcess) {
          throw new Error('Native Windows capture process is not running')
        }

        const proc = windowsCaptureProcess
        const preferredVideoPath = windowsCaptureTargetPath
        setWindowsCaptureStopRequested(true)
        proc.stdin.write('stop\n')
        const tempVideoPath = await waitForWindowsCaptureStop(proc)
        setWindowsCaptureProcess(null)
        setWindowsNativeCaptureActive(false)
        setNativeScreenRecordingActive(false)
        setWindowsCaptureTargetPath(null)
        setWindowsCaptureStopRequested(false)
        setWindowsCapturePaused(false)

        const finalVideoPath = preferredVideoPath ?? tempVideoPath
        if (tempVideoPath !== finalVideoPath) {
          await moveFileWithOverwrite(tempVideoPath, finalVideoPath)
        }

        setWindowsPendingVideoPath(finalVideoPath)
        recordNativeCaptureDiagnostics({
          backend: 'windows-wgc',
          phase: 'stop',
          outputPath: finalVideoPath,
          systemAudioPath: windowsSystemAudioPath,
          microphonePath: windowsMicAudioPath,
          processOutput: windowsCaptureOutputBuffer.trim() || undefined,
          fileSizeBytes: await getFileSizeIfPresent(finalVideoPath),
        })
        return { success: true, path: finalVideoPath }
      } catch (error) {
        console.error('Failed to stop native Windows capture:', error)
        const fallbackPath = windowsCaptureTargetPath
        setWindowsNativeCaptureActive(false)
        setNativeScreenRecordingActive(false)
        setWindowsCaptureProcess(null)
        setWindowsCaptureTargetPath(null)
        setWindowsCaptureStopRequested(false)
        setWindowsCapturePaused(false)
        setWindowsSystemAudioPath(null)
        setWindowsMicAudioPath(null)
        setWindowsPendingVideoPath(null)

        if (fallbackPath) {
          try {
            await fs.access(fallbackPath)
            setWindowsPendingVideoPath(fallbackPath)
            recordNativeCaptureDiagnostics({
              backend: 'windows-wgc',
              phase: 'stop',
              outputPath: fallbackPath,
              systemAudioPath: windowsSystemAudioPath,
              microphonePath: windowsMicAudioPath,
              processOutput: windowsCaptureOutputBuffer.trim() || undefined,
              fileSizeBytes: await getFileSizeIfPresent(fallbackPath),
              error: String(error),
            })
            return { success: true, path: fallbackPath }
          } catch {
            // File doesn't exist
          }
        }

        recordNativeCaptureDiagnostics({
          backend: 'windows-wgc',
          phase: 'stop',
          outputPath: fallbackPath,
          systemAudioPath: windowsSystemAudioPath,
          microphonePath: windowsMicAudioPath,
          processOutput: windowsCaptureOutputBuffer.trim() || undefined,
          error: String(error),
        })

        return {
          success: false,
          message: 'Failed to stop native Windows capture',
          error: String(error),
        }
      }
    }

    if (process.platform !== 'darwin') {
      return { success: false, message: 'Native screen recording is only available on macOS.' }
    }

    if (!nativeScreenRecordingActive) {
      const recovered = await recoverNativeMacCaptureOutput()
      if (recovered) {
        return recovered
      }

      return { success: false, message: 'No native screen recording is active.' }
    }

    try {
      if (!nativeCaptureProcess) {
        throw new Error('Native capture helper process is not running')
      }

      const process = nativeCaptureProcess
      const preferredVideoPath = nativeCaptureTargetPath
      const preferredSystemAudioPath = nativeCaptureSystemAudioPath
      const preferredMicrophonePath = nativeCaptureMicrophonePath
      console.log('[stop-native] Audio paths — system:', preferredSystemAudioPath, 'mic:', preferredMicrophonePath)
      setNativeCaptureStopRequested(true)
      process.stdin.write('stop\n')
      const tempVideoPath = await waitForNativeCaptureStop(process)
      console.log('[stop-native] Helper stopped, tempVideoPath:', tempVideoPath)
      setNativeCaptureProcess(null)
      setNativeScreenRecordingActive(false)
      setNativeCaptureTargetPath(null)
      setNativeCaptureSystemAudioPath(null)
      setNativeCaptureMicrophonePath(null)
      setNativeCaptureStopRequested(false)
      setNativeCapturePaused(false)

      const finalVideoPath = preferredVideoPath ?? tempVideoPath
      if (tempVideoPath !== finalVideoPath) {
        await moveFileWithOverwrite(tempVideoPath, finalVideoPath)
      }

      if (preferredSystemAudioPath || preferredMicrophonePath) {
        console.log('[stop-native] Attempting audio mux (merging separate tracks) into:', finalVideoPath)
        try {
          await muxNativeMacRecordingWithAudio(finalVideoPath, preferredSystemAudioPath, preferredMicrophonePath)
          console.log('[stop-native] Audio mux completed successfully')
        } catch (error) {
          console.warn('[stop-native] Audio mux failed (video still has inline audio):', error)
        }
      } else {
        console.log('[stop-native] No separate audio tracks to mux')
      }

      return await finalizeStoredVideo(finalVideoPath)
    } catch (error) {
      console.error('Failed to stop native ScreenCaptureKit recording:', error)
      const fallbackPath = nativeCaptureTargetPath
      const fallbackSystemAudioPath = nativeCaptureSystemAudioPath
      const fallbackMicrophonePath = nativeCaptureMicrophonePath
      const fallbackFileSizeBytes = await getFileSizeIfPresent(fallbackPath)
      setNativeScreenRecordingActive(false)
      setNativeCaptureProcess(null)
      setNativeCaptureTargetPath(null)
      setNativeCaptureSystemAudioPath(null)
      setNativeCaptureMicrophonePath(null)
      setNativeCaptureStopRequested(false)
      setNativeCapturePaused(false)

      recordNativeCaptureDiagnostics({
        backend: 'mac-screencapturekit',
        phase: 'stop',
        sourceId: lastNativeCaptureDiagnostics?.sourceId ?? null,
        sourceType: lastNativeCaptureDiagnostics?.sourceType ?? 'unknown',
        displayId: lastNativeCaptureDiagnostics?.displayId ?? null,
        displayBounds: lastNativeCaptureDiagnostics?.displayBounds ?? null,
        windowHandle: lastNativeCaptureDiagnostics?.windowHandle ?? null,
        helperPath: lastNativeCaptureDiagnostics?.helperPath ?? null,
        outputPath: fallbackPath,
        systemAudioPath: fallbackSystemAudioPath,
        microphonePath: fallbackMicrophonePath,
        osRelease: lastNativeCaptureDiagnostics?.osRelease,
        supported: lastNativeCaptureDiagnostics?.supported,
        helperExists: lastNativeCaptureDiagnostics?.helperExists,
        processOutput: nativeCaptureOutputBuffer.trim() || undefined,
        fileSizeBytes: fallbackFileSizeBytes,
        error: String(error),
      })

      // Try to recover: if the target file exists on disk, finalize with it
      if (fallbackPath) {
        try {
          await fs.access(fallbackPath)
          console.log('[stop-native-screen-recording] Recovering with fallback path:', fallbackPath)
          if (fallbackSystemAudioPath || fallbackMicrophonePath) {
            try {
              await muxNativeMacRecordingWithAudio(
                fallbackPath,
                fallbackSystemAudioPath,
                fallbackMicrophonePath,
              )
            } catch (muxError) {
              console.warn('Failed to mux recovered native macOS audio into capture:', muxError)
            }
          }
          return await finalizeStoredVideo(fallbackPath)
        } catch {
          // File doesn't exist or isn't accessible
        }
      }

      const recovered = await recoverNativeMacCaptureOutput()
      if (recovered) {
        return recovered
      }

      return {
        success: false,
        message: 'Failed to stop native ScreenCaptureKit recording',
        error: String(error),
      }
    }
  })

  ipcMain.handle('recover-native-screen-recording', async () => {
    if (process.platform !== 'darwin') {
      return { success: false, message: 'Native screen recording recovery is only available on macOS.' }
    }

    const recovered = await recoverNativeMacCaptureOutput()
    if (recovered) {
      return recovered
    }

    return {
      success: false,
      message: 'No recoverable native macOS recording output was found.',
    }
  })

  ipcMain.handle('pause-native-screen-recording', async () => {
    if (process.platform === 'win32') {
      if (!windowsNativeCaptureActive || !windowsCaptureProcess) {
        return { success: false, message: 'No native Windows screen recording is active.' }
      }

      if (windowsCapturePaused) {
        return { success: true }
      }

      try {
        windowsCaptureProcess.stdin.write('pause\n')
        setWindowsCapturePaused(true)
        return { success: true }
      } catch (error) {
        return { success: false, message: 'Failed to pause native Windows capture', error: String(error) }
      }
    }

    if (process.platform !== 'darwin') {
      return { success: false, message: 'Native screen recording is only available on macOS.' }
    }

    if (!nativeScreenRecordingActive || !nativeCaptureProcess) {
      return { success: false, message: 'No native screen recording is active.' }
    }

    if (nativeCapturePaused) {
      return { success: true }
    }

    try {
      nativeCaptureProcess.stdin.write('pause\n')
      setNativeCapturePaused(true)
      return { success: true }
    } catch (error) {
      return { success: false, message: 'Failed to pause native screen recording', error: String(error) }
    }
  })

  ipcMain.handle('resume-native-screen-recording', async () => {
    if (process.platform === 'win32') {
      if (!windowsNativeCaptureActive || !windowsCaptureProcess) {
        return { success: false, message: 'No native Windows screen recording is active.' }
      }

      if (!windowsCapturePaused) {
        return { success: true }
      }

      try {
        windowsCaptureProcess.stdin.write('resume\n')
        setWindowsCapturePaused(false)
        return { success: true }
      } catch (error) {
        return { success: false, message: 'Failed to resume native Windows capture', error: String(error) }
      }
    }

    if (process.platform !== 'darwin') {
      return { success: false, message: 'Native screen recording is only available on macOS.' }
    }

    if (!nativeScreenRecordingActive || !nativeCaptureProcess) {
      return { success: false, message: 'No native screen recording is active.' }
    }

    if (!nativeCapturePaused) {
      return { success: true }
    }

    try {
      nativeCaptureProcess.stdin.write('resume\n')
      setNativeCapturePaused(false)
      return { success: true }
    } catch (error) {
      return { success: false, message: 'Failed to resume native screen recording', error: String(error) }
    }
  })

  ipcMain.handle('get-system-cursor-assets', async () => {
    try {
      return { success: true, cursors: await getSystemCursorAssets() }
    } catch (error) {
      console.error('Failed to load system cursor assets:', error)
      return { success: false, cursors: {}, error: String(error) }
    }
  })

  ipcMain.handle('is-native-windows-capture-available', async () => {
    return { available: await isNativeWindowsCaptureAvailable() }
  })

  ipcMain.handle('get-last-native-capture-diagnostics', async () => {
    return { success: true, diagnostics: lastNativeCaptureDiagnostics }
  })

  ipcMain.handle('get-video-audio-fallback-paths', async (_event, videoPath: string) => {
    if (!videoPath) {
      return { success: true, paths: [] }
    }

    try {
      const paths = await getCompanionAudioFallbackPaths(videoPath)
      await Promise.all([
        rememberApprovedLocalReadPath(videoPath),
        ...paths.map((fallbackPath) => rememberApprovedLocalReadPath(fallbackPath)),
      ])
      return { success: true, paths }
    } catch (error) {
      console.error('Failed to resolve companion audio fallback paths:', error)
      return { success: false, paths: [], error: String(error) }
    }
  })

  ipcMain.handle('mux-native-windows-recording', async (_event, pauseSegments?: PauseSegment[]) => {
    const videoPath = windowsPendingVideoPath
    setWindowsPendingVideoPath(null)

    if (!videoPath) {
      return { success: false, message: 'No native Windows video pending for mux' }
    }

    try {
      if (windowsSystemAudioPath || windowsMicAudioPath) {
        await muxNativeWindowsVideoWithAudio(videoPath, windowsSystemAudioPath, windowsMicAudioPath, pauseSegments ?? [])
        setWindowsSystemAudioPath(null)
        setWindowsMicAudioPath(null)
      }

      recordNativeCaptureDiagnostics({
        backend: 'windows-wgc',
        phase: 'mux',
        outputPath: videoPath,
        fileSizeBytes: await getFileSizeIfPresent(videoPath),
      })
      return await finalizeStoredVideo(videoPath)
    } catch (error) {
      console.error('Failed to mux native Windows recording:', error)
      recordNativeCaptureDiagnostics({
        backend: 'windows-wgc',
        phase: 'mux',
        outputPath: videoPath,
        systemAudioPath: windowsSystemAudioPath,
        microphonePath: windowsMicAudioPath,
        fileSizeBytes: await getFileSizeIfPresent(videoPath),
        error: String(error),
      })
      setWindowsSystemAudioPath(null)
      setWindowsMicAudioPath(null)
      try {
        return await finalizeStoredVideo(videoPath)
      } catch {
        return { success: false, message: 'Failed to mux native Windows recording', error: String(error) }
      }
    }
  })

  ipcMain.handle('start-ffmpeg-recording', async (_, source: SelectedSource) => {
    if (ffmpegCaptureProcess) {
      return { success: false, message: 'An FFmpeg recording is already active.' }
    }

    try {
      const recordingsDir = await getRecordingsDir()
      const ffmpegPath = getFfmpegBinaryPath()
      const outputPath = path.join(recordingsDir, `recording-${Date.now()}.mp4`)
      const args = await buildFfmpegCaptureArgs(source, outputPath)

      setFfmpegCaptureOutputBuffer('')
      setFfmpegCaptureTargetPath(outputPath)
      const ffProc = spawn(ffmpegPath, args, {
        cwd: recordingsDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      setFfmpegCaptureProcess(ffProc)

      ffProc.stdout.on('data', (chunk: Buffer) => {
        setFfmpegCaptureOutputBuffer(ffmpegCaptureOutputBuffer + chunk.toString())
      })
      ffProc.stderr.on('data', (chunk: Buffer) => {
        setFfmpegCaptureOutputBuffer(ffmpegCaptureOutputBuffer + chunk.toString())
      })

      await waitForFfmpegCaptureStart(ffProc)
      setFfmpegScreenRecordingActive(true)
      return { success: true }
    } catch (error) {
      console.error('Failed to start FFmpeg recording:', error)
      setFfmpegScreenRecordingActive(false)
      setFfmpegCaptureProcess(null)
      setFfmpegCaptureTargetPath(null)
      return {
        success: false,
        message: 'Failed to start FFmpeg recording',
        error: String(error),
      }
    }
  })

  ipcMain.handle('stop-ffmpeg-recording', async () => {
    if (!ffmpegScreenRecordingActive) {
      return { success: false, message: 'No FFmpeg recording is active.' }
    }

    try {
      if (!ffmpegCaptureProcess || !ffmpegCaptureTargetPath) {
        throw new Error('FFmpeg process is not running')
      }

      const process = ffmpegCaptureProcess
      const outputPath = ffmpegCaptureTargetPath
      process.stdin.write('q\n')
      const finalVideoPath = await waitForFfmpegCaptureStop(process, outputPath)

      setFfmpegCaptureProcess(null)
      setFfmpegCaptureTargetPath(null)
      setFfmpegScreenRecordingActive(false)

      return await finalizeStoredVideo(finalVideoPath)
    } catch (error) {
      console.error('Failed to stop FFmpeg recording:', error)
      setFfmpegCaptureProcess(null)
      setFfmpegCaptureTargetPath(null)
      setFfmpegScreenRecordingActive(false)
      return {
        success: false,
        message: 'Failed to stop FFmpeg recording',
        error: String(error),
      }
    }
  })



  ipcMain.handle('store-microphone-sidecar', async (_, audioData: ArrayBuffer, videoPath: string) => {
    try {
      const baseName = videoPath.replace(/\.[^.]+$/, '')
      const sidecarPath = `${baseName}.mic.webm`
      await fs.writeFile(sidecarPath, Buffer.from(audioData))
      return { success: true, path: sidecarPath }
    } catch (error) {
      console.error('Failed to store microphone sidecar:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('store-recorded-video', async (_, videoData: ArrayBuffer, fileName: string) => {
    try {
      const recordingsDir = await getRecordingsDir()
      const videoPath = path.join(recordingsDir, fileName)
      await fs.writeFile(videoPath, Buffer.from(videoData))
      return await finalizeStoredVideo(videoPath)
    } catch (error) {
      console.error('Failed to store video:', error)
      return {
        success: false,
        message: 'Failed to store video',
        error: String(error)
      }
    }
  })



  ipcMain.handle('get-recorded-video-path', async () => {
    try {
      const recordingsDir = await getRecordingsDir()
      const files = await fs.readdir(recordingsDir)
      const videoFiles = files.filter(file => /\.(webm|mov|mp4)$/i.test(file))
      
      if (videoFiles.length === 0) {
        return { success: false, message: 'No recorded video found' }
      }
      
      const latestVideo = videoFiles.sort().reverse()[0]
      const videoPath = path.join(recordingsDir, latestVideo)
      
      return { success: true, path: videoPath }
    } catch (error) {
      console.error('Failed to get video path:', error)
      return { success: false, message: 'Failed to get video path', error: String(error) }
    }
  })

  ipcMain.handle('set-recording-state', (_, recording: boolean) => {
    if (recording) {
      stopCursorCapture()
      stopInteractionCapture()
      startWindowBoundsCapture()
      void startNativeCursorMonitor()
      setIsCursorCaptureActive(true)
      setActiveCursorSamples([])
      setPendingCursorSamples([])
      setCursorCaptureStartTimeMs(Date.now())
      setLinuxCursorScreenPoint(null)
      setLastLeftClick(null)
      sampleCursorPoint()
      setCursorCaptureInterval(setInterval(sampleCursorPoint, CURSOR_SAMPLE_INTERVAL_MS))
      void startInteractionCapture()
    } else {
      setIsCursorCaptureActive(false)
      stopCursorCapture()
      stopInteractionCapture()
      stopWindowBoundsCapture()
      stopNativeCursorMonitor()
      showCursor()
      setLinuxCursorScreenPoint(null)
      snapshotCursorTelemetryForPersistence()
      setActiveCursorSamples([])
    }

    const source = selectedSource || { name: 'Screen' }
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send('recording-state-changed', {
          recording,
          sourceName: source.name,
        })
      }
    })

    if (onRecordingStateChange) {
      onRecordingStateChange(recording, source.name)
    }
  })

  ipcMain.handle('get-cursor-telemetry', async (_, videoPath?: string) => {
    const targetVideoPath = normalizeVideoSourcePath(videoPath ?? currentVideoPath)
    if (!targetVideoPath) {
      return { success: true, samples: [] }
    }

    const telemetryPath = getTelemetryPathForVideo(targetVideoPath)
    try {
      const content = await fs.readFile(telemetryPath, 'utf-8')
      const parsed = JSON.parse(content)
      const rawSamples = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed?.samples) ? parsed.samples : [])

      const samples: CursorTelemetryPoint[] = rawSamples
        .filter((sample: unknown) => Boolean(sample && typeof sample === 'object'))
        .map((sample: unknown) => {
          const point = sample as Partial<CursorTelemetryPoint>
          return {
            timeMs: typeof point.timeMs === 'number' && Number.isFinite(point.timeMs) ? Math.max(0, point.timeMs) : 0,
            cx: typeof point.cx === 'number' && Number.isFinite(point.cx) ? clamp(point.cx, 0, 1) : 0.5,
            cy: typeof point.cy === 'number' && Number.isFinite(point.cy) ? clamp(point.cy, 0, 1) : 0.5,
            interactionType: point.interactionType === 'click'
              || point.interactionType === 'double-click'
              || point.interactionType === 'right-click'
              || point.interactionType === 'middle-click'
              || point.interactionType === 'move'
              || point.interactionType === 'mouseup'
              ? point.interactionType
              : undefined,
            cursorType: point.cursorType === 'arrow'
              || point.cursorType === 'text'
              || point.cursorType === 'pointer'
              || point.cursorType === 'crosshair'
              || point.cursorType === 'open-hand'
              || point.cursorType === 'closed-hand'
              || point.cursorType === 'resize-ew'
              || point.cursorType === 'resize-ns'
              || point.cursorType === 'not-allowed'
              ? point.cursorType
              : undefined,
          }
        })
        .sort((a: CursorTelemetryPoint, b: CursorTelemetryPoint) => a.timeMs - b.timeMs)

      return { success: true, samples }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code === 'ENOENT') {
        return { success: true, samples: [] }
      }
      console.error('Failed to load cursor telemetry:', error)
      return { success: false, message: 'Failed to load cursor telemetry', error: String(error), samples: [] }
    }
  })


  ipcMain.handle('open-external-url', async (_, url: string) => {
    try {
      // Security: only allow http/https URLs to prevent file:// or custom protocol abuse
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { success: false, error: `Blocked non-HTTP URL: ${parsed.protocol}` }
      }
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error('Failed to open URL:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('get-accessibility-permission-status', () => {
    if (process.platform !== 'darwin') {
      return { success: true, trusted: true, prompted: false }
    }

    return {
      success: true,
      trusted: systemPreferences.isTrustedAccessibilityClient(false),
      prompted: false,
    }
  })

  ipcMain.handle('request-accessibility-permission', () => {
    if (process.platform !== 'darwin') {
      return { success: true, trusted: true, prompted: false }
    }

    return {
      success: true,
      trusted: systemPreferences.isTrustedAccessibilityClient(true),
      prompted: true,
    }
  })

  ipcMain.handle('get-screen-recording-permission-status', () => {
    if (process.platform !== 'darwin') {
      return { success: true, status: 'granted' }
    }

    try {
      return {
        success: true,
        status: systemPreferences.getMediaAccessStatus('screen'),
      }
    } catch (error) {
      console.error('Failed to get screen recording permission status:', error)
      return { success: false, status: 'unknown', error: String(error) }
    }
  })

  ipcMain.handle('open-screen-recording-preferences', async () => {
    if (process.platform !== 'darwin') {
      return { success: true }
    }

    try {
      await shell.openExternal(getMacPrivacySettingsUrl('screen'))
      return { success: true }
    } catch (error) {
      console.error('Failed to open Screen Recording preferences:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('open-accessibility-preferences', async () => {
    if (process.platform !== 'darwin') {
      return { success: true }
    }

    try {
      await shell.openExternal(getMacPrivacySettingsUrl('accessibility'))
      return { success: true }
    } catch (error) {
      console.error('Failed to open Accessibility preferences:', error)
      return { success: false, error: String(error) }
    }
  })

  // Generate a tiny thumbnail for a wallpaper image and cache it in userData.
  // Returns the cached thumbnail as raw JPEG bytes for fast grid rendering.
  // Serialized to prevent concurrent nativeImage operations from eating memory.
  const THUMB_SIZE = 96
  const thumbCacheDir = path.join(USER_DATA_PATH, 'wallpaper-thumbs')
  let thumbGenerationQueue: Promise<void> = Promise.resolve()

  ipcMain.handle('generate-wallpaper-thumbnail', async (_, filePath: string) => {
    try {
      const resolved = normalizePath(filePath)
      const realResolved = await fs.realpath(resolved).catch(() => resolved)

      if (!isAllowedLocalReadPath(resolved) && !isAllowedLocalReadPath(realResolved)) {
        return { success: false, error: 'Access denied' }
      }

      // Deterministic cache key from file path + mtime
      const stat = await fs.stat(resolved)
      const cacheKey = Buffer.from(`${resolved}:${stat.mtimeMs}`).toString('base64url')
      const thumbPath = path.join(thumbCacheDir, `${cacheKey}.jpg`)

      // Return cached thumbnail if it exists (no queue needed)
      if (existsSync(thumbPath)) {
        const data = await fs.readFile(thumbPath)
        return { success: true, data }
      }

      // Serialize nativeImage operations to avoid OOM from concurrent full-res decodes
      let jpegData: Buffer
      const generation = thumbGenerationQueue.then(async () => {
        const { nativeImage } = await import('electron')
        const img = nativeImage.createFromPath(resolved)
        if (img.isEmpty()) {
          throw new Error('Failed to load image')
        }
        const { width, height } = img.getSize()
        const scale = THUMB_SIZE / Math.min(width, height)
        const resized = img.resize({
          width: Math.round(width * scale),
          height: Math.round(height * scale),
          quality: 'good',
        })
        jpegData = resized.toJPEG(70)

        // Cache to disk
        await fs.mkdir(thumbCacheDir, { recursive: true })
        await fs.writeFile(thumbPath, jpegData)
      })
      // Keep the queue moving even if one fails
      thumbGenerationQueue = generation.catch(() => {})
      await generation

      return { success: true, data: jpegData! }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Return base path for assets so renderer can resolve file:// paths in production
  ipcMain.handle('get-asset-base-path', () => {
    try {
      const assetPath = getAssetRootPath()
      return pathToFileURL(`${assetPath}${path.sep}`).toString()
    } catch (err) {
      console.error('Failed to resolve asset base path:', err)
      return null
    }
  })

  ipcMain.handle('list-asset-directory', async (_, relativeDir: string) => {
    try {
      const normalizedRelativeDir = String(relativeDir ?? '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')

      const assetRootPath = path.resolve(getAssetRootPath())
      const targetDirPath = path.resolve(assetRootPath, normalizedRelativeDir)
      if (targetDirPath !== assetRootPath && !targetDirPath.startsWith(`${assetRootPath}${path.sep}`)) {
        return { success: false, error: 'Invalid asset directory' }
      }

      const entries = await fs.readdir(targetDirPath, { withFileTypes: true })
      const files = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort(new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare)

      return { success: true, files }
    } catch (error) {
      console.error('Failed to list asset directory:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('read-local-file', async (_, filePath: string) => {
    try {
      const resolved = normalizePath(filePath)
      const realResolved = await fs.realpath(resolved).catch(() => resolved)
      if (!isAllowedLocalReadPath(resolved) && !isAllowedLocalReadPath(realResolved)) {
        console.warn(`[read-local-file] Blocked read outside allowed directories: ${resolved}`)
        return { success: false, error: 'Access denied: path outside allowed directories' }
      }

      const data = await fs.readFile(resolved)
      return { success: true, data }
    } catch (error) {
      console.error('Failed to read local file:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'native-video-export-start',
    async (
      event,
      options: {
        width: number
        height: number
        frameRate: number
        bitrate: number
        encodingMode: NativeExportEncodingMode
        inputMode?: 'rawvideo' | 'h264-stream'
      },
    ) => {
      try {
        if (options.width % 2 !== 0 || options.height % 2 !== 0) {
          throw new Error('Native export requires even output dimensions')
        }

        const ffmpegPath = getFfmpegBinaryPath()
        const inputMode = options.inputMode ?? 'rawvideo'
        const sessionId = `recordly-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const outputPath = path.join(app.getPath('temp'), `${sessionId}.mp4`)

        let encoderName: string
        let ffmpegArgs: string[]

        if (inputMode === 'h264-stream') {
          // Pre-encoded H.264 Annex B from browser VideoEncoder — just stream-copy into MP4
          encoderName = 'h264-stream-copy'
          ffmpegArgs = buildNativeH264StreamExportArgs({ frameRate: options.frameRate, outputPath })
        } else {
          encoderName = await resolveNativeVideoEncoder(ffmpegPath, options.encodingMode)
          ffmpegArgs = buildNativeVideoExportArgs(encoderName, options, outputPath)
        }

        const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, {
          stdio: ['pipe', 'ignore', 'pipe'],
        }) as ChildProcessByStdio<Writable, null, Readable>
        // For rawvideo, frames are a fixed RGBA size. For h264-stream, chunks are variable.
        const inputByteSize = inputMode === 'rawvideo' ? getNativeVideoInputByteSize(options.width, options.height) : 0

        const session: NativeVideoExportSession = {
          ffmpegProcess,
          outputPath,
          inputByteSize,
          inputMode,
          maxQueuedWriteBytes: inputMode === 'h264-stream' ? 8 * 1024 * 1024 : getNativeVideoExportMaxQueuedWriteBytes(inputByteSize),
          stderrOutput: '',
          encoderName,
          processError: null,
          stdinError: null,
          terminating: false,
          writeSequence: Promise.resolve(),
          sender: event.sender,
          pendingWriteRequestIds: new Set<number>(),
          completionPromise: new Promise<void>((resolve, reject) => {
            ffmpegProcess.once('error', (error) => {
              const processError = error instanceof Error ? error : new Error(String(error))
              if (session.terminating) {
                resolve()
                return
              }

              session.processError = processError
              reject(processError)
            })
            ffmpegProcess.stdin.once('error', (error) => {
              const stdinError = error instanceof Error ? error : new Error(String(error))
              if (session.terminating && isIgnorableNativeVideoExportStreamError(stdinError)) {
                return
              }

              session.stdinError = stdinError
            })
            ffmpegProcess.once('close', (code, signal) => {
              if (session.terminating) {
                resolve()
                return
              }

              if (code === 0) {
                resolve()
                return
              }

              reject(
                new Error(
                  getNativeVideoExportSessionError(
                    session,
                    `FFmpeg exited with code ${code ?? 'unknown'}${signal ? ` (signal ${signal})` : ''}`,
                  ),
                ),
              )
            })
          }),
        }
        void session.completionPromise.catch(() => undefined)

        ffmpegProcess.stderr.on('data', (chunk: Buffer) => {
          session.stderrOutput += chunk.toString()
        })

        nativeVideoExportSessions.set(sessionId, session)

        console.log(
          `[native-export] Started ${isHardwareAcceleratedVideoEncoder(encoderName) ? 'hardware' : 'software'} session ${sessionId} with ${encoderName}`,
        )

        return {
          success: true,
          sessionId,
          encoderName,
        }
      } catch (error) {
        console.error('[native-export] Failed to start native video export session:', error)
        return {
          success: false,
          error: String(error),
        }
      }
    },
  )

  ipcMain.on(
    'native-video-export-write-frame-async',
    (
      event,
      payload: {
        sessionId: string
        requestId: number
        frameData: Uint8Array
      },
    ) => {
      const sessionId = payload?.sessionId
      const requestId = payload?.requestId
      const frameData = payload?.frameData

      if (typeof sessionId !== 'string' || typeof requestId !== 'number' || !frameData) {
        return
      }

      const session = nativeVideoExportSessions.get(sessionId)
      if (!session) {
        sendNativeVideoExportWriteFrameResult(event.sender, sessionId, requestId, {
          success: false,
          error: 'Invalid native export session',
        })
        return
      }

      session.sender = event.sender
      session.pendingWriteRequestIds.add(requestId)

      if (session.terminating) {
        settleNativeVideoExportWriteFrameRequest(sessionId, session, requestId, {
          success: false,
          error: 'Native video export session was cancelled',
        })
        return
      }

      if (session.inputMode !== 'h264-stream' && frameData.byteLength !== session.inputByteSize) {
        settleNativeVideoExportWriteFrameRequest(sessionId, session, requestId, {
          success: false,
          error: `Native video export expected ${session.inputByteSize} bytes per frame but received ${frameData.byteLength}`,
        })
        return
      }

      void enqueueNativeVideoExportFrameWrite(session, frameData)
        .then(() => {
          settleNativeVideoExportWriteFrameRequest(sessionId, session, requestId, {
            success: true,
          })
        })
        .catch((error) => {
          session.stdinError = error instanceof Error ? error : new Error(String(error))
          settleNativeVideoExportWriteFrameRequest(sessionId, session, requestId, {
            success: false,
            error: getNativeVideoExportSessionError(
              session,
              session.stdinError.message,
            ),
          })
        })
    },
  )

  ipcMain.handle(
    'native-video-export-finish',
    async (_, sessionId: string, options?: NativeVideoExportFinishOptions) => {
      const session = nativeVideoExportSessions.get(sessionId)
      if (!session) {
        return { success: false, error: 'Invalid native export session' }
      }

      try {
        await session.writeSequence
        if (!session.ffmpegProcess.stdin.destroyed && !session.ffmpegProcess.stdin.writableEnded) {
          session.ffmpegProcess.stdin.end()
        }
        await session.completionPromise

        const finalizedPath = await muxNativeVideoExportAudio(session.outputPath, options ?? {})
        const data = await fs.readFile(finalizedPath)
        nativeVideoExportSessions.delete(sessionId)
        await removeTemporaryExportFile(finalizedPath)

        return {
          success: true,
          data: new Uint8Array(data),
          encoderName: session.encoderName,
        }
      } catch (error) {
        flushNativeVideoExportPendingWriteRequests(
          sessionId,
          session,
          String(error),
        )
        nativeVideoExportSessions.delete(sessionId)
        await removeTemporaryExportFile(session.outputPath)
        const finalizedSuffix = session.outputPath.replace(/\.mp4$/, '-final.mp4')
        await removeTemporaryExportFile(finalizedSuffix)
        return {
          success: false,
          error: String(error),
        }
      }
    },
  )

  ipcMain.handle(
    'mux-exported-video-audio',
    async (_, videoData: ArrayBuffer, options?: NativeVideoExportFinishOptions) => {
      try {
        const data = await muxExportedVideoAudioBuffer(videoData, options ?? {})
        return {
          success: true,
          data,
        }
      } catch (error) {
        return {
          success: false,
          error: String(error),
        }
      }
    },
  )

  ipcMain.handle('native-video-export-cancel', async (_, sessionId: string) => {
    const session = nativeVideoExportSessions.get(sessionId)
    if (!session) {
      return { success: true }
    }

    session.terminating = true
    nativeVideoExportSessions.delete(sessionId)
    flushNativeVideoExportPendingWriteRequests(
      sessionId,
      session,
      'Native video export session was cancelled',
    )

    try {
      if (!session.ffmpegProcess.stdin.destroyed && !session.ffmpegProcess.stdin.writableEnded) {
        session.ffmpegProcess.stdin.destroy()
      }
    } catch {
      // Stream may already be closed.
    }

    try {
      session.ffmpegProcess.kill('SIGKILL')
    } catch {
      // Process may already be closed.
    }

    await session.completionPromise.catch(() => undefined)
    await removeTemporaryExportFile(session.outputPath)
    return { success: true }
  })

  ipcMain.handle('save-exported-video', async (event, videoData: ArrayBuffer, fileName: string) => {
    try {
      // Determine file type from extension
      const isGif = fileName.toLowerCase().endsWith('.gif');
      const filters = isGif 
        ? [{ name: 'GIF Image', extensions: ['gif'] }]
        : [{ name: 'MP4 Video', extensions: ['mp4'] }];
      const parentWindow = BrowserWindow.fromWebContents(event.sender)
      const saveDialogOptions: SaveDialogOptions = {
        title: isGif ? 'Save Exported GIF' : 'Save Exported Video',
        defaultPath: path.join(app.getPath('downloads'), fileName),
        filters,
        properties: ['createDirectory', 'showOverwriteConfirmation'],
      }

      const result = parentWindow
        ? await dialog.showSaveDialog(parentWindow, saveDialogOptions)
        : await dialog.showSaveDialog(saveDialogOptions)

      if (result.canceled || !result.filePath) {
        return {
          success: false,
          canceled: true,
          message: 'Export canceled'
        };
      }

      await fs.writeFile(result.filePath, Buffer.from(videoData));

      return {
        success: true,
        path: result.filePath,
        message: 'Video exported successfully'
      };
    } catch (error) {
      console.error('Failed to save exported video:', error)
      return {
        success: false,
        message: 'Failed to save exported video',
        error: String(error)
      }
    }
  })

  ipcMain.handle('write-exported-video-to-path', async (_event, videoData: ArrayBuffer, outputPath: string) => {
    try {
      const resolvedPath = path.resolve(outputPath)
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      await fs.writeFile(resolvedPath, Buffer.from(videoData));

      return {
        success: true,
        path: outputPath,
        message: 'Video exported successfully',
        canceled: false,
      };
    } catch (error) {
      console.error('Failed to write exported video to path:', error)
      return {
        success: false,
        message: 'Failed to write exported video',
        canceled: false,
        error: String(error)
      }
    }
  })

  ipcMain.handle('open-video-file-picker', async () => {
    try {
      const recordingsDir = await getRecordingsDir()
      const result = await dialog.showOpenDialog({
        title: 'Select Video File',
        defaultPath: recordingsDir,
        filters: [
          { name: 'Video Files', extensions: ['webm', 'mp4', 'mov', 'avi', 'mkv'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      approveUserPath(result.filePaths[0])
      setCurrentProjectPath(null)
      return {
        success: true,
        path: result.filePaths[0]
      };
    } catch (error) {
      console.error('Failed to open file picker:', error);
      return {
        success: false,
        message: 'Failed to open file picker',
        error: String(error)
      };
    }
  });

  ipcMain.handle('open-audio-file-picker', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Audio File',
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      approveUserPath(result.filePaths[0])
      return {
        success: true,
        path: result.filePaths[0]
      };
    } catch (error) {
      console.error('Failed to open audio file picker:', error);
      return {
        success: false,
        message: 'Failed to open audio file picker',
        error: String(error)
      };
    }
  });

  ipcMain.handle('open-whisper-executable-picker', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Whisper Executable',
        filters: [
          { name: 'Executables', extensions: process.platform === 'win32' ? ['exe', 'cmd', 'bat'] : ['*'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true }
      }

      approveUserPath(result.filePaths[0])
      return { success: true, path: result.filePaths[0] }
    } catch (error) {
      console.error('Failed to open Whisper executable picker:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('open-whisper-model-picker', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Select Whisper Model',
        filters: [
          { name: 'Whisper Models', extensions: ['bin'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true }
      }

      approveUserPath(result.filePaths[0])
      return { success: true, path: result.filePaths[0] }
    } catch (error) {
      console.error('Failed to open Whisper model picker:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('get-whisper-small-model-status', async () => {
    try {
      return await getWhisperSmallModelStatus()
    } catch (error) {
      return { success: false, exists: false, path: null, error: String(error) }
    }
  })

  ipcMain.handle('download-whisper-small-model', async (event) => {
    try {
      const existing = await getWhisperSmallModelStatus()
      if (existing.exists) {
        sendWhisperModelDownloadProgress(event.sender, {
          status: 'downloaded',
          progress: 100,
          path: existing.path,
        })
        return { success: true, path: existing.path, alreadyDownloaded: true }
      }

      const modelPath = await downloadWhisperSmallModel(event.sender)
      return { success: true, path: modelPath }
    } catch (error) {
      console.error('Failed to download Whisper small model:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('delete-whisper-small-model', async (event) => {
    try {
      await deleteWhisperSmallModel()
      sendWhisperModelDownloadProgress(event.sender, {
        status: 'idle',
        progress: 0,
        path: null,
      })
      return { success: true }
    } catch (error) {
      console.error('Failed to delete Whisper small model:', error)
      // Verify whether the file was actually removed despite the error
      const status = await getWhisperSmallModelStatus()
      if (!status.exists) {
        // File is gone — treat as success
        sendWhisperModelDownloadProgress(event.sender, {
          status: 'idle',
          progress: 0,
          path: null,
        })
        return { success: true }
      }
      sendWhisperModelDownloadProgress(event.sender, {
        status: 'error',
        progress: 0,
        path: null,
        error: String(error),
      })
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('generate-auto-captions', async (_, options: {
    videoPath: string
    whisperExecutablePath: string
    whisperModelPath: string
    language?: string
  }) => {
    try {
      const result = await generateAutoCaptionsFromVideo(options)
      return {
        success: true,
        cues: result.cues,
        message: result.audioSourceLabel === 'recording'
          ? `Generated ${result.cues.length} caption cues.`
          : `Generated ${result.cues.length} caption cues from the ${result.audioSourceLabel}.`,
      }
    } catch (error) {
      console.error('Failed to generate auto captions:', error)
      return {
        success: false,
        error: String(error),
        message: 'Failed to generate auto captions',
      }
    }
  })

  ipcMain.handle('reveal-in-folder', async (_, filePath: string) => {
    try {
      // shell.showItemInFolder doesn't return a value, it throws on error
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (error) {
      console.error(`Error revealing item in folder: ${filePath}`, error);
      // Fallback to open the directory if revealing the item fails
      // This might happen if the file was moved or deleted after export,
      // or if the path is somehow invalid for showItemInFolder
      try {
        const openPathResult = await shell.openPath(path.dirname(filePath));
        if (openPathResult) {
          // openPath returned an error message
          return { success: false, error: openPathResult };
        }
        return { success: true, message: 'Could not reveal item, but opened directory.' };
      } catch (openError) {
        console.error(`Error opening directory: ${path.dirname(filePath)}`, openError);
        return { success: false, error: String(error) };
      }
    }
  });

  ipcMain.handle('open-recordings-folder', async () => {
    try {
      const recordingsDir = await getRecordingsDir();
      const openPathResult = await shell.openPath(recordingsDir);
      if (openPathResult) {
        return { success: false, error: openPathResult, message: 'Failed to open recordings folder.' };
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to open recordings folder:', error);
      return { success: false, error: String(error), message: 'Failed to open recordings folder.' };
    }
  });

  ipcMain.handle('get-recordings-directory', async () => {
    try {
      const recordingsDir = await getRecordingsDir()
      return {
        success: true,
        path: recordingsDir,
        isDefault: recordingsDir === RECORDINGS_DIR,
      }
    } catch (error) {
      return {
        success: false,
        path: RECORDINGS_DIR,
        isDefault: true,
        error: String(error),
      }
    }
  })

  ipcMain.handle('choose-recordings-directory', async () => {
    try {
      const current = await getRecordingsDir()
      const result = await dialog.showOpenDialog({
        title: 'Choose recordings folder',
        defaultPath: current,
        properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true, path: current }
      }

      const selectedPath = path.resolve(result.filePaths[0])
      await fs.mkdir(selectedPath, { recursive: true })
      await fs.access(selectedPath, fsConstants.W_OK)
      await persistRecordingsDirectorySetting(selectedPath)

      return { success: true, path: selectedPath, isDefault: selectedPath === RECORDINGS_DIR }
    } catch (error) {
      return { success: false, error: String(error), message: 'Failed to set recordings folder' }
    }
  })

  ipcMain.handle('save-project-file', async (_, projectData: unknown, suggestedName?: string, existingProjectPath?: string, thumbnailDataUrl?: string | null) => {
    try {
      const projectsDir = await getProjectsDir()
      const trustedExistingProjectPath = isTrustedProjectPath(existingProjectPath)
        ? existingProjectPath
        : null

      if (trustedExistingProjectPath) {
        await fs.writeFile(trustedExistingProjectPath, JSON.stringify(projectData, null, 2), 'utf-8')
        setCurrentProjectPath(trustedExistingProjectPath)
        await saveProjectThumbnail(trustedExistingProjectPath, thumbnailDataUrl)
        await rememberRecentProject(trustedExistingProjectPath)
        return {
          success: true,
          path: trustedExistingProjectPath,
          message: 'Project saved successfully'
        }
      }

      const safeName = (suggestedName || `project-${Date.now()}`).replace(/[^a-zA-Z0-9-_]/g, '_')
      const defaultName = safeName.endsWith(`.${PROJECT_FILE_EXTENSION}`)
        ? safeName
        : `${safeName}.${PROJECT_FILE_EXTENSION}`

      const result = await dialog.showSaveDialog({
        title: 'Save Recordly Project',
        defaultPath: path.join(projectsDir, defaultName),
        filters: [
          { name: 'Recordly Project', extensions: [PROJECT_FILE_EXTENSION] },
          { name: 'JSON', extensions: ['json'] }
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation']
      })

      if (result.canceled || !result.filePath) {
        return {
          success: false,
          canceled: true,
          message: 'Save project canceled'
        }
      }

      await fs.writeFile(result.filePath, JSON.stringify(projectData, null, 2), 'utf-8')
      setCurrentProjectPath(result.filePath)
      await saveProjectThumbnail(result.filePath, thumbnailDataUrl)
      await rememberRecentProject(result.filePath)

      return {
        success: true,
        path: result.filePath,
        message: 'Project saved successfully'
      }
    } catch (error) {
      console.error('Failed to save project file:', error)
      return {
        success: false,
        message: 'Failed to save project file',
        error: String(error)
      }
    }
  })

  ipcMain.handle('load-project-file', async () => {
    try {
      const projectsDir = await getProjectsDir()
      const result = await dialog.showOpenDialog({
        title: 'Open Recordly Project',
        defaultPath: projectsDir,
        filters: [
          { name: 'Recordly Project', extensions: [PROJECT_FILE_EXTENSION, ...LEGACY_PROJECT_FILE_EXTENSIONS] },
          { name: 'JSON', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true, message: 'Open project canceled' }
      }

      return await loadProjectFromPath(result.filePaths[0])
    } catch (error) {
      console.error('Failed to load project file:', error)
      return {
        success: false,
        message: 'Failed to load project file',
        error: String(error)
      }
    }
  })

  ipcMain.handle('load-current-project-file', async () => {
    try {
      if (!currentProjectPath) {
        return { success: false, message: 'No active project' }
      }

      return await loadProjectFromPath(currentProjectPath)
    } catch (error) {
      console.error('Failed to load current project file:', error)
      return {
        success: false,
        message: 'Failed to load current project file',
        error: String(error),
      }
    }
  })

  ipcMain.handle('get-projects-directory', async () => {
    try {
      return {
        success: true,
        path: await getProjectsDir(),
      }
    } catch (error) {
      return {
        success: false,
        error: String(error),
      }
    }
  })

  ipcMain.handle('list-project-files', async () => {
    try {
      const library = await listProjectLibraryEntries()
      return {
        success: true,
        projectsDir: library.projectsDir,
        entries: library.entries,
      }
    } catch (error) {
      return {
        success: false,
        projectsDir: null,
        entries: [],
        error: String(error),
      }
    }
  })

  ipcMain.handle('open-project-file-at-path', async (_, filePath: string) => {
    try {
      return await loadProjectFromPath(filePath)
    } catch (error) {
      console.error('Failed to open project file at path:', error)
      return {
        success: false,
        message: 'Failed to open project file',
        error: String(error),
      }
    }
  })

  ipcMain.handle('open-projects-directory', async () => {
    try {
      const projectsDir = await getProjectsDir()
      const openPathResult = await shell.openPath(projectsDir)
      if (openPathResult) {
        return { success: false, error: openPathResult, message: 'Failed to open projects folder.' }
      }

      return { success: true, path: projectsDir }
    } catch (error) {
      console.error('Failed to open projects folder:', error)
      return { success: false, error: String(error), message: 'Failed to open projects folder.' }
    }
  })
  ipcMain.handle('set-current-video-path', async (_, path: string) => {
    setCurrentVideoPath(normalizeVideoSourcePath(path) ?? path)
    approveUserPath(currentVideoPath)
    const resolvedSession = await resolveRecordingSession(currentVideoPath)
      ?? {
        videoPath: currentVideoPath!,
        webcamPath: null,
        timeOffsetMs: 0,
      }

    setCurrentRecordingSession(resolvedSession)
    await replaceApprovedSessionLocalReadPaths([
      resolvedSession.videoPath,
      resolvedSession.webcamPath,
    ])

    if (resolvedSession.webcamPath) {
      await persistRecordingSessionManifest(resolvedSession)
    }

    setCurrentProjectPath(null)
    return { success: true, webcamPath: resolvedSession.webcamPath ?? null }
  })

  ipcMain.handle('set-current-recording-session', async (_, session: { videoPath: string; webcamPath?: string | null; timeOffsetMs?: number }) => {
    const normalizedVideoPath = normalizeVideoSourcePath(session.videoPath) ?? session.videoPath
    setCurrentVideoPath(normalizedVideoPath)
    setCurrentRecordingSession({
      videoPath: normalizedVideoPath,
      webcamPath: normalizeVideoSourcePath(session.webcamPath ?? null),
      timeOffsetMs: normalizeRecordingTimeOffsetMs(session.timeOffsetMs),
    });
    await replaceApprovedSessionLocalReadPaths([
      currentRecordingSession!.videoPath,
      currentRecordingSession!.webcamPath,
    ])
    setCurrentProjectPath(null)
    await persistRecordingSessionManifest(currentRecordingSession!)
    return { success: true }
  })

  ipcMain.handle('get-current-recording-session', () => {
    if (!currentRecordingSession) {
      return { success: false }
    }

    return {
      success: true,
      session: currentRecordingSession,
    }
  })

  ipcMain.handle('get-current-video-path', () => {
    return currentVideoPath ? { success: true, path: currentVideoPath } : { success: false };
  });

  ipcMain.handle('clear-current-video-path', () => {
    setCurrentVideoPath(null);
    setCurrentRecordingSession(null);
    return { success: true };
  });

  ipcMain.handle('delete-recording-file', async (_, filePath: string) => {
    try {
      if (!filePath || !isAutoRecordingPath(filePath)) {
        return { success: false, error: 'Only auto-generated recordings can be deleted' };
      }
      await fs.unlink(filePath);
      // Also delete the cursor telemetry sidecar if it exists
      const telemetryPath = getTelemetryPathForVideo(filePath);
      await fs.unlink(telemetryPath).catch(() => {});
      if (currentVideoPath === filePath) {
        setCurrentVideoPath(null);
        setCurrentRecordingSession(null);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  ipcMain.handle('get-platform', () => {
    return process.platform;
  });

  // ---------------------------------------------------------------------------
  // Cursor hiding for the browser-capture fallback.
  // The IPC promise resolves only after the cursor hide attempt completes.
  // ---------------------------------------------------------------------------
  ipcMain.handle('hide-cursor', () => {
    if (process.platform !== 'win32') {
      return { success: true }
    }

    return { success: hideCursor() }
  })

  ipcMain.handle('get-shortcuts', async () => {
    try {
      const data = await fs.readFile(SHORTCUTS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  });

  ipcMain.handle('save-shortcuts', async (_, shortcuts: unknown) => {
    try {
      await fs.writeFile(SHORTCUTS_FILE, JSON.stringify(shortcuts, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('Failed to save shortcuts:', error);
      return { success: false, error: String(error) };
    }
  });

  // ---------------------------------------------------------------------------
  // Countdown timer before recording
  // ---------------------------------------------------------------------------
    ipcMain.handle('get-recording-preferences', async () => {
      try {
        const content = await fs.readFile(RECORDINGS_SETTINGS_FILE, 'utf-8')
        const parsed = JSON.parse(content) as Record<string, unknown>
        return {
          success: true,
          microphoneEnabled: parsed.microphoneEnabled === true,
          microphoneDeviceId: typeof parsed.microphoneDeviceId === 'string' ? parsed.microphoneDeviceId : undefined,
          systemAudioEnabled: parsed.systemAudioEnabled !== false,
        }
      } catch {
        return { success: true, microphoneEnabled: false, microphoneDeviceId: undefined, systemAudioEnabled: true }
      }
    })

    ipcMain.handle('set-recording-preferences', async (_, prefs: { microphoneEnabled?: boolean; microphoneDeviceId?: string; systemAudioEnabled?: boolean }) => {
      try {
        let existing: Record<string, unknown> = {}
        try {
          const content = await fs.readFile(RECORDINGS_SETTINGS_FILE, 'utf-8')
          existing = JSON.parse(content) as Record<string, unknown>
        } catch {
          // file doesn't exist yet
        }
        const merged = { ...existing, ...prefs }
        await fs.writeFile(RECORDINGS_SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8')
        return { success: true }
      } catch (error) {
        console.error('Failed to save recording preferences:', error)
        return { success: false, error: String(error) }
      }
    })

  ipcMain.handle('get-countdown-delay', async () => {
    try {
      const content = await fs.readFile(COUNTDOWN_SETTINGS_FILE, 'utf-8')
      const parsed = JSON.parse(content) as { delay?: number }
      return { success: true, delay: parsed.delay ?? 3 }
    } catch {
      return { success: true, delay: 3 }
    }
  })

  ipcMain.handle('set-countdown-delay', async (_, delay: number) => {
    try {
      await fs.writeFile(COUNTDOWN_SETTINGS_FILE, JSON.stringify({ delay }, null, 2), 'utf-8')
      return { success: true }
    } catch (error) {
      console.error('Failed to save countdown delay:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('start-countdown', async (_, seconds: number) => {
    if (countdownInProgress) {
      return { success: false, error: 'Countdown already in progress' }
    }

    setCountdownInProgress(true)
    setCountdownCancelled(false)
    setCountdownRemaining(seconds)

    const countdownWin = createCountdownWindow()

    if (countdownWin.webContents.isLoadingMainFrame()) {
      await new Promise<void>((resolve) => {
        countdownWin.webContents.once('did-finish-load', () => {
          resolve()
        })
      })
    }

    return new Promise<{ success: boolean; cancelled?: boolean }>((resolve) => {
      let remaining = seconds
      setCountdownRemaining(remaining)

      countdownWin.webContents.send('countdown-tick', remaining)

      setCountdownTimer(setInterval(() => {
        if (countdownCancelled) {
          if (countdownTimer) {
            clearInterval(countdownTimer)
            setCountdownTimer(null)
          }
          closeCountdownWindow()
          setCountdownInProgress(false)
          setCountdownRemaining(null)
          resolve({ success: false, cancelled: true })
          return
        }

        remaining--
        setCountdownRemaining(remaining)

        if (remaining <= 0) {
          if (countdownTimer) {
            clearInterval(countdownTimer)
            setCountdownTimer(null)
          }
          closeCountdownWindow()
          setCountdownInProgress(false)
          setCountdownRemaining(null)
          resolve({ success: true })
        } else {
          const win = getCountdownWindow()
          if (win && !win.isDestroyed()) {
            win.webContents.send('countdown-tick', remaining)
          }
        }
      }, 1000))
    })
  })

  ipcMain.handle('cancel-countdown', () => {
    setCountdownCancelled(true)
    setCountdownInProgress(false)
    setCountdownRemaining(null)
    if (countdownTimer) {
      clearInterval(countdownTimer)
      setCountdownTimer(null)
    }
    closeCountdownWindow()
    return { success: true }
  })

  ipcMain.handle('get-active-countdown', () => {
    return {
      success: true,
      seconds: countdownInProgress ? countdownRemaining : null,
    }
  })
}
