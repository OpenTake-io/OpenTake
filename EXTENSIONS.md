# Recordly Extension API

Extensions add render hooks, device frames, click animations, audio cues, and custom settings UI to Recordly. They run in the renderer process and use a permission-gated host API to hook into the frame render pipeline.

## Quick Start

Create a folder under `public/builtin-extensions/` (for built-ins) or install via the Extensions tab.

### Minimum Extension

```
my-extension/
  recordly-extension.json
  index.js
```

**recordly-extension.json**

```json
{
  "id": "com.example.my-extension",
  "name": "My Extension",
  "version": "1.0.0",
  "description": "A short description",
  "author": "Your Name",
  "license": "MIT",
  "main": "index.js",
  "permissions": ["render"]
}
```

**index.js**

```js
export function activate(api) {
  api.log('Hello from my extension!');
}

export function deactivate() {}
```

## Extension Manifest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier (reverse-domain style) |
| `name` | `string` | ✅ | Display name |
| `version` | `string` | ✅ | Semver version |
| `description` | `string` | ✅ | One-line summary |
| `author` | `string` | | Author or org name |
| `homepage` | `string` | | Repository/homepage URL |
| `license` | `string` | | SPDX license identifier |
| `engine` | `string` | | Minimum Recordly version |
| `icon` | `string` | | Path to icon relative to extension root |
| `main` | `string` | ✅ | Entry point JS file |
| `permissions` | `string[]` | ✅ | Required API permissions |
| `contributes` | `object` | | Optional metadata for bundled assets; behavior is still registered from `activate()` |

### Permissions

| Permission | Grants access to |
|-----------|-----------------|
| `render` | Frame render pipeline hooks |
| `cursor` | Cursor telemetry & cursor effect registration |
| `audio` | Sound playback |
| `timeline` | Timeline lifecycle events |
| `ui` | Settings panels & frames |
| `assets` | Bundled asset path resolution |
| `export` | Export lifecycle hooks |

Manifest `contributes` entries are metadata only today. Recordly does not auto-register them at runtime; extensions still need to call APIs like `registerFrame()`, `registerSettingsPanel()`, `resolveAsset()`, and `playSound()` from `activate()`.

## API Reference

The `api` object passed to `activate()` provides the following methods.

### Render Hooks

```js
const dispose = api.registerRenderHook(phase, (ctx) => {
  // Draw on ctx.ctx (a CanvasRenderingContext2D)
});
```

**Phases** (in pipeline order):

| Phase | Timing |
|-------|--------|
| `background` | Before video frame (custom backgrounds) |
| `post-video` | After video, before zoom |
| `post-zoom` | After zoom transform |
| `post-cursor` | After cursor (click effects, trails) |
| `post-webcam` | After webcam overlay |
| `post-annotations` | After annotations |
| `final` | Last pass (watermarks, HUD overlays) |

**RenderHookContext** fields:

- `width`, `height` — output canvas dimensions
- `timeMs` — current playback time in ms
- `durationMs` — total video duration
- `cursor` — `{ cx, cy, interactionType } | null` (normalized 0-1)
- `smoothedCursor` — `{ cx, cy, trail } | null` using the live rendered cursor smoothing state
- `ctx` — `CanvasRenderingContext2D` to draw on
- `videoLayout` — `{ maskRect, borderRadius, padding }`
- `zoom` — `{ scale, focusX, focusY, progress }`
- `shadow` — `{ enabled, intensity }`

### Cursor Effects

```js
api.registerCursorEffect((ctx) => {
  // ctx.cx, ctx.cy — cursor position (normalized 0-1)
  // ctx.elapsedMs — time since the click
  // ctx.interactionType — 'click', 'double-click', 'right-click', 'mouseup'
  // ctx.ctx — CanvasRenderingContext2D
  // ctx.width, ctx.height — canvas dimensions

  // Return true to keep animating, false to stop
  return ctx.elapsedMs < 600;
});
```

### Device Frames

Register browser chrome, laptop bezels, or any device overlay.

**Preferred: draw function** (resolution-independent, no bitmap artifacts):

```js
api.registerFrame({
  id: 'my-frame',
  label: 'My Frame',
  category: 'browser', // 'browser' | 'laptop' | 'phone' | 'tablet' | 'desktop' | 'custom'
  appearance: 'dark',  // 'light' | 'dark'
  screenInsets: { top: 0.05, right: 0.005, bottom: 0.005, left: 0.005 },
  draw(ctx, width, height) {
    // Draw frame chrome at the given dimensions.
    // Leave the screen area transparent (use globalCompositeOperation: 'destination-out').
    // All dimensions are proportional — the function is called at whatever
    // resolution is needed (preview, export, thumbnail).
  },
});
```

**Legacy: static image** (scaled as bitmap — may produce artifacts):

```js
api.registerFrame({
  id: 'my-frame',
  label: 'My Frame',
  category: 'browser',
  file: 'frames/my-frame.png', // relative to extension root
  screenInsets: { top: 0.05, right: 0.01, bottom: 0.01, left: 0.01 },
});
```

**`screenInsets`** define where the video content sits inside the frame, as fractions (0–1) of the frame dimensions. Example: `{ top: 0.05 }` means the top 5% of the frame image is the title bar/bezel.

### Settings Panels

