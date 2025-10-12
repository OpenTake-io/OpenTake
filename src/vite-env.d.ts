/// <reference types="vite/client" />
interface Window {
  electronAPI: {
    getSources: (opts: Electron.SourcesOptions) => Promise<Electron.DesktopCapturerSource[]>
    switchToEditor: () => Promise<void>
  }
}