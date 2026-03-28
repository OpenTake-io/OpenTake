import { app, BrowserWindow, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import type { MessageBoxOptions, MessageBoxReturnValue } from "electron";

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const UPDATE_REMINDER_DELAY_MS = 3 * 60 * 60 * 1000;
const DISMISSED_READY_REMINDER_DELAY_MS = 5 * 60 * 1000;
const AUTO_UPDATES_DISABLED = process.env.RECORDLY_DISABLE_AUTO_UPDATES === "1";
const DEV_UPDATE_PREVIEW_VERSION = "9.9.9";
const DEV_UPDATE_PREVIEW_PROGRESS_STEP_MS = 300;
const DEV_UPDATE_PREVIEW_PROGRESS_INCREMENT = 20;

export type UpdateToastPhase = "available" | "downloading" | "ready" | "error";

export interface UpdateToastPayload {
	version: string;
	detail: string;
	phase: UpdateToastPhase;
	delayMs: number;
	isPreview?: boolean;
	progressPercent?: number;
}

type UpdateToastSender = (
	channel: "update-toast-state",
	payload: UpdateToastPayload | null,
) => boolean;

let updaterInitialized = false;
let updateCheckInProgress = false;
let manualCheckRequested = false;
let periodicCheckTimer: NodeJS.Timeout | null = null;
let deferredReminderTimer: NodeJS.Timeout | null = null;
let devPreviewProgressTimer: NodeJS.Timeout | null = null;
let currentToastPayload: UpdateToastPayload | null = null;
let availableVersion: string | null = null;
let pendingDownloadedVersion: string | null = null;
let downloadInProgress = false;
let downloadToastDismissed = false;
let skippedVersion: string | null = null;

function canUseAutoUpdates() {
	return !AUTO_UPDATES_DISABLED && app.isPackaged && !process.mas;
}

export function isAutoUpdateFeatureEnabled() {
	return !AUTO_UPDATES_DISABLED;
}

function getDialogWindow(getMainWindow: () => BrowserWindow | null) {
	const window = getMainWindow();
	return window && !window.isDestroyed() ? window : undefined;
}

function showMessageBox(
	getMainWindow: () => BrowserWindow | null,
	options: MessageBoxOptions,
): Promise<MessageBoxReturnValue> {
	const window = getDialogWindow(getMainWindow);
	return window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options);
}

function clearDeferredReminderTimer() {
	if (deferredReminderTimer) {
		clearTimeout(deferredReminderTimer);
		deferredReminderTimer = null;
	}
}

function clearDevPreviewProgressTimer() {
	if (devPreviewProgressTimer) {
		clearInterval(devPreviewProgressTimer);
		devPreviewProgressTimer = null;
	}
}

function emitUpdateToastState(
	sendToRenderer: UpdateToastSender | undefined,
	payload: UpdateToastPayload | null,
) {
	currentToastPayload = payload;
	if (!sendToRenderer) {
		return false;
	}

	return sendToRenderer("update-toast-state", payload);
}

function createAvailableUpdateToastPayload(version: string): UpdateToastPayload {
	return {
		version,
		phase: "available",
		detail: "A new version is available. Download it now, or wait and we will remind you again in 3 hours.",
		delayMs: UPDATE_REMINDER_DELAY_MS,
	};
}

function createDownloadingUpdateToastPayload(
	version: string,
	progressPercent = 0,
): UpdateToastPayload {
	const normalizedProgress = Math.max(0, Math.min(100, progressPercent));
	return {
		version,
		phase: "downloading",
		detail:
			normalizedProgress >= 100
				? "Finishing the update download. You can keep using Recordly while this completes."
				: `Downloading the update in the foreground: ${normalizedProgress.toFixed(0)}% complete.`,
		delayMs: UPDATE_REMINDER_DELAY_MS,
		progressPercent: normalizedProgress,
	};
}

function createDownloadedUpdateToastPayload(version: string): UpdateToastPayload {
	return {
		version,
		phase: "ready",
		detail: "Install now to restart into the new version, or wait and we will remind you again in 3 hours.",
		delayMs: UPDATE_REMINDER_DELAY_MS,
	};
}

function createUpdateErrorToastPayload(version: string, error: unknown): UpdateToastPayload {
	return {
		version,
		phase: "error",
		detail: `The update download failed. ${String(error)}`,
		delayMs: UPDATE_REMINDER_DELAY_MS,
	};
}

function getReminderPayload(): UpdateToastPayload | null {
	if (pendingDownloadedVersion) {
		return createDownloadedUpdateToastPayload(pendingDownloadedVersion);
	}

	if (availableVersion && !downloadInProgress) {
		return createAvailableUpdateToastPayload(availableVersion);
	}

	return null;
}

