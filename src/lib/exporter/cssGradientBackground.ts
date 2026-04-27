type GradientStop = {
	color: string;
	position?: number;
};

type LinearGradientLayer = {
	type: "linear";
	angleDeg: number;
	stops: GradientStop[];
};

type RadialGradientLayer = {
	type: "radial";
	centerX: number;
	centerY: number;
	radiusX: number;
	radiusY: number;
	stops: GradientStop[];
};

type GradientLayer = LinearGradientLayer | RadialGradientLayer;

const COLOR_PREFIX_PATTERN =
	/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-zA-Z]+)\s*(.*)$/;

export function isCssGradientBackground(value: string): boolean {
	if (!value) {
		return false;
	}

	return value.startsWith("linear-gradient") || value.startsWith("radial-gradient");
}

export function paintCssGradientBackground(
	ctx: CanvasRenderingContext2D,
	background: string,
	width: number,
	height: number,
): boolean {
	const layers = splitTopLevel(background)
		.map((layer) => layer.trim())
		.filter((layer) => layer.length > 0)
		.map((layer) => parseGradientLayer(layer, width, height));

	if (layers.length === 0 || layers.some((layer) => layer === null)) {
		return false;
	}

	for (const layer of [...(layers as GradientLayer[])].reverse()) {
		drawGradientLayer(ctx, layer, width, height);
	}

	return true;
}

function splitTopLevel(value: string): string[] {
	const parts: string[] = [];
	let current = "";
	let depth = 0;

	for (const character of value) {
		if (character === "(") {
			depth += 1;
		} else if (character === ")") {
			depth = Math.max(0, depth - 1);
		}

		if (character === "," && depth === 0) {
			parts.push(current);
			current = "";
			continue;
		}

		current += character;
	}

	if (current.trim().length > 0) {
		parts.push(current);
	}

	return parts;
}

function parseGradientLayer(
	layer: string,
	width: number,
	height: number,
): GradientLayer | null {
	const match = layer.match(/^(linear|radial)-gradient\((.*)\)$/i);
	if (!match) {
		return null;
	}

	const [, rawType, rawParams] = match;
	const parts = splitTopLevel(rawParams).map((part) => part.trim()).filter(Boolean);
	if (parts.length === 0) {
		return null;
	}

	if (rawType === "linear") {
		return parseLinearGradient(parts, width, height);
	}

	return parseRadialGradient(parts, width, height);
}

function parseLinearGradient(
	parts: string[],
	_width: number,
	_height: number,
): LinearGradientLayer | null {
	let angleDeg = 180;
	let stopParts = parts;

	if (parts[0] && isLinearDirection(parts[0])) {
		angleDeg = parseLinearAngle(parts[0]);
		stopParts = parts.slice(1);
	}

	const stops = parseGradientStops(stopParts);
	if (stops.length === 0) {
		return null;
	}

	return { type: "linear", angleDeg, stops };
}

function parseRadialGradient(
	parts: string[],
	width: number,
	height: number,
): RadialGradientLayer | null {
	let descriptor = "";
	let stopParts = parts;

	if (parts[0] && !startsWithColor(parts[0])) {
		descriptor = parts[0];
		stopParts = parts.slice(1);
	}

	const stops = parseGradientStops(stopParts);
	if (stops.length === 0) {
		return null;
	}

	const defaults = {
		centerX: width / 2,
		centerY: height / 2,
		radiusX: Math.max(width, height) / 2,
		radiusY: Math.max(width, height) / 2,
	};

	if (!descriptor) {
		return { type: "radial", ...defaults, stops };
	}

	const positionMatch = descriptor.match(/at\s+([0-9.]+)%\s+([0-9.]+)%/i);
	const centerX = positionMatch ? (Number(positionMatch[1]) / 100) * width : defaults.centerX;
	const centerY = positionMatch ? (Number(positionMatch[2]) / 100) * height : defaults.centerY;

	const ellipseMatch = descriptor.match(/([0-9.]+)%\s+([0-9.]+)%\s+at\s+[0-9.]+%\s+[0-9.]+%/i);
	if (ellipseMatch) {
		return {
			type: "radial",
			centerX,
			centerY,
			radiusX: Math.max((Number(ellipseMatch[1]) / 100) * width, 1),
			radiusY: Math.max((Number(ellipseMatch[2]) / 100) * height, 1),
			stops,
		};
	}

	if (/circle\s+farthest-corner/i.test(descriptor)) {
		const radius = Math.max(
			hypot(centerX, centerY),
			hypot(width - centerX, centerY),
			hypot(centerX, height - centerY),
			hypot(width - centerX, height - centerY),
		);
		return {
			type: "radial",
			centerX,
			centerY,
			radiusX: radius,
			radiusY: radius,
			stops,
		};
	}

	if (/circle\s+at/i.test(descriptor)) {
		const radius = Math.max(
			hypot(centerX, centerY),
			hypot(width - centerX, centerY),
			hypot(centerX, height - centerY),
			hypot(width - centerX, height - centerY),
		);
		return {
			type: "radial",
			centerX,
			centerY,
			radiusX: radius,
			radiusY: radius,
			stops,
		};
	}

	return { type: "radial", centerX, centerY, radiusX: defaults.radiusX, radiusY: defaults.radiusY, stops };
}