```js
api.registerSettingsPanel({
  id: 'my-settings',
  label: 'My Extension',
  icon: 'sparkles',        // Lucide icon name
  parentSection: 'cursor', // Nest inside an existing section
  fields: [
    { id: 'enabled', label: 'Enable', type: 'toggle', defaultValue: true },
    { id: 'color', label: 'Color', type: 'color', defaultValue: '#2563EB' },
    { id: 'size', label: 'Size', type: 'slider', defaultValue: 1.0, min: 0.1, max: 3.0, step: 0.1 },
    { id: 'style', label: 'Style', type: 'select', defaultValue: 'ripple',
      options: [{ label: 'Ripple', value: 'ripple' }, { label: 'Pulse', value: 'pulse' }] },
    { id: 'name', label: 'Label', type: 'text', defaultValue: '' },
  ],
});
```

**`parentSection`** options:
- `'cursor'` — appears inside the Cursor settings section
- `'scene'` — inside Scene settings
- Omit for a **standalone section** with its own icon in the settings rail

**Reading/writing settings:**

```js
const color = api.getSetting('color');
api.setSetting('color', '#FF0000');
```

### Events

```js
api.on('cursor:click', (event) => {
  // event.timeMs, event.data
});
```

- `timeline` permission is required for `playback:*` and `timeline:*` subscriptions.
- `cursor` permission is required for `cursor:*` subscriptions.
- `export` permission is required for `export:*` subscriptions.

| Event | Description |
|-------|-------------|
| `playback:timeupdate` | Playback time changed |
| `playback:play` | Playback started |
| `playback:pause` | Playback paused |
| `cursor:click` | Mouse click detected |
| `cursor:move` | Cursor moved |
| `timeline:region-added` | Zoom/trim region added |
| `timeline:region-removed` | Region removed |
| `export:start` | Export began |
| `export:frame` | Frame exported |
| `export:complete` | Export finished |

### Sound Playback

```js
const stop = api.playSound('sounds/click.mp3', { volume: 0.8 });
// Call stop() to cancel playback early
```

### Query APIs

Read-only access to project state:

```js
api.getVideoInfo()     // { width, height, durationMs, fps } | null
api.getVideoLayout()   // { maskRect, canvasWidth, canvasHeight, borderRadius, padding } | null
api.getCursorAt(timeMs) // { cx, cy, timeMs, interactionType, pressure } | null
api.getSmoothedCursor() // { cx, cy, timeMs, trail } | null
api.getZoomState()     // { scale, focusX, focusY, progress } | null
api.getShadowConfig()  // { enabled, intensity }
api.getKeystrokesInRange(startMs, endMs) // [{ timeMs, key, modifiers }]
```

### Asset Resolution

```js
const url = api.resolveAsset('images/overlay.png');
// Returns a file:// URL scoped to the extension directory
```

### Logging

```js
api.log('Debug message', someData);
// Output: [ext:com.example.my-extension] Debug message ...
```

## Lifecycle

1. **Discovery**: Recordly scans `public/builtin-extensions/` and user extension directories
2. **Activation**: `activate(api)` is called — register hooks, effects, panels
3. **Runtime**: Hooks/effects execute each frame; settings panel renders in the UI
4. **Deactivation**: `deactivate()` is called; all registered hooks are auto-disposed

All `register*` methods return a dispose function for early cleanup:

```js
const dispose = api.registerRenderHook('final', myHook);
// Later: dispose() to unregister
```

## Built-in Extensions

| Extension | What it does |
|-----------|-------------|
| `recordly.frames` | Browser chrome, macOS window, MacBook bezel frames |
| `recordly.click-effects` | Animated ripple/sparkle/pulse effects at click positions |

## Example: Full Click Effect Extension

```js
const DURATION = 600;

export function activate(api) {
  api.registerSettingsPanel({
    id: 'settings',
    label: 'My Click Effect',
    icon: 'mouse-pointer-click',
    parentSection: 'cursor',
    fields: [
      { id: 'color', label: 'Color', type: 'color', defaultValue: '#FF6B6B' },
    ],
  });

  api.registerCursorEffect((ctx) => {
    const progress = ctx.elapsedMs / DURATION;
    if (progress >= 1) return false;

    const px = ctx.cx * ctx.width;
    const py = ctx.cy * ctx.height;
    const radius = 30 * progress;
    const alpha = 1 - progress;
    const color = api.getSetting('color') || '#FF6B6B';

    ctx.ctx.beginPath();
    ctx.ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.ctx.strokeStyle = color;
    ctx.ctx.globalAlpha = alpha;
    ctx.ctx.lineWidth = 2;
    ctx.ctx.stroke();
    ctx.ctx.globalAlpha = 1;

    return true;
  });
}

export function deactivate() {}
```

## Example: Resolution-Independent Device Frame

```js
function drawMyFrame(ctx, W, H) {
  const titleBarH = Math.round(H * 0.04);
  const border = Math.round(H * 0.003);
  const radius = Math.round(W * 0.005);

  // Draw outer frame
  ctx.fillStyle = '#1E1E2E';
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, radius);
  ctx.fill();

  // Cut out screen area
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.fillRect(border, titleBarH, W - border * 2, H - titleBarH - border);
  ctx.restore();
}

export function activate(api) {
  api.registerFrame({
    id: 'my-frame',
    label: 'My Custom Frame',
    category: 'custom',
    screenInsets: { top: 0.04, right: 0.003, bottom: 0.003, left: 0.003 },
    draw: drawMyFrame,
  });
}

export function deactivate() {}
```