function clearVisibleUpdateToast(sendToRenderer?: UpdateToastSender) {
	emitUpdateToastState(sendToRenderer, null);
}

export function getCurrentUpdateToastPayload() {
	return currentToastPayload;
}

async function showNoUpdatesDialog(getMainWindow: () => BrowserWindow | null) {
	await showMessageBox(getMainWindow, {
		type: "info",
		title: "No Updates Available",
		message: "Recordly is up to date.",
		detail: `You are running version ${app.getVersion()}.`,
	});
}

async function showUpdateErrorDialog(getMainWindow: () => BrowserWindow | null, error: unknown) {
	await showMessageBox(getMainWindow, {
		type: "error",
		title: "Update Check Failed",
		message: "Recordly could not check for updates.",
		detail: String(error),
	});
}

function resetDevPreviewState(sendToRenderer?: UpdateToastSender) {
	clearDevPreviewProgressTimer();
	availableVersion = null;
	pendingDownloadedVersion = null;
	downloadInProgress = false;
	downloadToastDismissed = false;
	skippedVersion = null;
	clearVisibleUpdateToast(sendToRenderer);
}

function simulateDevPreviewDownload(sendToRenderer?: UpdateToastSender) {
	availableVersion = DEV_UPDATE_PREVIEW_VERSION;
	pendingDownloadedVersion = null;
	downloadInProgress = true;
	downloadToastDismissed = false;
	clearDeferredReminderTimer();
	clearDevPreviewProgressTimer();

	let progressPercent = 0;
	emitUpdateToastState(
		sendToRenderer,
		{
			...createDownloadingUpdateToastPayload(DEV_UPDATE_PREVIEW_VERSION, progressPercent),
			isPreview: true,
		},
	);

	devPreviewProgressTimer = setInterval(() => {
		progressPercent = Math.min(100, progressPercent + DEV_UPDATE_PREVIEW_PROGRESS_INCREMENT);

		if (progressPercent >= 100) {
			clearDevPreviewProgressTimer();
			downloadInProgress = false;
			pendingDownloadedVersion = DEV_UPDATE_PREVIEW_VERSION;
			emitUpdateToastState(sendToRenderer, {
				...createDownloadedUpdateToastPayload(DEV_UPDATE_PREVIEW_VERSION),
				isPreview: true,
				detail: "Development preview: the update is ready to install. No real update will be installed.",
			});
			return;
		}

		if (downloadToastDismissed) {
			return;
		}

		emitUpdateToastState(
			sendToRenderer,
			{
				...createDownloadingUpdateToastPayload(DEV_UPDATE_PREVIEW_VERSION, progressPercent),
				isPreview: true,
			},
		);
	}, DEV_UPDATE_PREVIEW_PROGRESS_STEP_MS);

	return { success: true };
}


export function dismissUpdateToast(
	getMainWindow: () => BrowserWindow | null,
	sendToRenderer?: UpdateToastSender,
) {
	if (currentToastPayload?.isPreview) {
		resetDevPreviewState(sendToRenderer);
		return { success: true };
	}

	if (downloadInProgress) {
		downloadToastDismissed = true;
		clearVisibleUpdateToast(sendToRenderer);
		return { success: true };
	}

	if (currentToastPayload?.phase === "ready") {
		return deferUpdateReminder(
			getMainWindow,
			sendToRenderer,
			DISMISSED_READY_REMINDER_DELAY_MS,
		);
	}

	if (currentToastPayload?.phase === "available" || currentToastPayload?.phase === "error") {
		return deferUpdateReminder(getMainWindow, sendToRenderer, UPDATE_REMINDER_DELAY_MS);
	}

	clearVisibleUpdateToast(sendToRenderer);
	return { success: true };
}

export function installDownloadedUpdateNow(sendToRenderer?: UpdateToastSender) {
	if (currentToastPayload?.isPreview) {
		resetDevPreviewState(sendToRenderer);
		return;
	}

	clearDeferredReminderTimer();
	downloadToastDismissed = false;
	clearVisibleUpdateToast(sendToRenderer);
	autoUpdater.quitAndInstall();
}

export async function downloadAvailableUpdate(sendToRenderer?: UpdateToastSender) {
	if (currentToastPayload?.isPreview) {
		return simulateDevPreviewDownload(sendToRenderer);
	}

	if (!availableVersion) {
		return { success: false, message: "No update is ready to download." };
	}

	if (pendingDownloadedVersion === availableVersion) {
		return { success: false, message: "This update has already been downloaded." };
	}

	if (downloadInProgress) {
		return { success: false, message: "This update is already downloading." };
	}

	clearDeferredReminderTimer();
	downloadInProgress = true;
	downloadToastDismissed = false;
	emitUpdateToastState(sendToRenderer, createDownloadingUpdateToastPayload(availableVersion, 0));

	try {
		await autoUpdater.downloadUpdate();
		return { success: true };
	} catch (error) {
		downloadInProgress = false;
		emitUpdateToastState(
			sendToRenderer,
			createUpdateErrorToastPayload(availableVersion, error),
		);
		return { success: false, message: String(error) };
	}
}

