import { cn } from "@/lib/utils";

const WALLPAPER_COUNT = 12;
const WALLPAPER_PATHS = Array.from({ length: WALLPAPER_COUNT }, (_, i) => `/wallpapers/wallpaper${i + 1}.jpg`);

export default function SettingsPanel({ selected, onWallpaperChange }: { selected: string, onWallpaperChange: (path: string) => void }) {
  return (
    <div className="flex-[3] min-w-0 bg-card border border-border rounded-xl p-8 flex flex-col shadow-sm">
      <div className="mb-6">
        <div className="text-lg font-semibold mb-2">Choose Background</div>
        <div className="grid grid-cols-6 gap-3">
          {WALLPAPER_PATHS.map((path, idx) => (
            <div
              key={path}
              className={cn(
                "aspect-square rounded-lg border-2 overflow-hidden cursor-pointer transition-all w-16 h-16",
                selected === path
                  ? "border-primary/40 ring-1 ring-primary/40 scale-105"
                  : "border-border hover:border-primary/60 hover:scale-105"
              )}
              style={{ backgroundImage: `url(${path})`, backgroundSize: "cover", backgroundPosition: "center" }}
              aria-label={`Wallpaper ${idx + 1}`}
              tabIndex={0}
              onClick={() => onWallpaperChange(path)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onWallpaperChange(path); }}
              role="button"
            />
          ))}
        </div>
      </div>
      <div className="flex-1 w-full flex items-center justify-center text-muted-foreground text-base">
        Settings
      </div>
    </div>
  );
}