function drawGradientLayer(
	ctx: CanvasRenderingContext2D,
	layer: GradientLayer,
	width: number,
	height: number,
) {
	if (layer.type === "linear") {
		const { startX, startY, endX, endY } = computeLinearEndpoints(
			layer.angleDeg,
			width,
			height,
		);
		const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
		applyGradientStops(gradient, layer.stops);
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);
		return;
	}

	if (Math.abs(layer.radiusX - layer.radiusY) < 0.5) {
		const gradient = ctx.createRadialGradient(
			layer.centerX,
			layer.centerY,
			0,
			layer.centerX,
			layer.centerY,
			Math.max(layer.radiusX, 1),
		);
		applyGradientStops(gradient, layer.stops);
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);
		return;
	}

	ctx.save();
	ctx.translate(layer.centerX, layer.centerY);
	ctx.scale(layer.radiusX, layer.radiusY);
	const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
	applyGradientStops(gradient, layer.stops);
	ctx.fillStyle = gradient;
	ctx.fillRect(-2, -2, 4, 4);
	ctx.restore();
}

function parseGradientStops(parts: string[]): GradientStop[] {
	const stops = parts
		.map((part) => parseGradientStop(part))
		.filter((stop): stop is GradientStop => stop !== null);

	if (stops.length === 0) {
		return [];
	}

	assignStopPositions(stops);
	return stops;
}

function parseGradientStop(part: string): GradientStop | null {
	const match = part.match(COLOR_PREFIX_PATTERN);
	if (!match) {
		return null;
	}

	const [, color, remainder] = match;
	const positionMatch = remainder.match(/([0-9.]+)%/);
	return {
		color,
		position: positionMatch ? Number(positionMatch[1]) / 100 : undefined,
	};
}

function assignStopPositions(stops: GradientStop[]) {
	if (stops.length === 1) {
		stops[0].position ??= 0;
		return;
	}

	stops[0].position ??= 0;
	stops[stops.length - 1].position ??= 1;

	let segmentStart = 0;
	for (let index = 1; index < stops.length; index += 1) {
		if (stops[index].position == null) {
			continue;
		}

		const start = stops[segmentStart].position ?? 0;
		const end = stops[index].position ?? 1;
		const gap = index - segmentStart;
		for (let offset = 1; offset < gap; offset += 1) {
			stops[segmentStart + offset].position = start + ((end - start) * offset) / gap;
		}
		segmentStart = index;
	}
}

function applyGradientStops(gradient: CanvasGradient, stops: GradientStop[]) {
	for (const stop of stops) {
		gradient.addColorStop(stop.position ?? 0, stop.color);
	}
}

function isLinearDirection(value: string): boolean {
	return value.startsWith("to ") || value.includes("deg");
}

function parseLinearAngle(value: string): number {
	const degreeMatch = value.match(/(-?[0-9.]+)deg/i);
	if (degreeMatch) {
		return Number(degreeMatch[1]);
	}

	const normalized = value.trim().toLowerCase();
	if (normalized === "to top") return 0;
	if (normalized === "to right") return 90;
	if (normalized === "to bottom") return 180;
	if (normalized === "to left") return 270;
	if (normalized === "to top right" || normalized === "to right top") return 45;
	if (normalized === "to bottom right" || normalized === "to right bottom") return 135;
	if (normalized === "to bottom left" || normalized === "to left bottom") return 225;
	if (normalized === "to top left" || normalized === "to left top") return 315;
	return 180;
}

function computeLinearEndpoints(angleDeg: number, width: number, height: number) {
	const radians = (angleDeg * Math.PI) / 180;
	const directionX = Math.sin(radians);
	const directionY = -Math.cos(radians);
	const halfWidth = width / 2;
	const halfHeight = height / 2;
	const scaleX = directionX === 0 ? 0 : halfWidth / Math.abs(directionX);
	const scaleY = directionY === 0 ? 0 : halfHeight / Math.abs(directionY);
	const reach = Math.max(scaleX, scaleY);
	const centerX = halfWidth;
	const centerY = halfHeight;

	return {
		startX: centerX - directionX * reach,
		startY: centerY - directionY * reach,
		endX: centerX + directionX * reach,
		endY: centerY + directionY * reach,
	};
}

function startsWithColor(value: string): boolean {
	return COLOR_PREFIX_PATTERN.test(value.trim());
}

function hypot(x: number, y: number) {
	return Math.sqrt(x * x + y * y);
}