export function deferUpdateReminder(
	getMainWindow: () => BrowserWindow | null,
	sendToRenderer?: UpdateToastSender,
	delayMs = UPDATE_REMINDER_DELAY_MS,
) {
	const payload = getReminderPayload();
	if (!payload) {
		return { success: false, message: "No update reminder is ready yet." };
	}

	clearDeferredReminderTimer();
	clearVisibleUpdateToast(sendToRenderer);
	deferredReminderTimer = setTimeout(() => {
		const nextPayload = getReminderPayload();
		if (!nextPayload) {
			return;
		}

		if (sendToRenderer && emitUpdateToastState(sendToRenderer, nextPayload)) {
			return;
		}

		if (nextPayload.phase === "ready") {
			void showDownloadedUpdateDialog(getMainWindow, nextPayload.version);
			return;
		}

		void showAvailableUpdateDialog(getMainWindow, nextPayload.version, sendToRenderer);
	}, delayMs);

	return { success: true };
}

export function skipAvailableUpdateVersion(sendToRenderer?: UpdateToastSender) {
	const versionToSkip = pendingDownloadedVersion ?? availableVersion;
	if (!versionToSkip) {
		return { success: false, message: "No update is available to skip." };
	}

	skippedVersion = versionToSkip;
	if (pendingDownloadedVersion === versionToSkip) {
		pendingDownloadedVersion = null;
	}
	if (availableVersion === versionToSkip) {
		availableVersion = null;
	}
	downloadInProgress = false;
	downloadToastDismissed = false;
	clearDeferredReminderTimer();
	clearVisibleUpdateToast(sendToRenderer);

	return { success: true };
}

export function previewUpdateToast(sendToRenderer: UpdateToastSender) {
	clearDeferredReminderTimer();
	clearDevPreviewProgressTimer();
	availableVersion = DEV_UPDATE_PREVIEW_VERSION;
	pendingDownloadedVersion = null;
	downloadInProgress = false;
	downloadToastDismissed = false;
	return emitUpdateToastState(sendToRenderer, {
		version: DEV_UPDATE_PREVIEW_VERSION,
		phase: "available",
		detail: "This is a development preview of the in-app update toast.",
		delayMs: UPDATE_REMINDER_DELAY_MS,
		isPreview: true,
	});
}

async function showAvailableUpdateDialog(
	getMainWindow: () => BrowserWindow | null,
	version: string,
	sendToRenderer?: UpdateToastSender,
) {
	const result = await showMessageBox(getMainWindow, {
		type: "info",
		title: "Update Available",
		message: `Recordly ${version} is available.`,
		detail: "Download now, remind me in 3 hours, or skip this version.",
		buttons: ["Download Update", "Remind Me in 3 Hours", "Skip This Version"],
		defaultId: 0,
		cancelId: 1,
		noLink: true,
	});

	if (result.response === 0) {
		await downloadAvailableUpdate(sendToRenderer);
		return;
	}

	if (result.response === 1) {
		deferUpdateReminder(getMainWindow, sendToRenderer, UPDATE_REMINDER_DELAY_MS);
		return;
	}

	skipAvailableUpdateVersion(sendToRenderer);
}

async function showDownloadedUpdateDialog(
	getMainWindow: () => BrowserWindow | null,
	version: string,
    options?: { isPreview?: boolean },
) {
	const isPreview = Boolean(options?.isPreview);
	const result = await showMessageBox(getMainWindow, {
		type: "info",
		title: "Update Ready",
		message: isPreview
			? `Recordly ${version} is ready to install.`
			: `Recordly ${version} has been downloaded.`,
		detail: isPreview
			? "Development preview of the native update prompt. No real update will be installed."
			: "Install now, remind me in 3 hours, or skip this version.",
		buttons: ["Install Update", "Remind Me in 3 Hours", "Skip This Version"],
		defaultId: 0,
		cancelId: 1,
		noLink: true,
	});

	if (result.response === 0) {
		if (isPreview) {
			await showMessageBox(getMainWindow, {
				type: "info",
				title: "Preview Only",
				message: "No real update was installed.",
				detail: "This was only a manual development preview of the update prompt.",
			});
			return;
		}

		clearDeferredReminderTimer();
		setImmediate(() => {
			installDownloadedUpdateNow();
		});
		return;
	}

	if (result.response === 1) {
		if (isPreview) {
			return;
		}

		deferUpdateReminder(getMainWindow, undefined, UPDATE_REMINDER_DELAY_MS);
		return;
	}

	if (isPreview) {
		return;
	}

	skipAvailableUpdateVersion();
}

