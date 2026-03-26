import { app, BrowserWindow, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import type { MessageBoxOptions, MessageBoxReturnValue } from "electron";

const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const AUTO_UPDATES_ENABLED = process.env.RECORDLY_ENABLE_AUTO_UPDATES === "1";

let updaterInitialized = false;
let updateCheckInProgress = false;
let manualCheckRequested = false;
let periodicCheckTimer: NodeJS.Timeout | null = null;

function canUseAutoUpdates() {
	return AUTO_UPDATES_ENABLED && app.isPackaged && !process.mas;
}

export function isAutoUpdateFeatureEnabled() {
	return AUTO_UPDATES_ENABLED;
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

export async function checkForAppUpdates(
	getMainWindow: () => BrowserWindow | null,
	options?: { manual?: boolean },
) {
	if (!canUseAutoUpdates()) {
		if (options?.manual) {
			await showMessageBox(getMainWindow, {
				type: "info",
				title: "Updates Not Enabled",
				message: "Auto-updates are not enabled in this build.",
				detail: "The updater infrastructure is present, but release publishing and signed distribution are not enabled yet.",
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

export function setupAutoUpdates(getMainWindow: () => BrowserWindow | null) {
	if (updaterInitialized || !canUseAutoUpdates()) {
		return;
	}

	updaterInitialized = true;
	autoUpdater.autoDownload = true;
	autoUpdater.autoInstallOnAppQuit = true;

	autoUpdater.on("update-available", (info) => {
		updateCheckInProgress = false;
		if (!manualCheckRequested) {
			return;
		}

		void showMessageBox(getMainWindow, {
			type: "info",
			title: "Update Available",
			message: `Recordly ${info.version} is available.`,
			detail: "The update is downloading in the background and you will be prompted to restart when it is ready.",
		});
	});

	autoUpdater.on("update-not-available", () => {
		updateCheckInProgress = false;
		const shouldReport = manualCheckRequested;
		manualCheckRequested = false;
		if (shouldReport) {
			void showNoUpdatesDialog(getMainWindow);
		}
	});

	autoUpdater.on("error", (error) => {
		updateCheckInProgress = false;
		const shouldReport = manualCheckRequested;
		manualCheckRequested = false;
		console.error("Auto-updater error:", error);
		if (shouldReport) {
			void showUpdateErrorDialog(getMainWindow, error);
		}
	});

	autoUpdater.on("update-downloaded", async (info) => {
		updateCheckInProgress = false;
		manualCheckRequested = false;

		const result = await showMessageBox(getMainWindow, {
			type: "info",
			title: "Update Ready",
			message: `Recordly ${info.version} has been downloaded.`,
			detail: "Restart the app now to install the update.",
			buttons: ["Restart Now", "Later"],
			defaultId: 0,
			cancelId: 1,
		});

		if (result.response === 0) {
			setImmediate(() => {
				autoUpdater.quitAndInstall();
			});
		}
	});

	void checkForAppUpdates(getMainWindow);
	periodicCheckTimer = setInterval(() => {
		void checkForAppUpdates(getMainWindow);
	}, UPDATE_CHECK_INTERVAL_MS);

	app.on("before-quit", () => {
		if (periodicCheckTimer) {
			clearInterval(periodicCheckTimer);
			periodicCheckTimer = null;
		}
	});
}