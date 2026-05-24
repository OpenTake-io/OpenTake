export interface HudOverlayWorkArea {
	x: number;
	y: number;
	width: number;
	height: number;
}

const NON_PASSTHROUGH_HUD_WIDTH_DIP = 860;
const NON_PASSTHROUGH_HUD_COMPACT_HEIGHT_DIP = 160;
const NON_PASSTHROUGH_HUD_EXPANDED_HEIGHT_DIP = 540;

export function getHudOverlayWindowBounds(
	workArea: HudOverlayWorkArea,
	mousePassthroughSupported: boolean,
	fallbackExpanded = false,
): HudOverlayWorkArea {
	if (mousePassthroughSupported) {
		return { ...workArea };
	}

	const width = Math.min(workArea.width, NON_PASSTHROUGH_HUD_WIDTH_DIP);
	const height = Math.min(
		workArea.height,
		fallbackExpanded
			? NON_PASSTHROUGH_HUD_EXPANDED_HEIGHT_DIP
			: NON_PASSTHROUGH_HUD_COMPACT_HEIGHT_DIP,
	);

	return {
		x: Math.round(workArea.x + (workArea.width - width) / 2),
		y: Math.round(workArea.y + workArea.height - height),
		width,
		height,
	};
}
