import * as PhosphorIcons from "@phosphor-icons/react";

type IconWeight = "thin" | "light" | "regular" | "bold" | "fill";
const missingIconPathCache = new Set<string>();

function resolveIconComponent(name: string): {
	iconName: string;
	icon: { render?: (props: { weight: string }, ref: unknown) => unknown };
} | null {
	const iconLibrary = PhosphorIcons as Record<string, unknown>;
	const iconName =
		typeof iconLibrary[name] !== "undefined"
			? name
			: typeof iconLibrary[`${name}Icon`] !== "undefined"
				? `${name}Icon`
				: null;
	if (!iconName) {
		return null;
	}

	return {
		iconName,
		icon: iconLibrary[iconName] as {
			render?: (props: { weight: string }, ref: unknown) => unknown;
		},
	};
}

function collectPathData(node: unknown, output: string[]): void {
	if (!node) return;
	if (Array.isArray(node)) {
		for (const child of node) collectPathData(child, output);
		return;
	}
	if (typeof node !== "object") return;

	const maybeNode = node as {
		type?: unknown;
		props?: { d?: unknown; children?: unknown };
	};
	if (maybeNode.type === "path" && typeof maybeNode.props?.d === "string") {
		output.push(maybeNode.props.d);
	}
	collectPathData(maybeNode.props?.children, output);
}

export function resolveIconPath(
	name: string,
	weight: IconWeight,
	cache: Map<string, Path2D>,
): Path2D | null {
	const cacheKey = `${name}:${weight}`;
	if (missingIconPathCache.has(cacheKey)) {
		return null;
	}
	const cached = cache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const resolved = resolveIconComponent(name);
	if (!resolved) {
		console.warn(`[extensions] Icon ${name} not found in Phosphor library`);
		missingIconPathCache.add(cacheKey);
		return null;
	}

	try {
		const element = resolved.icon.render?.({ weight }, null) as
			| { props?: { weights?: Map<string, { props?: { children?: unknown } }> } }
			| undefined;
		const weights = element?.props?.weights;
		const definition = weights?.get(weight);
		const children = definition?.props?.children;
		const pathDataList: string[] = [];
		collectPathData(children, pathDataList);

			if (pathDataList.length === 0) {
				console.warn(`[extensions] No path data found for ${name}:${weight}`, {
					iconName: resolved.iconName,
					element,
					children,
				});
				missingIconPathCache.add(cacheKey);
				return null;
			}

		const combinedPath = new Path2D();
		for (const pathData of pathDataList) {
			combinedPath.addPath(new Path2D(pathData));
		}
		cache.set(cacheKey, combinedPath);
		return combinedPath;
		} catch (err) {
			console.error(`[extensions] Failed to extract path for icon ${name}:`, err);
			missingIconPathCache.add(cacheKey);
			return null;
		}
}
