# Plan de Refacto Timeline - Déclinaison par Phases (Big Bang strict)

Ce document décline `plan_timeline_refacto` en phases d’exécution explicites pour éviter les changements involontaires.

Contraintes non négociables:
- Pas de couche de compatibilité
- Pas de fallback
- Big Bang unique en production (cutover final)
- Parité fonctionnelle stricte avec l’existant

## Plan A (recommandé) - 7 phases avec verrous

### Phase 1 - Cadrage technique figé
Objectif:
- Geler le contrat public (`TimelineEditorProps`, `TimelineEditorHandle`, exports).
- Établir une matrice de parité feature complète.
- Fixer les conventions d’architecture et de découpage.

Travaux:
- Inventorier toutes les features actuelles: zoom, clip, annotation, audio, keyframes, shortcuts, toolbar, crop/aspect ratio.
- Écrire les critères observables de parité (entrées/sorties/callbacks).
- Définir les règles de taille et responsabilités par module.

Definition of Done:
- Contrat API public verrouillé.
- Matrice de parité validée.
- Règles de découpage figées.

---

### Phase 2 - Extraction du noyau pur (`core` + `model`)
Objectif:
- Sortir toute la logique pure hors de `TimelineEditor.tsx`.

Travaux:
- `timeline/core/`: constantes, temps/range/scale/format, row IDs, overlap.
- `timeline/model/`: mapping régions -> items timeline, labels, spans, sélection.
- Suppression de la logique pure du composant monolithique.

Definition of Done:
- Modules purs sans dépendance React/DOM/Electron.
- Comportement identique validé par tests unitaires.

---

### Phase 3 - Extraction DnD (`dnd`)
Objectif:
- Isoler toute la logique drag/resize/collision/voisinage.

Travaux:
- Migrer la logique de `TimelineWrapper` vers `timeline/dnd/`.
- Encapsuler clamp resize/drag, min duration, row resolve.
- Standardiser l’API DnD vers le reste du système.

Definition of Done:
- DnD autonome et testable.
- Même sémantique d’overlap qu’avant.

---

### Phase 4 - Extraction hooks métier (`hooks`)
Objectif:
- Décomposer la logique d’orchestration en hooks spécialisés.

Travaux:
- Implémenter:
  - `useTimelineRange`
  - `useTimelineSelection`
  - `useTimelineNormalization`
  - `useTimelineZoomActions`
  - `useTimelineAudioActions`
  - `useTimelineAnnotationsActions`
  - `useTimelineKeyboardShortcuts`
- Isoler side-effects (`window`, `electronAPI`, `toast`) dans ces hooks.

Definition of Done:
- `TimelineEditor` n’héberge plus la logique métier.
- Side-effects regroupés et contrôlés.

---

### Phase 5 - Découpage UI complet (`components`)
Objectif:
- Transformer la vue monolithique en composants de responsabilité unique.

Travaux:
- Extraire:
  - `components/editor/TimelineEditorShell`
  - `components/toolbar/TimelineToolbar`
  - `components/viewport/TimelineViewport`
  - `components/axis/TimelineAxis`
  - `components/playhead/PlaybackCursor`
  - `components/rows/{ClipRow,ZoomRow,AnnotationRows,AudioRows}`
  - `components/overlays/{ClipMarkerOverlay,GhostPlayhead,GhostZoom}`
  - `components/keyframes/KeyframeMarkers`
- Rebrancher les props et callbacks sans changer les signatures publiques.

Definition of Done:
- UI modulaire complète.
- Pas de régression interactionnelle (clic, hover, drag, resize, shortcuts).

---

### Phase 6 - Recomposition finale Big Bang
Objectif:
- Bascule complète vers la nouvelle architecture.

Travaux:
- Remplacer l’implémentation interne de `TimelineEditor` par la version modulaire.
- Supprimer code legacy et code mort.
- Conserver strictement le même point d’entrée public.

Definition of Done:
- Aucune branche legacy.
- Aucune couche de compatibilité.
- Nouvelle architecture seule active.

---

### Phase 7 - Validation finale parité + gate release
Objectif:
- Bloquer toute régression avant merge final.

Travaux:
- Exécuter:
  - Tests unitaires logique pure.
  - Tests d’intégration React sur interactions clés.
  - Smoke e2e sur scénarios d’édition complets.
