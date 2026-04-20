export interface HudInteractiveBounds {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

export function shouldRestoreHudMousePassthroughAfterDrag(
	bounds: HudInteractiveBounds | null,
	clientX: number,
	clientY: number,
): boolean {
	if (!bounds) {
		return true;
	}

	return (
		clientX < bounds.left ||
		clientX > bounds.right ||
		clientY < bounds.top ||
		clientY > bounds.bottom
	);
}
