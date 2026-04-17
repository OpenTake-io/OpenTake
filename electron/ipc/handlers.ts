import { BrowserWindow } from "electron";
import {
	windowsCaptureProcess,
	setWindowsCaptureProcess,
	setWindowsCaptureTargetPath,
	setWindowsNativeCaptureActive,
	setNativeScreenRecordingActive,
	setWindowsCaptureStopRequested,
	setWindowsCapturePaused,
	setWindowsSystemAudioPath,
	setWindowsMicAudioPath,
	setWindowsPendingVideoPath,
	selectedSource,
} from "./state";
import { registerSourceHandlers } from "./register/sources";
import { registerRecordingHandlers } from "./register/recording";
import { registerPermissionHandlers } from "./register/permissions";
import { registerAssetHandlers } from "./register/assets";
import { registerExportHandlers } from "./register/export";
import { registerCaptionHandlers } from "./register/captions";
import { registerProjectHandlers } from "./register/project";
import { registerSettingsHandlers } from "./register/settings";

export { cleanupNativeVideoExportSessions } from "./export/native-video";

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

export function registerIpcHandlers(
	createEditorWindow: () => void,
	createSourceSelectorWindow: () => BrowserWindow,
	_getMainWindow: () => BrowserWindow | null,
	getSourceSelectorWindow: () => BrowserWindow | null,
	onRecordingStateChange?: (recording: boolean, sourceName: string) => void,
) {
	registerSourceHandlers({ createEditorWindow, createSourceSelectorWindow, getSourceSelectorWindow });
	registerRecordingHandlers(onRecordingStateChange);
	registerPermissionHandlers();
	registerAssetHandlers();
	registerExportHandlers();
	registerCaptionHandlers();
	registerProjectHandlers();
	registerSettingsHandlers();
}
