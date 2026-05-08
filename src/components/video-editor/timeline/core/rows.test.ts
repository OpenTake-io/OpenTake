import { describe, expect, it } from "vitest";
import {
	getAnnotationTrackIndex,
	getAnnotationTrackRowId,
	getAudioTrackIndex,
	getAudioTrackRowId,
	isAnnotationTrackRowId,
	isAudioTrackRowId,
} from "./rows";

describe("timeline core/rows", () => {
	it("builds and parses annotation rows", () => {
		expect(getAnnotationTrackRowId(2.9)).toBe("row-annotation-2");
		expect(getAnnotationTrackIndex("row-annotation-4")).toBe(4);
		expect(isAnnotationTrackRowId("row-annotation")).toBe(true);
	});

	it("builds and parses audio rows", () => {
		expect(getAudioTrackRowId(1.2)).toBe("row-audio-1");
		expect(getAudioTrackIndex("row-audio-3")).toBe(3);
		expect(isAudioTrackRowId("row-audio")).toBe(true);
	});
});
