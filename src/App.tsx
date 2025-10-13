import { LaunchWindow } from "./components/LaunchWindow";
import { SourceSelector } from "./components/SourceSelector";
import { useEffect, useState } from "react";

export default function App() {
  const [windowType, setWindowType] = useState<string>('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('windowType') || 'default';
    setWindowType(type);

    // Apply transparency only for HUD overlay windows
    if (type === 'hud-overlay') {
      document.body.style.background = 'transparent';
      document.documentElement.style.background = 'transparent';
      const root = document.getElementById('root');
      if (root) root.style.background = 'transparent';
    }
  }, []);

  if (windowType === 'hud-overlay') {
    return <LaunchWindow />;
  }

  if (windowType === 'source-selector') {
    return <SourceSelector />;
  }

  if (windowType === 'editor') {
    return (
      <div className="w-full h-full bg-background text-foreground p-6">
        <h1 className="text-2xl font-bold mb-4">Video Editor</h1>
        <p>Recording stopped. Video editor interface coming soon...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-background text-foreground">
      <h1>Pangolin</h1>
    </div>
  );
}