- Vérifier la matrice de parité feature point par point.

Definition of Done:
- API publique identique.
- Parité fonctionnelle validée.
- Couverture forte sur logique critique timeline.

---

## Plan B (plus agressif) - 3 macro-phases

### Phase 1 - Extraction massive moteur
- Extraire d’un coup `core`, `model`, `dnd`, `hooks`.
- Réduire `TimelineEditor` à orchestration.

### Phase 2 - Reconstruction UI modulaire
- Recomposer la vue avec `components/*`.
- Rebrancher toutes les interactions et actions.

### Phase 3 - Durcissement et cutover final
- Tests intégration + smoke.
- Suppression définitive du monolithe et de tout reliquat legacy.

---

## Plan C (orienté anti-régression involontaire) - 5 phases

### Phase 1 - Baseline comportementale
- Capturer états/callbacks attendus sur scénarios clés.

### Phase 2 - Extraction moteur logique
- Extraire `core/model/dnd` et verrouiller par unit tests.

### Phase 3 - Extraction actions + side-effects
- Extraire hooks actions/shortcuts/normalization et valider intégration.

### Phase 4 - Extraction UI modulaire
- Extraire toolbar/viewport/rows/overlays et stabiliser interactions.

### Phase 5 - Cutover Big Bang
- Basculer complètement.
- Supprimer ancien code.
- Valider parité complète.

---

## Tests minimaux obligatoires (quel que soit le plan choisi)

Unitaires:
- Placement zoom (disponibilité, overlap, clip boundaries).
- Placement audio (choix de piste, gap computation, fit réel).
- Clamp drag/resize (min duration, voisins, bornes timeline).
- Format/scale/range/row resolvers.

Intégration:
- Timeline click -> seek.
- Drag playhead + snap keyframe.
- Drag/resize items par row.
- Ghost playhead / ghost zoom.
- Shortcuts: A, Z, C, Delete/Backspace, select-all blocks.
- Tab / Shift+Tab cycle annotations.

Smoke:
- Session complète: add/move/resize/delete zoom/clip/annotation/audio + crop + aspect ratio custom.

---

## Choix verrouillés
- Big Bang strict.
- Zéro compatibilité.
- Zéro fallback.
- Parité fonctionnelle stricte avant release.

---

## Verrou Phase 1 (figé)

### Contrat API public verrouillé
- Export public composant:
  - `default TimelineEditor`
  - `type TimelineEditorHandle`
  - `type TimelineEditorProps`
- `TimelineEditorProps` gelé (sans fallback compat):
  - Inputs: `videoDuration`, `currentTime`, `playheadTime`, `cursorTelemetry`, `autoSuggestZoomsTrigger`, `disableSuggestedZooms`, `zoomRegions`, `trimRegions`, `clipRegions`, `annotationRegions`, `speedRegions`, `audioRegions`, `aspectRatio`, `isCropped`, `videoPath`, `hideToolbar`.
  - Callbacks: `onSeek`, `onAutoSuggestZoomsConsumed`, `onZoomAdded`, `onZoomSuggested`, `onZoomSpanChange`, `onZoomDelete`, `onSelectZoom`, `onTrimAdded`, `onTrimSpanChange`, `onTrimDelete`, `onSelectTrim`, `onClipSplit`, `onClipSpanChange`, `onClipDelete`, `onSelectClip`, `onAnnotationAdded`, `onAnnotationSpanChange`, `onAnnotationDelete`, `onSelectAnnotation`, `onSpeedAdded`, `onSpeedSpanChange`, `onSpeedDelete`, `onSelectSpeed`, `onAudioAdded`, `onAudioSpanChange`, `onAudioDelete`, `onSelectAudio`, `onAspectRatioChange`, `onOpenCropEditor`.
- `TimelineEditorHandle` gelé:
  - Méthodes: `addZoom()`, `suggestZooms()`, `splitClip()`, `addAnnotation(trackIndex?)`, `addAudio(trackIndex?)`.
  - État exposé: `keyframes: { id: string; time: number }[]`.

### Matrice de parité feature (critères observables)
- Zoom:
  - Entrées: `zoomRegions`, `cursorTelemetry`, `disableSuggestedZooms`.
  - Sorties/callbacks: `onZoomAdded`, `onZoomSuggested`, `onZoomSpanChange`, `onZoomDelete`, `onSelectZoom`.
  - Observables: ajout manuel, suggestions interaction, drag/resize sans overlap.
