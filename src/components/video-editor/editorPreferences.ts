import { ASPECT_RATIOS, type AspectRatio, isCustomAspectRatio } from "@/utils/aspectRatioUtils";

export interface EditorPreferences {
	aspectRatio: AspectRatio;
	customAspectWidth: string;
	customAspectHeight: string;
}

export const EDITOR_PREFERENCES_STORAGE_KEY = "recordly.editor.preferences";

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
	aspectRatio: "16:9",
	customAspectWidth: "16",
	customAspectHeight: "9",
};

function isStoredAspectRatio(value: unknown): value is AspectRatio {
	return (
		typeof value === "string" &&
		((ASPECT_RATIOS as readonly string[]).includes(value) || isCustomAspectRatio(value))
	);
}

function normalizePositiveIntegerString(value: unknown, fallback: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		return fallback;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}

	return String(parsed);
}

export function normalizeEditorPreferences(
	candidate: unknown,
	fallback: EditorPreferences = DEFAULT_EDITOR_PREFERENCES,
): EditorPreferences {
	const raw =
		candidate && typeof candidate === "object" ? (candidate as Partial<EditorPreferences>) : {};

	return {
		aspectRatio: isStoredAspectRatio(raw.aspectRatio) ? raw.aspectRatio : fallback.aspectRatio,
		customAspectWidth: normalizePositiveIntegerString(
			raw.customAspectWidth,
			fallback.customAspectWidth,
		),
		customAspectHeight: normalizePositiveIntegerString(
			raw.customAspectHeight,
			fallback.customAspectHeight,
		),
	};
}

export function loadEditorPreferences(): EditorPreferences {
	if (typeof globalThis.localStorage === "undefined") {
		return DEFAULT_EDITOR_PREFERENCES;
	}

	try {
		const stored = globalThis.localStorage.getItem(EDITOR_PREFERENCES_STORAGE_KEY);
		if (!stored) {
			return DEFAULT_EDITOR_PREFERENCES;
		}

		return normalizeEditorPreferences(JSON.parse(stored));
	} catch {
		return DEFAULT_EDITOR_PREFERENCES;
	}
}

export function saveEditorPreferences(preferences: Partial<EditorPreferences>): void {
	if (typeof globalThis.localStorage === "undefined") {
		return;
	}

	try {
		const current = loadEditorPreferences();
		const merged = normalizeEditorPreferences({ ...current, ...preferences }, current);
		globalThis.localStorage.setItem(EDITOR_PREFERENCES_STORAGE_KEY, JSON.stringify(merged));
	} catch {
		// Ignore storage failures so editor controls still work.
	}
}
