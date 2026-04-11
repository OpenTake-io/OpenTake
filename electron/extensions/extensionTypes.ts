/**
 * Re-export of extension types for use in the main process.
 * The canonical types live in src/lib/extensions/types.ts.
 * This file mirrors the subset needed by the electron layer.
 */

export type ExtensionPermission =
	| "render"
	| "cursor"
	| "audio"
	| "timeline"
	| "ui"
	| "assets"
	| "export";

export interface ExtensionManifest {
	id: string;
	name: string;
	version: string;
	description: string;
	author?: string;
	homepage?: string;
	license?: string;
	engine?: string;
	icon?: string;
	main: string;
	permissions: ExtensionPermission[];
	contributes?: ExtensionContributions;
}

export interface ExtensionContributions {
	/** Informational manifest metadata only; runtime registration still happens from activate(). */
	cursorStyles?: {
		id: string;
		label: string;
		defaultImage: string;
		clickImage?: string;
		hotspot?: { x: number; y: number };
	}[];
	sounds?: { id: string; label: string; category: string; file: string; durationMs?: number }[];
	wallpapers?: { id: string; label: string; file: string; thumbnail?: string; isVideo?: boolean }[];
	webcamFrames?: { id: string; label: string; file: string; thumbnail?: string }[];
}

export type ExtensionStatus = "installed" | "active" | "disabled" | "error";

export interface ExtensionInfo {
	manifest: ExtensionManifest;
	status: ExtensionStatus;
	path: string;
	error?: string;
	builtin?: boolean;
}

// ---------------------------------------------------------------------------
// Marketplace Types
// ---------------------------------------------------------------------------

export type MarketplaceReviewStatus = "pending" | "approved" | "rejected" | "flagged";

export interface MarketplaceExtension {
	id: string;
	name: string;
	version: string;
	description: string;
	author: string;
	downloadUrl: string;
	iconUrl?: string;
	screenshots?: string[];
	downloads: number;
	rating: number;
	ratingCount: number;
	tags: string[];
	permissions: ExtensionPermission[];
	reviewStatus: MarketplaceReviewStatus;
	publishedAt: string;
	updatedAt: string;
	installed?: boolean;
}

export interface MarketplaceSearchResult {
	extensions: MarketplaceExtension[];
	total: number;
	page: number;
	pageSize: number;
}

export interface ExtensionReview {
	id: string;
	extensionId: string;
	extensionName: string;
	version: string;
	author: string;
	submittedAt: string;
	status: MarketplaceReviewStatus;
	reviewNotes?: string;
	manifest: ExtensionManifest;
	downloadUrl: string;
}