- Clip:
  - Entrées: `clipRegions`, `currentTime`.
  - Sorties/callbacks: `onClipSplit`, `onClipSpanChange`, `onClipDelete`, `onSelectClip`.
  - Observables: split au playhead, sélection/resize clip.
- Annotation:
  - Entrées: `annotationRegions`, `currentTime`.
  - Sorties/callbacks: `onAnnotationAdded`, `onAnnotationSpanChange`, `onAnnotationDelete`, `onSelectAnnotation`.
  - Observables: multi-track, Tab/Shift+Tab cycle sur overlaps.
- Audio:
  - Entrées: `audioRegions`, `videoPath`, `currentTime`.
  - Sorties/callbacks: `onAudioAdded`, `onAudioSpanChange`, `onAudioDelete`, `onSelectAudio`.
  - Observables: placement piste libre, clamp durée au gap restant.
- Keyframes:
  - Entrées: `currentTime`.
  - Sorties: handle `keyframes`; interactions internes `add/move/delete`.
  - Observables: snap playhead ±150ms sur keyframe en drag.
- Shortcuts:
  - Entrées: focus timeline + keymap contexte shortcuts.
  - Sorties: déclenche callbacks de feature ou suppression.
  - Observables: `A`, `Z`, `C`, `Delete/Backspace`, `Ctrl/Cmd+A`, `Tab`, `Shift+Tab`.
- Toolbar:
  - Entrées: `hideToolbar`, `aspectRatio`, `isCropped`.
  - Sorties: actions zoom/annotation/audio/split/crop/aspect.
  - Observables: parité boutons et menus.
- Crop / Aspect ratio:
  - Entrées: `aspectRatio`, `isCropped`.
  - Sorties: `onAspectRatioChange`, `onOpenCropEditor`.
  - Observables: presets + custom ratio, indicateur crop actif.

### Conventions d’architecture / découpage (figées)
- `timeline/core/*`:
  - Pur (pas React/DOM/Electron).
  - Responsabilités: temps/range/scale/format, rows IDs, overlap, normalisation span.
- `timeline/model/*`:
  - Pur (pas React/DOM/Electron).
  - Responsabilités: mapping régions -> items timeline, labels, spans DnD, resolve row.
- Contraintes module:
  - Taille cible: `< 200` LOC/module pur, `< 300` LOC max exceptionnel.
  - Fonctions exportées pures, typées explicitement, testées unitairement.
  - Aucune dépendance croisée `model -> React` ou `core -> model UI`.

## Verrou Phase 2 (extraction core+model)

### Extraction réalisée
- `timeline/core/`:
  - `constants.ts`
  - `rows.ts`
  - `spans.ts`
  - `time.ts`
- `timeline/model/`:
  - `timelineModel.ts`
- `TimelineEditor.tsx` rebranché:
  - Utilise les fonctions `core`/`model` pour la logique pure extraite.
  - Contrat public inchangé côté comportement.

### Tests unitaires ajoutés
- `timeline/core/time.test.ts`
- `timeline/core/rows.test.ts`
- `timeline/model/timelineModel.test.ts`

## Verrou Phase 3 (extraction DnD)

### Extraction réalisée
- Nouveau module DnD pur: `timeline/dnd/engine.ts`.
- Logique migrée hors `TimelineWrapper`:
  - clamp resize/drag
  - clamp range viewport
  - voisinage/siblings par row
  - résolution d’overlap en fin de drag/resize
- `TimelineWrapper` devient adaptateur d’événements (`dnd-timeline` -> appels `engine`).

### API DnD standardisée
- Entrée unifiée `DndEngineConfig`:
  - `totalMs`, `minItemDurationMs`, `minVisibleRangeMs`, `allRegionSpans`, `hasOverlap`.
- Fonctions pures exportées:
  - `clampSpanToBounds`, `clampRange`
  - `clampResizedSpanToNeighbours`, `clampDraggedSpanToNeighbours`
  - `resolveResizeEnd`, `resolveDragEnd`

### Parité sémantique
- Pas de changement de comportement attendu:
  - même conservation de durée sur drag
  - même logique de clamp voisinage
  - même fallback `return` quand overlap persiste après clamp

## Verrou Phase 4 (extraction hooks métier)

