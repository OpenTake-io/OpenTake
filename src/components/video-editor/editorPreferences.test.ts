import { afterEach, describe, expect, it, vi } from "vitest";

import {
	DEFAULT_EDITOR_PREFERENCES,
	EDITOR_PREFERENCES_STORAGE_KEY,
	loadEditorPreferences,
	normalizeEditorPreferences,
	saveEditorPreferences,
} from "./editorPreferences";

function createStorageMock(initialValues: Record<string, string> = {}): Storage {
	const store = new Map(Object.entries(initialValues));

	return {
		get length() {
			return store.size;
		},
		clear() {
			store.clear();
		},
		getItem(key) {
			return store.get(key) ?? null;
		},
		key(index) {
			return Array.from(store.keys())[index] ?? null;
		},
		removeItem(key) {
			store.delete(key);
		},
		setItem(key, value) {
			store.set(key, value);
		},
	};
}

describe("editorPreferences", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("normalizes invalid values back to safe defaults", () => {
		expect(
			normalizeEditorPreferences({
				aspectRatio: "bad-value",
				customAspectWidth: "0",
				customAspectHeight: "",
			}),
		).toEqual(DEFAULT_EDITOR_PREFERENCES);
	});

	it("loads stored aspect ratio preferences", () => {
		vi.stubGlobal(
			"localStorage",
			createStorageMock({
				[EDITOR_PREFERENCES_STORAGE_KEY]: JSON.stringify({
					aspectRatio: "native",
					customAspectWidth: "21",
					customAspectHeight: "9",
				}),
			}),
		);

		expect(loadEditorPreferences()).toEqual({
			aspectRatio: "native",
			customAspectWidth: "21",
			customAspectHeight: "9",
		});
	});

	it("preserves the last valid custom aspect inputs while typing", () => {
		const localStorage = createStorageMock({
			[EDITOR_PREFERENCES_STORAGE_KEY]: JSON.stringify({
				aspectRatio: "16:9",
				customAspectWidth: "21",
				customAspectHeight: "9",
			}),
		});
		vi.stubGlobal("localStorage", localStorage);

		saveEditorPreferences({ customAspectWidth: "", customAspectHeight: "abc" });

		expect(loadEditorPreferences()).toEqual({
			aspectRatio: "16:9",
			customAspectWidth: "21",
			customAspectHeight: "9",
		});
	});
});
