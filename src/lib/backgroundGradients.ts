type RgbaColor = {
	r: number;
	g: number;
	b: number;
	a: number;
};

export type BlobGradientConfig = {
	baseMode?: "light" | "dark";
	baseA?: string;
	baseB?: string;
	colors: string[];
	seed: number;
	blobCount: number;
	intensity: number;
	angleDeg: number;
};

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function mulberry32(seed: number) {
	let state = (Number(seed) || 1) >>> 0;
	return () => {
		state += 0x6d2b79f5;
		let value = Math.imul(state ^ (state >>> 15), 1 | state);
		value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

function canvasAngleDegToCssAngleDeg(angleDeg: number) {
	const angle = Number(angleDeg) || 0;
	const cssAngle = angle + 90;
	return ((cssAngle % 360) + 360) % 360;
}

function parseHexColor(raw: string): RgbaColor | null {
	let value = raw.trim().replace(/^#/, "");
	if (![3, 4, 6, 8].includes(value.length)) {
		return null;
	}

	if (value.length <= 4) {
		value = value
			.split("")
			.map((character) => `${character}${character}`)
			.join("");
	}

	const parsed = Number.parseInt(value, 16);
	if (Number.isNaN(parsed)) {
		return null;
	}

	if (value.length === 6) {
		return {
			r: (parsed >> 16) & 255,
			g: (parsed >> 8) & 255,
			b: parsed & 255,
			a: 1,
		};
	}

	return {
		r: (parsed >> 24) & 255,
		g: (parsed >> 16) & 255,
		b: (parsed >> 8) & 255,
		a: (parsed & 255) / 255,
	};
}

function parseRgbColor(raw: string): RgbaColor | null {
	const match = raw.match(/^rgba?\((.+)\)$/i);
	if (!match) {
		return null;
	}

	const parts = match[1].split(",").map((part) => part.trim());
	if (parts.length < 3) {
		return null;
	}

	const [r, g, b, a = "1"] = parts;
	return {
		r: clamp(Number.parseFloat(r), 0, 255),
		g: clamp(Number.parseFloat(g), 0, 255),
		b: clamp(Number.parseFloat(b), 0, 255),
		a: clamp(Number.parseFloat(a), 0, 1),
	};
}

function hueToRgb(p: number, q: number, t: number) {
	let next = t;
	if (next < 0) next += 1;
	if (next > 1) next -= 1;
	if (next < 1 / 6) return p + (q - p) * 6 * next;
	if (next < 1 / 2) return q;
	if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
	return p;
}

function parseHslColor(raw: string): RgbaColor | null {
	const match = raw.match(/^hsla?\((.+)\)$/i);
	if (!match) {
		return null;
	}

	const parts = match[1].split(",").map((part) => part.trim());
	if (parts.length < 3) {
		return null;
	}

	const [hueRaw, saturationRaw, lightnessRaw, alphaRaw = "1"] = parts;
	const hue = ((((Number.parseFloat(hueRaw) % 360) + 360) % 360) / 360);
	const saturation = clamp(Number.parseFloat(saturationRaw) / 100, 0, 1);
	const lightness = clamp(Number.parseFloat(lightnessRaw) / 100, 0, 1);
	const alpha = clamp(Number.parseFloat(alphaRaw), 0, 1);

	if (saturation === 0) {
		const channel = Math.round(lightness * 255);
		return { r: channel, g: channel, b: channel, a: alpha };
	}

	const q =
		lightness < 0.5
			? lightness * (1 + saturation)
			: lightness + saturation - lightness * saturation;
	const p = 2 * lightness - q;

	return {
		r: Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
		g: Math.round(hueToRgb(p, q, hue) * 255),
		b: Math.round(hueToRgb(p, q, hue - 1 / 3) * 255),
		a: alpha,
	};
}

function parseColor(raw: string): RgbaColor | null {
	return parseHexColor(raw) ?? parseRgbColor(raw) ?? parseHslColor(raw);
}

function toCssRgba(color: string, alphaMultiplier = 1) {
	const parsed = parseColor(String(color).trim());
	if (!parsed) {
		return alphaMultiplier <= 0 ? "rgba(0, 0, 0, 0)" : color;
	}

	const alpha = clamp(parsed.a * alphaMultiplier, 0, 1);
	return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
}

export function blobGradientPreviewCss(config: BlobGradientConfig) {
	const baseMode = String(config.baseMode || "dark");
	const baseA = String(config.baseA || (baseMode === "light" ? "#ffffff" : "#05060A"));
	const baseB = String(config.baseB || (baseMode === "light" ? "#f3f4f6" : "#111827"));
	const cssAngleDeg = canvasAngleDegToCssAngleDeg(config.angleDeg);
	const colors = Array.isArray(config.colors) ? config.colors.filter(Boolean) : [];
	const seed = Number.isFinite(Number(config.seed)) ? Number(config.seed) : 1;
	const intensity = clamp(Number(config.intensity) || 0.85, 0, 1);
	const blobCount = clamp(Number(config.blobCount) || (baseMode === "light" ? 6 : 7), 3, 10);

	const rand = mulberry32(seed);
	const pick = (index: number, fallback: string) =>
		String(colors[index % Math.max(1, colors.length)] || fallback);
	const leadingAlpha = baseMode === "light" ? intensity * 0.3 : intensity * 0.7;
	const trailingAlpha = baseMode === "light" ? intensity * 0.18 : intensity * 0.42;
	const lobesPerBlob = 2;
	const blobs: string[] = [];

	for (let index = 0; index < blobCount; index += 1) {
		for (let lobe = 0; lobe < lobesPerBlob; lobe += 1) {
			const x = Math.round(6 + rand() * 88);
			const y = Math.round(6 + rand() * 88);
			const stop = Math.round(42 + rand() * 30);
			const color = pick(index + lobe, index % 2 ? "#ec4899" : "#8b5cf6");
			const alpha = (index === 0 ? leadingAlpha : trailingAlpha) * (lobe === 0 ? 1 : 0.55);
			blobs.push(
				`radial-gradient(circle at ${x}% ${y}%, ${toCssRgba(color, alpha)} 0%, ${toCssRgba(color, 0)} ${stop}%)`,
			);
		}
	}

	const base = `linear-gradient(${cssAngleDeg}deg, ${baseA}, ${baseB})`;
	return [base, ...blobs].join(", ");
}

const BLOB_GRADIENT_PRESETS: BlobGradientConfig[] = [
	{
		baseMode: "light",
		baseA: "#3182ce",
		baseB: "#4fd1c5",
		colors: ["#feb2b2", "rgba(252, 184, 219, 0.75)", "rgba(239, 194, 250, 0.5)", "#348fc5", "#389ac2", "#3ca5c1", "#41b0c2", "#45bbc3"],
		seed: 910001,
		blobCount: 9,
		intensity: 0.74,
		angleDeg: 135,
	},
	{
		baseMode: "light",
		baseA: "#fdd575",
		baseB: "#d22e8c",
		colors: ["#4964da", "rgba(146, 73, 221, 0.8)", "rgba(176, 60, 196, 0.6)", "rgba(192, 55, 173, 0.4)", "#fcc06a", "#fbaa63", "#f99262", "#f55973"],
		seed: 910002,
		blobCount: 9,
		intensity: 0.76,
		angleDeg: 163,
	},
	{
		baseMode: "light",
		baseA: "hsla(173, 77%, 83%, 1)",
		baseB: "hsla(173, 77%, 83%, 1)",
		colors: ["hsla(250, 76%, 61%, 1)", "hsla(184, 91%, 91%, 1)", "hsla(213, 97%, 75%, 1)", "hsla(149, 93%, 64%, 1)", "hsla(118, 94%, 89%, 1)"],
		seed: 910003,
		blobCount: 8,
		intensity: 0.74,
		angleDeg: 146,
	},
	{
		baseMode: "dark",
		baseA: "hsla(327, 100%, 50%, 1)",
		baseB: "hsla(327, 100%, 50%, 1)",
		colors: ["hsla(11, 100%, 50%, 1)", "hsla(236, 100%, 23%, 1)", "hsla(206, 100%, 9%, 1)", "hsla(327, 100%, 50%, 1)"],
		seed: 910004,
		blobCount: 8,
		intensity: 0.82,
		angleDeg: 142,
	},
	{
		baseMode: "light",
		baseA: "hsla(197, 92%, 60%, 1)",
		baseB: "hsla(197, 92%, 60%, 1)",
		colors: ["hsla(55, 93%, 54%, 0.85)", "hsla(229, 71%, 68%, 1)", "hsla(308, 93%, 51%, 1)", "hsla(318, 60%, 76%, 1)", "hsla(324, 92%, 59%, 1)"],
		seed: 910005,
		blobCount: 9,
		intensity: 0.76,
		angleDeg: 138,
	},
	{
		baseMode: "light",
		baseA: "hsla(259, 100%, 63%, 1)",
		baseB: "hsla(259, 100%, 63%, 1)",
		colors: ["hsla(318, 80%, 97%, 1)", "hsla(161, 99%, 84%, 1)", "hsla(163, 90%, 78%, 1)", "hsla(314, 91%, 59%, 1)"],
		seed: 910006,
		blobCount: 9,
		intensity: 0.74,
		angleDeg: 132,
	},
	{
		baseMode: "light",
		baseA: "hsla(259, 84%, 37%, 1)",
		baseB: "hsla(259, 84%, 37%, 1)",
		colors: ["hsla(248, 82%, 99%, 1)", "hsla(318, 83%, 77%, 1)", "hsla(302, 95%, 45%, 1)", "hsla(210, 87%, 65%, 1)", "hsla(317, 98%, 84%, 1)"],
		seed: 910007,
		blobCount: 9,
		intensity: 0.75,
		angleDeg: 136,
	},
	{
		baseMode: "light",
		baseA: "hsla(185, 58%, 56%, 1)",
		baseB: "hsla(185, 58%, 56%, 1)",
		colors: ["hsla(253, 66%, 75%, 1)", "hsla(226, 66%, 63%, 1)", "hsla(359, 63%, 67%, 1)", "hsla(181, 88%, 59%, 1)", "hsla(293, 91%, 54%, 1)", "hsla(293, 89%, 59%, 1)", "hsla(197, 99%, 92%, 1)", "hsla(251, 96%, 90%, 1)", "hsla(270, 63%, 55%, 1)", "hsla(278, 99%, 97%, 1)"],
		seed: 910008,
		blobCount: 9,
		intensity: 0.76,
		angleDeg: 129,
	},
	{
		baseMode: "light",
		baseA: "hsla(204, 0%, 100%, 1)",
		baseB: "hsla(204, 0%, 100%, 1)",
		colors: ["hsla(295, 77%, 74%, 0.35)", "hsla(236, 77%, 74%, 0.35)", "hsla(186, 77%, 74%, 0.35)", "hsla(127, 77%, 74%, 0.35)", "hsla(62, 77%, 74%, 0.35)", "hsla(23, 77%, 74%, 0.35)"],
		seed: 910009,
		blobCount: 9,
		intensity: 0.7,
		angleDeg: 135,
	},
	{
		baseMode: "light",
		baseA: "hsla(240,100%,59%,0.47)",
		baseB: "hsla(240,100%,59%,0.47)",
		colors: ["hsla(198,71%,73%,1)", "hsla(283,100%,56%,1)", "hsla(300,100%,50%,1)", "hsla(189,100%,50%,1)", "hsla(266,100%,50%,1)"],
		seed: 830001,
		blobCount: 9,
		intensity: 0.76,
		angleDeg: 135,
	},
	{
		baseMode: "light",
		baseA: "hsla(324,100%,50%,1)",
		baseB: "hsla(324,100%,50%,1)",
		colors: ["hsla(235,100%,79%,1)", "hsla(189,100%,56%,1)", "hsla(355,100%,93%,1)", "hsla(340,100%,50%,1)", "hsla(0,100%,70%,1)", "hsla(201,100%,67%,1)", "hsla(312,100%,50%,1)"],
		seed: 830002,
		blobCount: 9,
		intensity: 0.76,
		angleDeg: 135,
	},
	{
		baseMode: "light",
		baseA: "hsla(359,100%,68%,1)",
		baseB: "hsla(359,100%,68%,1)",
		colors: ["hsla(202,90%,65%,1)", "hsla(300,100%,50%,1)", "hsla(172,100%,50%,1)", "hsla(239,100%,60%,1)", "hsla(360,100%,50%,1)", "hsla(275,85%,76%,1)", "hsla(238,67%,70%,1)"],
		seed: 830003,
		blobCount: 9,
		intensity: 0.76,
		angleDeg: 135,
	},
	{
		baseMode: "light",
		baseA: "#ff99bb",
		baseB: "#ff99bb",
		colors: ["hsla(295,85%,65%,1)", "hsla(30,70%,75%,1)", "hsla(76,94%,67%,1)", "hsla(276,74%,63%,1)", "hsla(169,75%,74%,1)", "hsla(226,93%,60%,1)", "hsla(28,87%,67%,1)"],
		seed: 500001,
		blobCount: 9,
		intensity: 0.76,
		angleDeg: 135,
	},
	{
		baseMode: "light",
		baseA: "#99ecff",
		baseB: "#99ecff",
		colors: ["hsla(200,71%,65%,1)", "hsla(350,60%,70%,1)", "hsla(308,94%,62%,1)", "hsla(154,90%,61%,1)", "hsla(331,62%,72%,1)", "hsla(125,87%,71%,1)", "hsla(336,62%,60%,1)"],
		seed: 509974,
		blobCount: 9,
		intensity: 0.76,
		angleDeg: 135,
	},
	{
		baseMode: "light",
		baseA: "#9c99ff",
		baseB: "#9c99ff",
		colors: ["hsla(238,99%,74%,1)", "hsla(187,94%,62%,1)", "hsla(209,89%,76%,1)", "hsla(337,98%,60%,1)", "hsla(116,80%,68%,1)", "hsla(3,72%,71%,1)", "hsla(336,60%,72%,1)"],
		seed: 519947,
		blobCount: 9,
		intensity: 0.76,
		angleDeg: 135,
	},
	{
		baseMode: "light",
		baseA: "#ffbd99",
		baseB: "#ffbd99",
		colors: ["hsla(207,76%,65%,1)", "hsla(350,69%,69%,1)", "hsla(269,69%,78%,1)", "hsla(157,97%,76%,1)", "hsla(231,71%,63%,1)", "hsla(242,93%,74%,1)", "hsla(276,80%,78%,1)"],
		seed: 529920,
		blobCount: 9,
		intensity: 0.76,
		angleDeg: 135,
	},
];

const LINEAR_GRADIENTS = [
	"linear-gradient(135deg, #6D28D9 0%, #EA580C 100%)",
	"linear-gradient(135deg, #1D4ED8 0%, #0891B2 100%)",
	"linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)",
	"linear-gradient(135deg, #4338CA 0%, #A21CAF 100%)",
	"linear-gradient(135deg, #7C3AED 0%, #F97316 100%)",
	"linear-gradient(135deg, #0EA5E9 0%, #1D4ED8 100%)",
	"linear-gradient(135deg, #FB7185 0%, #F59E0B 100%)",
	"linear-gradient(135deg, #0B1020 0%, #7700FF 100%)",
];

export const GRADIENTS = [
	...BLOB_GRADIENT_PRESETS.map(blobGradientPreviewCss),
	...LINEAR_GRADIENTS,
];