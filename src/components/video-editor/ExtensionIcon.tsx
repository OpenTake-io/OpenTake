import { icons, Puzzle } from "lucide-react";
import type { LucideProps } from "lucide-react";

const WINDOWS_ABSOLUTE_PATH = /^[a-zA-Z]:[\\/]/;

function isImagePath(value: string): boolean {
  return (
    value.startsWith("data:") ||
    value.startsWith("file://") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.includes("/") ||
    /\.(png|svg|jpg|jpeg|webp|gif)$/i.test(value)
  );
}

function toFileHref(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");

  if (normalized.startsWith("file://")) {
    return normalized;
  }

  if (normalized.startsWith("/")) {
    return `file://${normalized}`;
  }

  if (WINDOWS_ABSOLUTE_PATH.test(normalized)) {
    return `file:///${normalized}`;
  }

  return normalized;
}

function resolveIconSrc(icon: string, extensionPath?: string | null): string | null {
  if (!isImagePath(icon)) {
    return null;
  }

  if (
    icon.startsWith("data:") ||
    icon.startsWith("file://") ||
    icon.startsWith("http://") ||
    icon.startsWith("https://")
  ) {
    return icon;
  }

  if (icon.startsWith("/") || WINDOWS_ABSOLUTE_PATH.test(icon)) {
    return toFileHref(icon);
  }

  if (!extensionPath) {
    return icon;
  }

  const baseHref = toFileHref(extensionPath.endsWith("/") ? extensionPath : `${extensionPath}/`);
  return new URL(icon, baseHref).toString();
}

/**
 * Renders either a Lucide icon (by PascalCase name) or an image (by path/URL).
 * Falls back to the Puzzle icon if nothing matches.
 */
export function ExtensionIcon({
  icon,
  extensionPath,
  className = "w-4 h-4",
  imageClassName,
  ...rest
}: { icon?: string | null; extensionPath?: string | null; className?: string; imageClassName?: string } & Omit<LucideProps, "ref">) {
  if (!icon) {
    return <Puzzle className={className} {...rest} />;
  }

  const iconSrc = resolveIconSrc(icon, extensionPath);
  if (iconSrc) {
    return <img src={iconSrc} alt="" className={imageClassName ?? className} style={{ objectFit: "cover" }} />;
  }

  // Try Lucide icon name (PascalCase)
  const LucideIcon = (icons as Record<string, typeof Puzzle>)[icon];
  if (LucideIcon) {
    return <LucideIcon className={className} {...rest} />;
  }

  return <Puzzle className={className} {...rest} />;
}
