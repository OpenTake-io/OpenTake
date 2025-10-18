import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import Colorful from '@uiw/react-color-colorful';
import { hsvaToHex } from '@uiw/color-convert';

const WALLPAPER_COUNT = 12;
const WALLPAPER_PATHS = Array.from({ length: WALLPAPER_COUNT }, (_, i) => `/wallpapers/wallpaper${i + 1}.jpg`);
const GRADIENTS = [
  "linear-gradient( 111.6deg,  rgba(114,167,232,1) 9.4%, rgba(253,129,82,1) 43.9%, rgba(253,129,82,1) 54.8%, rgba(249,202,86,1) 86.3% )",
  "linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)",
  "radial-gradient( circle farthest-corner at 3.2% 49.6%,  rgba(80,12,139,0.87) 0%, rgba(161,10,144,0.72) 83.6% )",
  "linear-gradient( 111.6deg,  rgba(0,56,68,1) 0%, rgba(163,217,185,1) 51.5%, rgba(231, 148, 6, 1) 88.6% )",
  "linear-gradient( 107.7deg,  rgba(235,230,44,0.55) 8.4%, rgba(252,152,15,1) 90.3% )",
  "linear-gradient( 91deg,  rgba(72,154,78,1) 5.2%, rgba(251,206,70,1) 95.9% )",
  "radial-gradient( circle farthest-corner at 10% 20%,  rgba(2,37,78,1) 0%, rgba(4,56,126,1) 19.7%, rgba(85,245,221,1) 100.2% )",
  "linear-gradient( 109.6deg,  rgba(15,2,2,1) 11.2%, rgba(36,163,190,1) 91.1% )",
  "linear-gradient(135deg, #FBC8B4, #2447B1)",
  "linear-gradient(109.6deg, #F635A6, #36D860)",
  "linear-gradient(90deg, #FF0101, #4DFF01)",
  "linear-gradient(315deg, #EC0101, #5044A9)",
];

interface SettingsPanelProps {
  selected: string;
  onWallpaperChange: (path: string) => void;
}

export default function SettingsPanel({ selected, onWallpaperChange }: SettingsPanelProps) {
  const [hsva, setHsva] = useState({ h: 0, s: 0, v: 68, a: 1 });
  const [gradient, setGradient] = useState<string>(GRADIENTS[0]);

  return (
    <div className="flex-[3] min-w-0 bg-card border border-border rounded-xl p-8 flex flex-col shadow-sm">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Switch/>
          <div className="text-sm">Shadow</div>
        </div>
      </div>
      <Tabs defaultValue="image" className="mb-6">
        <TabsList className="mb-4">
          <TabsTrigger value="image">Image</TabsTrigger>
          <TabsTrigger value="color">Color</TabsTrigger>
          <TabsTrigger value="gradient">Gradient</TabsTrigger>
        </TabsList>
        
        <TabsContent value="image">
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
                onClick={() => onWallpaperChange(path)}
                role="button"
              />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="color">
          <Colorful
            color={hsva}
            disableAlpha={true}
            onChange={(color) => {
              setHsva(color.hsva);
              onWallpaperChange(hsvaToHex(color.hsva));
            }}
          />
        </TabsContent>
        
        <TabsContent value="gradient">
          <div className="grid grid-cols-6 gap-3">
            {GRADIENTS.map((g, idx) => (
              <div
                key={g}
                className={cn(
                  "aspect-square rounded-lg border-2 overflow-hidden cursor-pointer transition-all w-16 h-16",
                  gradient === g ? "border-primary ring-1 ring-primary/40 scale-105" : "border-border hover:border-primary/60 hover:scale-105"
                )}
                style={{ background: g }}
                aria-label={`Gradient ${idx + 1}`}
                onClick={() => { setGradient(g); onWallpaperChange(g); }}
                role="button"
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