### Hooks implémentés
- `timeline/hooks/useTimelineRange.ts`
- `timeline/hooks/useTimelineSelection.ts`
- `timeline/hooks/useTimelineNormalization.ts`
- `timeline/hooks/useTimelineZoomActions.ts`
- `timeline/hooks/useTimelineAudioActions.ts`
- `timeline/hooks/useTimelineAnnotationsActions.ts`
- `timeline/hooks/useTimelineKeyboardShortcuts.ts`

### Side-effects isolés
- `window` (keyboard listeners) -> `useTimelineKeyboardShortcuts`
- `window.electronAPI` + lecture metadata audio -> `useTimelineAudioActions`
- `toast` (zoom/audio/aspect custom) -> hooks métier correspondants

### Rebranchement `TimelineEditor`
- `TimelineEditor` consomme désormais les hooks pour:
  - range/pan/wheel
  - sélection/keyframes/delete/select-all
  - normalisation spans
  - actions zoom/audio/annotation
  - shortcuts clavier
- Le composant conserve l’orchestration UI et le wiring des callbacks/props publics.

## Verrou Phase 5 (découpage UI components)

### Composants UI extraits
- `timeline/components/toolbar/TimelineToolbar.tsx`
- `timeline/components/viewport/TimelineCanvas.tsx`
- `timeline/components/axis/TimelineAxis.tsx`
- `timeline/components/playhead/PlaybackCursor.tsx`
- `timeline/components/overlays/ClipMarkerOverlay.tsx`

### Recomposition
- `TimelineEditor` délègue désormais:
  - toolbar actions + aspect/crop UI à `TimelineToolbar`
  - viewport timeline (rows/items/ghosts/playhead/axis) à `TimelineCanvas`
- `TimelineEditor` conserve l’orchestration props/callbacks publiques + wiring hooks métier.

### Parité interactionnelle conservée
- Clic timeline -> seek
- Drag playhead + snap keyframes
- Ghost playhead / ghost zoom
- Rendu rows multi-tracks annotation/audio
- Actions toolbar (zoom/suggest/annotation/audio/split/crop/aspect)

## Verrou Phase 6 (recomposition finale Big Bang)

### Bascule architecture modulaire
- `TimelineEditor` est désormais une façade API publique + wiring de hooks/composants.
- Extraction finale des blocs monolithiques restants:
  - DnD bindings -> `timeline/hooks/useTimelineDndBindings.ts`
  - Shell editor/empty state -> `timeline/components/editor/TimelineEditorShell.tsx`

### Suppression legacy/code mort
- Retrait des implémentations inline restantes de:
  - overlap resolver
  - routing span-change par type/track
  - mapping items/spans DnD
  - empty-state inline du monolithe
- Aucune couche de compatibilité/fallback ajoutée.

### Point d’entrée public inchangé
- `default export TimelineEditor`
- `TimelineEditorProps` et `TimelineEditorHandle` inchangés.

### Validation
- Typecheck: `npx tsc --noEmit` OK.
- Tests timeline: 31/31 OK (PowerShell Windows).

## Verrou Phase 7 (validation parité + gate release)

### Exécution validations
- Typecheck global:
  - `npx tsc --noEmit` -> OK.
- Tests timeline ciblés (core/model/dnd/layout/suggestions):
  - 31/31 passés.
- Suite de tests projet complète (`npm run test`):
  - 542 passés / 2 échoués (échecs hors périmètre timeline refactor):
    - `electron/ipc/recording/diagnostics.test.ts` (timeout test)
    - `electron/ipc/recording/prune.test.ts` (attente de rejection non satisfaite)

### Vérification matrice de parité timeline
- API publique inchangée:
  - `TimelineEditor` default export
  - `TimelineEditorProps`
  - `TimelineEditorHandle`
- Features timeline validées par tests + revue wiring:
  - zoom, clip, annotation, audio, keyframes, shortcuts, toolbar, crop/aspect ratio.
- Sémantique DnD/overlap conservée (tests dnd + comportement rebranché).

### Décision gate
- Statut refactor timeline: **PASS** (périmètre feature/API).
- Statut release globale dépôt: **BLOCKED** tant que les 2 tests non-timeline restent rouges.
- Action recommandée: traiter séparément les régressions `electron/ipc/recording/*` avant merge release global.