export async function checkForAppUpdates(
	getMainWindow: () => BrowserWindow | null,
	options?: { manual?: boolean },
) {
	if (!canUseAutoUpdates()) {
		if (options?.manual) {
			await showMessageBox(getMainWindow, {
				type: "info",
				title: "Updates Not Enabled",
				message: "Auto-updates are only available in packaged releases.",
				detail: AUTO_UPDATES_DISABLED
					? "This build disabled auto-updates through RECORDLY_DISABLE_AUTO_UPDATES=1."
					: "Development builds do not ship the packaged update metadata required by electron-updater.",
			});
		}
		return;
	}

	if (updateCheckInProgress) {
		if (options?.manual) {
			await showMessageBox(getMainWindow, {
				type: "info",
				title: "Update Check In Progress",
				message: "Recordly is already checking for updates.",
			});
		}
		return;
	}

	manualCheckRequested = Boolean(options?.manual);
	updateCheckInProgress = true;

	try {
		await autoUpdater.checkForUpdates();
	} catch (error) {
		updateCheckInProgress = false;
		const shouldReport = manualCheckRequested;
		manualCheckRequested = false;
		console.error("Auto-update check failed:", error);
		if (shouldReport) {
			await showUpdateErrorDialog(getMainWindow, error);
		}
	}
}

export function setupAutoUpdates(
	getMainWindow: () => BrowserWindow | null,
	sendToRenderer: UpdateToastSender,
) {
	if (updaterInitialized) {
		return;
	}

	if (!canUseAutoUpdates()) {
		return;
	}

	updaterInitialized = true;
	autoUpdater.autoDownload = false;
	autoUpdater.autoInstallOnAppQuit = false;

	autoUpdater.on("update-available", (info) => {
		updateCheckInProgress = false;
		availableVersion = info.version;
		pendingDownloadedVersion = null;
		downloadInProgress = false;
		downloadToastDismissed = false;
		if (skippedVersion === info.version) {
			manualCheckRequested = false;
			return;
		}

		const payload = createAvailableUpdateToastPayload(info.version);
		if (emitUpdateToastState(sendToRenderer, payload)) {
			manualCheckRequested = false;
			return;
		}

		if (manualCheckRequested) {
			void showAvailableUpdateDialog(getMainWindow, info.version, sendToRenderer);
			manualCheckRequested = false;
		}
	});

	autoUpdater.on("update-not-available", () => {
		updateCheckInProgress = false;
		availableVersion = null;
		pendingDownloadedVersion = null;
		downloadInProgress = false;
		downloadToastDismissed = false;
		clearVisibleUpdateToast(sendToRenderer);
		const shouldReport = manualCheckRequested;
		manualCheckRequested = false;
		if (shouldReport) {
			void showNoUpdatesDialog(getMainWindow);
		}
	});

	autoUpdater.on("download-progress", (progress) => {
		if (!availableVersion) {
			return;
		}

		downloadInProgress = true;
		if (downloadToastDismissed) {
			return;
		}

		emitUpdateToastState(
			sendToRenderer,
			createDownloadingUpdateToastPayload(availableVersion, progress.percent),
		);
	});

	autoUpdater.on("error", (error) => {
		updateCheckInProgress = false;
		const shouldReport = manualCheckRequested;
		manualCheckRequested = false;
		console.error("Auto-updater error:", error);
		if (downloadInProgress && availableVersion) {
			downloadInProgress = false;
			downloadToastDismissed = false;
			emitUpdateToastState(
				sendToRenderer,
				createUpdateErrorToastPayload(availableVersion, error),
			);
		}
		if (shouldReport) {
			void showUpdateErrorDialog(getMainWindow, error);
		}
	});

	autoUpdater.on("update-downloaded", (info) => {
		updateCheckInProgress = false;
		manualCheckRequested = false;
		downloadInProgress = false;
		downloadToastDismissed = false;
		if (skippedVersion === info.version) {
			return;
		}
		availableVersion = info.version;
		pendingDownloadedVersion = info.version;
		clearDeferredReminderTimer();

		if (emitUpdateToastState(sendToRenderer, createDownloadedUpdateToastPayload(info.version))) {
			return;
		}

		void showDownloadedUpdateDialog(getMainWindow, info.version);
	});

	void checkForAppUpdates(getMainWindow);
	periodicCheckTimer = setInterval(() => {
		void checkForAppUpdates(getMainWindow);
	}, UPDATE_CHECK_INTERVAL_MS);

	app.on("before-quit", () => {
		clearDeferredReminderTimer();
		clearDevPreviewProgressTimer();
		if (periodicCheckTimer) {
			clearInterval(periodicCheckTimer);
			periodicCheckTimer = null;
		}
	});
}