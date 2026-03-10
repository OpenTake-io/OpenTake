import { useEffect, useState } from "react";
import { LaunchWindow } from "./components/launch/LaunchWindow";
import { SourceSelector } from "./components/launch/SourceSelector";
import VideoEditor from "./components/video-editor/VideoEditor";
import { loadAllCustomFonts } from "./lib/customFonts";
import { ShortcutsProvider } from "./contexts/ShortcutsContext";
import { ShortcutsConfigDialog } from "./components/video-editor/ShortcutsConfigDialog";

export default function App() {
  const [windowType, setWindowType] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('windowType') || '';
    setWindowType(type);
    document.title = type === 'editor' ? 'Recordly Editor' : 'Recordly';

    if (type === 'hud-overlay' || type === 'source-selector') {
      document.body.style.background = 'transparent';
      document.documentElement.style.background = 'transparent';
      document.getElementById('root')?.style.setProperty('background', 'transparent');
    }

    // Load custom fonts on app initialization
    loadAllCustomFonts().catch((error) => {
      console.error('Failed to load custom fonts:', error);
    });
  }, []);

  switch (windowType) {
    case 'hud-overlay':
      return <LaunchWindow />;
    case 'source-selector':
      return <SourceSelector />;
    case 'editor':
      return (
        <ShortcutsProvider>
          <VideoEditor />
          <ShortcutsConfigDialog />
        </ShortcutsProvider>
      );
    default:
      return (
        <div className="flex h-full w-full items-center justify-center bg-slate-950 text-white">
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
            <img src="/app-icons/recordly-128.png" alt="Recordly" className="h-12 w-12 rounded-xl" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Recordly</h1>
              <p className="text-sm text-white/65">Screen recording and editing</p>
            </div>
          </div>
        </div>
      );
  }
}
