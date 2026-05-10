# Plan de Diagnostic de Performance : "Stop Recording"

L'objectif est d'identifier précisément les goulots d'étranglement qui causent un délai de 10-15 secondes après l'arrêt d'un enregistrement natif sur Windows.

## 1. Instrumentation Frontend (`src/hooks/useScreenRecorder.ts`)

Nous allons mesurer le temps total côté UI et le temps d'attente pour chaque appel IPC majeur.

- **Total Stop Sequence** : Du clic sur "Stop" à l'ouverture de l'éditeur.
- **IPC: stopNativeScreenRecording** : Temps d'arrêt du processus de capture natif.
- **IPC: muxNativeWindowsRecording** : Temps passé dans FFmpeg pour le padding et le muxing audio.
- **Store Sidecar** : Temps d'écriture de l'audio du microphone enregistré par le navigateur.

## 2. Instrumentation Main Process IPC (`electron/ipc/register/recording.ts`)

Nous allons mesurer le temps passé dans les handlers IPC pour différencier le temps de traitement de l'overhead de communication.

- **Handler: stop-native-screen-recording**
- **Handler: mux-native-windows-recording**

## 3. Instrumentation Logique Interne (`electron/ipc/recording/windows.ts`)

C'est ici que se trouvent les opérations FFmpeg suspectées.

- **extendNativeWindowsVideoToDuration** : Temps de re-encodage pour ajouter du padding (Suspect #1).
- **muxNativeWindowsVideoWithAudio** : Temps de muxing audio (Suspect #2).
- **Probing** : Temps passé dans `ffprobe`.

## Méthodologie d'analyse

Une fois les logs ajoutés :
1. Lancer l'app en mode dev.
2. Faire un enregistrement court (10s).
3. Arrêter l'enregistrement.
4. Récupérer les logs dans :
   - La **Console du navigateur** (pour le frontend).
   - Le **Terminal** (pour le processus main d'Electron).

Les logs seront préfixés par `[PERF:RENDERER]` et `[PERF:MAIN]`.
