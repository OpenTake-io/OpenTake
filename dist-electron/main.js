import { ipcMain as d, BrowserWindow as M, app as v, desktopCapturer as ze, shell as H, systemPreferences as ie, dialog as re, session as Fe, nativeImage as ct, Tray as lt, Menu as xe } from "electron";
import { fileURLToPath as He } from "node:url";
import u from "node:path";
import h from "node:fs/promises";
import { createRequire as qe } from "node:module";
import { execFile as ut, spawn as Ne, spawnSync as dt } from "node:child_process";
import { promisify as ft } from "node:util";
const ye = u.dirname(He(import.meta.url)), pt = qe(import.meta.url), mt = u.join(ye, ".."), Q = process.env.VITE_DEV_SERVER_URL, ge = u.join(mt, "dist"), Je = u.join(process.env.VITE_PUBLIC || ge, "app-icons", "recordly-512.png");
let K = null;
function Ge() {
  return pt("electron").screen;
}
d.on("hud-overlay-hide", () => {
  K && !K.isDestroyed() && K.minimize();
});
function ht() {
  const e = Ge().getPrimaryDisplay(), { workArea: r } = e, i = 500, a = 155, s = Math.floor(r.x + (r.width - i) / 2), t = Math.floor(r.y + r.height - a - 5), n = new M({
    width: i,
    height: a,
    minWidth: 500,
    maxWidth: 500,
    minHeight: 155,
    maxHeight: 155,
    x: s,
    y: t,
    frame: !1,
    transparent: !0,
    resizable: !1,
    alwaysOnTop: !0,
    skipTaskbar: !0,
    hasShadow: !1,
    webPreferences: {
      preload: u.join(ye, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      backgroundThrottling: !1
    }
  });
  return n.webContents.on("did-finish-load", () => {
    n == null || n.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), K = n, n.on("closed", () => {
    K === n && (K = null);
  }), Q ? n.loadURL(Q + "?windowType=hud-overlay") : n.loadFile(u.join(ge, "index.html"), {
    query: { windowType: "hud-overlay" }
  }), n;
}
function wt() {
  const e = process.platform === "darwin", r = new M({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    ...process.platform !== "darwin" && {
      icon: Je
    },
    ...e && {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 12, y: 12 }
    },
    transparent: !1,
    resizable: !0,
    alwaysOnTop: !1,
    skipTaskbar: !1,
    title: "Recordly",
    backgroundColor: "#000000",
    webPreferences: {
      preload: u.join(ye, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0,
      webSecurity: !1,
      backgroundThrottling: !1
    }
  });
  return r.maximize(), r.webContents.on("did-finish-load", () => {
    r == null || r.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), Q ? r.loadURL(Q + "?windowType=editor") : r.loadFile(u.join(ge, "index.html"), {
    query: { windowType: "editor" }
  }), r;
}
function yt() {
  const { width: e, height: r } = Ge().getPrimaryDisplay().workAreaSize, i = new M({
    width: 620,
    height: 420,
    minHeight: 350,
    maxHeight: 500,
    x: Math.round((e - 620) / 2),
    y: Math.round((r - 420) / 2),
    frame: !1,
    resizable: !1,
    alwaysOnTop: !0,
    transparent: !0,
    ...process.platform !== "darwin" && {
      icon: Je
    },
    backgroundColor: "#00000000",
    webPreferences: {
      preload: u.join(ye, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  });
  return Q ? i.loadURL(Q + "?windowType=source-selector") : i.loadFile(u.join(ge, "index.html"), {
    query: { windowType: "source-selector" }
  }), i;
}
const se = ft(ut), Me = qe(import.meta.url), ne = "recordly", Xe = ["openscreen"], Re = u.join(v.getPath("userData"), "shortcuts.json"), gt = "recording-", vt = 20, St = 14 * 24 * 60 * 60 * 1e3;
function Y() {
  return Me("electron").screen;
}
let S = null, x = null, A = !1, _ = null, F = null, U = "", I = null, O = !1, ee = null, R = null, L = "", te = !1, N = null, Z = "", q = null, J = null, Pe = null, j;
function bt() {
  return (S == null ? void 0 : S.id) ?? null;
}
function fe(e) {
  return u.resolve(e);
}
function D(e) {
  return e.trim().replace(/\s+/g, " ").toLowerCase();
}
function De(e) {
  if (!e || e.isEmpty())
    return !1;
  const r = e.getSize();
  return r.width > 1 && r.height > 1;
}
function Ae(e) {
  return e === "screen" ? "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture" : "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
}
function Ft(e) {
  return u.basename(e).startsWith(gt);
}
function Ke(e) {
  return `${e}.cursor.json`;
}
async function Pt(e) {
  const r = u.basename(e, u.extname(e)), i = [ne, ...Xe];
  for (const a of i) {
    const s = u.join(u.dirname(e), `${r}.${a}`);
    try {
      return await h.access(s), !0;
    } catch {
      continue;
    }
  }
  return !1;
}
async function Ct(e = []) {
  const r = new Set(
    [_, ...e].filter((n) => !!n).map((n) => fe(n))
  ), i = await h.readdir(P, { withFileTypes: !0 }), s = (await Promise.all(
    i.filter((n) => n.isFile() && /^recording-.*\.(mp4|mov|webm)$/i.test(n.name)).map(async (n) => {
      const o = u.join(P, n.name), c = await h.stat(o);
      return { filePath: o, stats: c };
    })
  )).sort((n, o) => o.stats.mtimeMs - n.stats.mtimeMs), t = Date.now();
  for (const [n, o] of s.entries()) {
    const c = fe(o.filePath);
    if (r.has(c) || await Pt(o.filePath))
      continue;
    const p = t - o.stats.mtimeMs > St, f = n >= vt;
    if (!(!p && !f))
      try {
        await h.rm(o.filePath, { force: !0 }), await h.rm(Ke(o.filePath), { force: !0 });
      } catch (C) {
        console.warn("Failed to prune old auto recording:", o.filePath, C);
      }
  }
}
function ve(...e) {
  const r = v.getAppPath(), i = u.join(r, ...e);
  return v.isPackaged ? i.replace(/\.asar([/\\])/, ".asar.unpacked$1") : i;
}
function Tt() {
  return ve("electron", "native", "ScreenCaptureKitRecorder.swift");
}
function xt() {
  return u.join(v.getPath("userData"), "native-tools", "openscreen-screencapturekit-helper");
}
function Nt() {
  return ve("electron", "native", "SystemCursorAssets.swift");
}
function It() {
  return u.join(v.getPath("userData"), "native-tools", "openscreen-system-cursors");
}
function Et() {
  return ve("electron", "native", "NativeCursorMonitor.swift");
}
function Mt() {
  return u.join(v.getPath("userData"), "native-tools", "openscreen-native-cursor-monitor");
}
function _t() {
  return ve("electron", "native", "ScreenCaptureKitWindowList.swift");
}
function Rt() {
  return u.join(v.getPath("userData"), "native-tools", "openscreen-window-list");
}
let Ce = null, Oe = 0;
async function Se(e, r, i) {
  const a = u.dirname(r);
  await h.mkdir(a, { recursive: !0 });
  let s = !1;
  try {
    const [n, o] = await Promise.all([
      h.stat(e),
      h.stat(r).catch(() => null)
    ]);
    s = !o || n.mtimeMs > o.mtimeMs;
  } catch (n) {
    throw new Error(`${i} source is unavailable: ${String(n)}`);
  }
  if (!s)
    return r;
  const t = dt("swiftc", ["-O", e, "-o", r], {
    encoding: "utf8",
    timeout: 12e4
  });
  if (t.status !== 0) {
    const n = [t.stderr, t.stdout].filter(Boolean).join(`
`).trim();
    throw new Error(n || `Failed to compile ${i}`);
  }
  return r;
}
async function Dt() {
  return Se(
    Tt(),
    xt(),
    "native ScreenCaptureKit helper"
  );
}
async function At() {
  return Se(
    _t(),
    Rt(),
    "native ScreenCaptureKit window list helper"
  );
}
async function Ye(e) {
  if (process.platform !== "darwin")
    return [];
  const r = (e == null ? void 0 : e.maxAgeMs) ?? 5e3, i = Date.now();
  if (Ce && i - Oe < r)
    return Ce;
  const a = await At(), { stdout: s } = await se(a, [], {
    timeout: 3e4,
    maxBuffer: 10 * 1024 * 1024
  }), t = JSON.parse(s);
  if (!Array.isArray(t))
    return [];
  const n = t.filter((o) => {
    if (!o || typeof o != "object")
      return !1;
    const c = o;
    return typeof c.id == "string" && typeof c.name == "string";
  });
  return Ce = n, Oe = i, n;
}
async function Ot() {
  if (process.platform !== "darwin")
    return J = {}, Pe = null, J;
  const e = Nt(), r = await h.stat(e);
  if (J && Pe === r.mtimeMs)
    return J;
  const i = await Se(
    e,
    It(),
    "system cursor helper"
  ), { stdout: a } = await se(i, [], { timeout: 15e3, maxBuffer: 20 * 1024 * 1024 }), s = JSON.parse(a);
  return J = Object.fromEntries(
    Object.entries(s).filter(([, t]) => typeof (t == null ? void 0 : t.dataUrl) == "string" && typeof (t == null ? void 0 : t.hotspotX) == "number" && typeof (t == null ? void 0 : t.hotspotY) == "number" && typeof (t == null ? void 0 : t.width) == "number" && typeof (t == null ? void 0 : t.height) == "number")
  ), Pe = r.mtimeMs, J;
}
function pe(e) {
  if (!e) return null;
  const r = e.match(/^window:(\d+)/);
  return r ? Number.parseInt(r[1], 10) : null;
}
function jt() {
  const e = Me("ffmpeg-static");
  return typeof e == "string" ? e : typeof (e == null ? void 0 : e.default) == "string" ? e.default : null;
}
function kt() {
  const e = Me("uiohook-napi");
  return (e == null ? void 0 : e.uIOhook) ?? (e == null ? void 0 : e.default) ?? e;
}
function Ze() {
  const e = jt();
  if (!e || typeof e != "string")
    throw new Error("FFmpeg binary is unavailable. Install ffmpeg-static for this platform.");
  return v.isPackaged ? e.replace(".asar/", ".asar.unpacked/") : e;
}
function Wt(e) {
  return new Promise((r, i) => {
    const a = (o) => {
      n(), i(o);
    }, s = (o) => {
      n(), i(new Error(Z.trim() || `FFmpeg exited before recording started (code ${o ?? "unknown"})`));
    }, t = setTimeout(() => {
      n(), r();
    }, 900), n = () => {
      clearTimeout(t), e.off("error", a), e.off("exit", s);
    };
    e.once("error", a), e.once("exit", s);
  });
}
function Lt(e, r) {
  return new Promise((i, a) => {
    const s = async (o) => {
      n();
      try {
        if (await h.access(r), o === 0 || o === null) {
          i(r);
          return;
        }
        if (Z.includes("Exiting normally")) {
          i(r);
          return;
        }
      } catch {
      }
      a(new Error(Z.trim() || `FFmpeg exited with code ${o ?? "unknown"}`));
    }, t = (o) => {
      n(), a(o);
    }, n = () => {
      e.off("close", s), e.off("error", t);
    };
    e.once("close", s), e.once("error", t);
  });
}
function $t(e) {
  const r = Number(e == null ? void 0 : e.display_id);
  if (Number.isFinite(r)) {
    const i = Y().getAllDisplays().find((a) => a.id === r);
    if (i)
      return i.bounds;
  }
  return Y().getPrimaryDisplay().bounds;
}
function je(e) {
  const r = e.match(/Absolute upper-left X:\s+(-?\d+)/), i = e.match(/Absolute upper-left Y:\s+(-?\d+)/), a = e.match(/Width:\s+(\d+)/), s = e.match(/Height:\s+(\d+)/);
  return !r || !i || !a || !s ? null : {
    x: Number.parseInt(r[1], 10),
    y: Number.parseInt(i[1], 10),
    width: Number.parseInt(a[1], 10),
    height: Number.parseInt(s[1], 10)
  };
}
async function Bt(e) {
  const r = pe(e == null ? void 0 : e.id);
  if (r)
    try {
      const { stdout: a } = await se("xwininfo", ["-id", String(r)], { timeout: 1500 }), s = je(a);
      if (s && s.width > 0 && s.height > 0)
        return s;
    } catch {
    }
  const i = typeof e.windowTitle == "string" ? e.windowTitle.trim() : e.name.trim();
  if (!i)
    return null;
  try {
    const { stdout: a } = await se("xwininfo", ["-name", i], { timeout: 1500 }), s = je(a);
    return s && s.width > 0 && s.height > 0 ? s : null;
  } catch {
    return null;
  }
}
async function Ut(e, r) {
  var a, s;
  const i = ["-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", r];
  if (process.platform === "win32") {
    if ((a = e == null ? void 0 : e.id) != null && a.startsWith("window:")) {
      const t = typeof e.windowTitle == "string" ? e.windowTitle.trim() : e.name.trim();
      if (!t)
        throw new Error("Missing window title for FFmpeg window capture");
      return ["-y", "-f", "gdigrab", "-framerate", "60", "-draw_mouse", "0", "-i", `title=${t}`, ...i];
    }
    return ["-y", "-f", "gdigrab", "-framerate", "60", "-draw_mouse", "0", "-i", "desktop", ...i];
  }
  if (process.platform === "linux") {
    const t = process.env.DISPLAY || ":0.0";
    if ((s = e == null ? void 0 : e.id) != null && s.startsWith("window:")) {
      const o = await Bt(e);
      if (!o)
        throw new Error("Unable to resolve Linux window bounds for FFmpeg capture");
      return [
        "-y",
        "-f",
        "x11grab",
        "-framerate",
        "60",
        "-draw_mouse",
        "0",
        "-video_size",
        `${Math.max(2, o.width)}x${Math.max(2, o.height)}`,
        "-i",
        `${t}+${Math.round(o.x)},${Math.round(o.y)}`,
        ...i
      ];
    }
    const n = $t(e);
    return [
      "-y",
      "-f",
      "x11grab",
      "-framerate",
      "60",
      "-draw_mouse",
      "0",
      "-video_size",
      `${Math.max(2, n.width)}x${Math.max(2, n.height)}`,
      "-i",
      `${t}+${Math.round(n.x)},${Math.round(n.y)}`,
      ...i
    ];
  }
  if (process.platform === "darwin")
    return ["-y", "-f", "avfoundation", "-capture_cursor", "0", "-framerate", "60", "-i", "1:none", ...i];
  throw new Error(`FFmpeg capture is not supported on ${process.platform}`);
}
function Vt(e) {
  return new Promise((r, i) => {
    const a = setTimeout(() => {
      o(), i(new Error("Timed out waiting for ScreenCaptureKit recorder to start"));
    }, 12e3), s = (c) => {
      c.toString().includes("Recording started") && (o(), r());
    }, t = (c) => {
      o(), i(c);
    }, n = (c) => {
      o(), i(new Error(U.trim() || `Native capture helper exited before recording started (code ${c ?? "unknown"})`));
    }, o = () => {
      clearTimeout(a), e.stdout.off("data", s), e.off("error", t), e.off("exit", n);
    };
    e.stdout.on("data", s), e.once("error", t), e.once("exit", n);
  });
}
function zt(e) {
  return new Promise((r, i) => {
    const a = (n) => {
      t();
      const o = U.match(/Recording stopped\. Output path: (.+)/);
      if (o != null && o[1]) {
        r(o[1].trim());
        return;
      }
      if (n === 0 && I) {
        r(I);
        return;
      }
      i(new Error(U.trim() || `Native capture helper exited with code ${n ?? "unknown"}`));
    }, s = (n) => {
      t(), i(n);
    }, t = () => {
      e.off("close", a), e.off("error", s);
    };
    e.once("close", a), e.once("error", s);
  });
}
async function Ht(e, r) {
  const i = Ze(), a = `${e}.mixed.mp4`;
  await se(
    i,
    [
      "-y",
      "-i",
      e,
      "-i",
      r,
      "-filter_complex",
      "[0:a][1:a]amix=inputs=2:duration=longest:normalize=0[aout]",
      "-map",
      "0:v:0",
      "-map",
      "[aout]",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      a
    ],
    { timeout: 12e4, maxBuffer: 10 * 1024 * 1024 }
  ), await et(a, e), await h.rm(r, { force: !0 });
}
function qt(e, r) {
  M.getAllWindows().forEach((i) => {
    i.isDestroyed() || i.webContents.send("recording-interrupted", { reason: e, message: r });
  });
}
function Jt(e) {
  M.getAllWindows().forEach((r) => {
    r.isDestroyed() || r.webContents.send("cursor-state-changed", { cursorType: e });
  });
}
function Gt(e) {
  if (!B)
    return;
  const r = he();
  r && we(r.cx, r.cy, Date.now() - ae, "move", e);
}
function Xt(e) {
  e.once("close", () => {
    const r = A;
    if (F = null, !r || O)
      return;
    A = !1, I = null, O = !1;
    const i = (S == null ? void 0 : S.name) ?? "Screen";
    M.getAllWindows().forEach((t) => {
      t.isDestroyed() || t.webContents.send("recording-state-changed", {
        recording: !1,
        sourceName: i
      });
    });
    const a = U.includes("WINDOW_UNAVAILABLE") ? "window-unavailable" : "capture-stopped";
    qt(a, a === "window-unavailable" ? "The selected window is no longer capturable. Please reselect a window." : "Recording stopped unexpectedly.");
  });
}
async function Kt() {
  return Se(
    Et(),
    Mt(),
    "native cursor monitor helper"
  );
}
async function Yt() {
  if (Qe(), process.platform !== "darwin") {
    j = void 0;
    return;
  }
  try {
    const e = await Kt();
    L = "", j = void 0, R = Ne(e, [], {
      stdio: ["pipe", "pipe", "pipe"]
    }), R.stdout.on("data", (r) => {
      L += r.toString();
      const i = L.split(/\r?\n/);
      L = i.pop() ?? "";
      for (const a of i) {
        const s = a.match(/^STATE:(.+)$/);
        if (!s) continue;
        const t = s[1].trim();
        (t === "arrow" || t === "text" || t === "pointer" || t === "crosshair" || t === "open-hand" || t === "closed-hand" || t === "resize-ew" || t === "resize-ns" || t === "not-allowed") && j !== t && (j = t, Gt(t), Jt(t));
      }
    }), R.once("close", () => {
      R = null, L = "", j = void 0;
    });
  } catch (e) {
    console.warn("Failed to start native cursor monitor:", e), R = null, L = "", j = void 0;
  }
}
function Qe() {
  if (j = void 0, !!R) {
    try {
      R.stdin.write(`stop
`);
    } catch {
    }
    try {
      R.kill();
    } catch {
    }
    R = null, L = "";
  }
}
async function et(e, r) {
  await h.mkdir(u.dirname(r), { recursive: !0 }), await h.rm(r, { force: !0 });
  try {
    await h.rename(e, r);
  } catch (i) {
    if (i.code !== "EXDEV")
      throw i;
    await h.copyFile(e, r), await h.unlink(e);
  }
}
function Zt(e) {
  return !e || !x ? !1 : fe(e) === fe(x);
}
const Qt = 2, er = 33, tr = 60 * 60 * 30;
let le = null, ae = 0, k = [], E = [], B = !1, ue = null, ke = !1, $ = null, me = null, de = null;
function G(e, r, i) {
  return Math.min(i, Math.max(r, e));
}
function We() {
  le && (clearInterval(le), le = null);
}
function Le() {
  ue && (ue(), ue = null);
}
function Ie() {
  de && (clearInterval(de), de = null), me = null;
}
function rr(e) {
  if (!e)
    return null;
  const { x: r, y: i, width: a, height: s } = e;
  return typeof r != "number" || !Number.isFinite(r) || typeof i != "number" || !Number.isFinite(i) || typeof a != "number" || !Number.isFinite(a) || typeof s != "number" || !Number.isFinite(s) || a <= 0 || s <= 0 ? null : { x: r, y: i, width: a, height: s };
}
async function nr(e) {
  const r = pe(e.id);
  if (!r)
    return null;
  try {
    const a = (await Ye({ maxAgeMs: 250 })).find((s) => pe(s.id) === r);
    return rr(a);
  } catch {
    return null;
  }
}
async function $e() {
  var r;
  if (process.platform !== "darwin" || !((r = S == null ? void 0 : S.id) != null && r.startsWith("window:"))) {
    me = null;
    return;
  }
  const e = await nr(S);
  e && (me = e);
}
function or() {
  var e;
  Ie(), !(process.platform !== "darwin" || !((e = S == null ? void 0 : S.id) != null && e.startsWith("window:"))) && ($e(), de = setInterval(() => {
    $e();
  }, 250));
}
function he() {
  var f;
  const e = Y().getCursorScreenPoint(), r = (f = S == null ? void 0 : S.id) != null && f.startsWith("window:") ? me : null;
  if (r) {
    const C = Math.max(1, r.width), T = Math.max(1, r.height);
    return {
      cx: G((e.x - r.x) / C, 0, 1),
      cy: G((e.y - r.y) / T, 0, 1)
    };
  }
  const i = Number(S == null ? void 0 : S.display_id), t = ((Number.isFinite(i) ? Y().getAllDisplays().find((C) => C.id === i) ?? null : null) ?? Y().getDisplayNearestPoint(e)).bounds, n = Math.max(1, t.width), o = Math.max(1, t.height), c = G((e.x - t.x) / n, 0, 1), p = G((e.y - t.y) / o, 0, 1);
  return { cx: c, cy: p };
}
function we(e, r, i, a = "move", s) {
  k.push({
    timeMs: Math.max(0, i),
    cx: e,
    cy: r,
    interactionType: a,
    cursorType: s ?? j
  }), k.length > tr && k.shift();
}
function Be() {
  const e = he();
  e && we(e.cx, e.cy, Date.now() - ae, "move");
}
async function ir(e) {
  const r = Ke(e);
  E.length > 0 && await h.writeFile(
    r,
    JSON.stringify({ version: Qt, samples: E }, null, 2),
    "utf-8"
  ), E = [];
}
function tt() {
  var r;
  if (k.length === 0)
    return;
  if (E.length === 0) {
    E = [...k];
    return;
  }
  const e = ((r = E[E.length - 1]) == null ? void 0 : r.timeMs) ?? -1;
  E = [
    ...E,
    ...k.filter((i) => i.timeMs > e)
  ];
}
async function ce(e) {
  return tt(), _ = e, x = null, await ir(e), Ft(e) && await Ct([e]), {
    success: !0,
    path: e,
    message: "Video stored successfully"
  };
}
async function sr() {
  if (B && ["darwin", "win32"].includes(process.platform))
    try {
      const e = kt();
      if (!B || !e || typeof e.on != "function" || typeof e.start != "function")
        return;
      const r = (a) => {
        if (!B)
          return;
        const s = he();
        if (!s)
          return;
        const t = Date.now() - ae, n = typeof (a == null ? void 0 : a.button) == "number" ? a.button : 1;
        let o = "click";
        if (n === 2)
          o = "right-click";
        else if (n === 3)
          o = "middle-click";
        else {
          const p = $ ? Math.hypot(s.cx - $.cx, s.cy - $.cy) : Number.POSITIVE_INFINITY;
          $ && t - $.timeMs <= 350 && p <= 0.04 && (o = "double-click"), $ = { timeMs: t, cx: s.cx, cy: s.cy };
        }
        we(s.cx, s.cy, t, o);
      }, i = (a) => {
        if (!B)
          return;
        const s = he();
        if (!s)
          return;
        const t = Date.now() - ae;
        we(s.cx, s.cy, t, "mouseup");
      };
      e.on("mousedown", r), e.on("mouseup", i), e.start(), ue = () => {
        try {
          typeof e.off == "function" ? (e.off("mousedown", r), e.off("mouseup", i)) : typeof e.removeListener == "function" && (e.removeListener("mousedown", r), e.removeListener("mouseup", i));
        } catch {
        }
        try {
          typeof e.stop == "function" && e.stop();
        } catch {
        }
      };
    } catch (e) {
      ke || (ke = !0, console.warn("[CursorTelemetry] Global interaction capture unavailable:", e));
    }
}
function ar(e, r, i, a, s) {
  d.handle("get-sources", async (t, n) => {
    const o = Array.isArray(n == null ? void 0 : n.types) ? n.types.includes("screen") : !0, c = Array.isArray(n == null ? void 0 : n.types) ? n.types.includes("window") : !0, p = [
      ...o ? ["screen"] : [],
      ...c ? ["window"] : []
    ], f = p.length > 0 ? await ze.getSources({
      ...n,
      types: p
    }) : [], C = new Set(
      [
        v.getName(),
        "Recordly",
        ...M.getAllWindows().flatMap((y) => {
          const l = y.getTitle().trim();
          return l ? [l] : [];
        })
      ].map((y) => D(y)).filter(Boolean)
    ), T = f.filter((y) => y.id.startsWith("screen:")).map((y) => ({
      id: y.id,
      name: y.name,
      display_id: y.display_id,
      thumbnail: y.thumbnail ? y.thumbnail.toDataURL() : null,
      appIcon: y.appIcon ? y.appIcon.toDataURL() : null
    }));
    if (process.platform !== "darwin" || !c) {
      const y = f.filter((l) => l.id.startsWith("window:")).filter((l) => De(l.thumbnail)).filter((l) => {
        const b = D(l.name);
        if (!b)
          return !0;
        for (const w of C)
          if (w && b === w)
            return !1;
        return !0;
      }).map((l) => ({
        id: l.id,
        name: l.name,
        display_id: l.display_id,
        thumbnail: l.thumbnail ? l.thumbnail.toDataURL() : null,
        appIcon: l.appIcon ? l.appIcon.toDataURL() : null
      }));
      return [...T, ...y];
    }
    try {
      const y = await Ye(), l = new Map(
        f.filter((w) => w.id.startsWith("window:")).map((w) => [w.id, w])
      ), b = y.filter((w) => {
        const g = D(w.windowTitle ?? w.name), V = D(w.appName ?? "");
        if (V && V === D(v.getName()))
          return !1;
        if (!g)
          return !0;
        for (const z of C)
          if (z && g === z)
            return !1;
        return !0;
      }).map((w) => {
        const g = l.get(w.id);
        return {
          id: w.id,
          name: w.name,
          display_id: w.display_id ?? (g == null ? void 0 : g.display_id) ?? "",
          thumbnail: g != null && g.thumbnail ? g.thumbnail.toDataURL() : null,
          appIcon: w.appIcon ?? (g != null && g.appIcon ? g.appIcon.toDataURL() : null),
          appName: w.appName,
          windowTitle: w.windowTitle
        };
      }).filter((w) => !!w.thumbnail);
      return [...T, ...b];
    } catch (y) {
      console.warn("Falling back to Electron window enumeration on macOS:", y);
      const l = f.filter((b) => b.id.startsWith("window:")).filter((b) => De(b.thumbnail)).filter((b) => {
        const w = D(b.name);
        if (!w)
          return !0;
        for (const g of C)
          if (g && (w === g || w.includes(g) || g.includes(w)))
            return !1;
        return !0;
      }).map((b) => ({
        id: b.id,
        name: b.name,
        display_id: b.display_id,
        thumbnail: b.thumbnail ? b.thumbnail.toDataURL() : null,
        appIcon: b.appIcon ? b.appIcon.toDataURL() : null
      }));
      return [...T, ...l];
    }
  }), d.handle("select-source", (t, n) => {
    S = n, Ie();
    const o = a();
    return o && o.close(), S;
  }), d.handle("get-selected-source", () => S), d.handle("open-source-selector", () => {
    const t = a();
    if (t) {
      t.focus();
      return;
    }
    r();
  }), d.handle("switch-to-editor", () => {
    const t = i();
    t && t.close(), e();
  }), d.handle("start-native-screen-recording", async (t, n, o) => {
    var c, p;
    if (process.platform !== "darwin")
      return { success: !1, message: "Native screen recording is only available on macOS." };
    if (F && !A) {
      try {
        F.kill();
      } catch {
      }
      F = null, I = null, O = !1;
    }
    if (F)
      return { success: !1, message: "A native screen recording is already active." };
    try {
      const f = D(String((n == null ? void 0 : n.appName) ?? "")), C = D(v.getName());
      if ((c = n == null ? void 0 : n.id) != null && c.startsWith("window:") && f && (f === C || f === "recordly"))
        return { success: !1, message: "Cannot record Recordly windows. Please select another app window." };
      const T = await Dt(), y = u.join(P, `recording-${Date.now()}.mp4`), l = !!(o != null && o.capturesSystemAudio), b = !!(o != null && o.capturesMicrophone), w = l && b ? u.join(P, `recording-${Date.now()}.mic.m4a`) : null, g = {
        fps: 60,
        outputPath: y,
        capturesSystemAudio: l,
        capturesMicrophone: b
      };
      o != null && o.microphoneDeviceId && (g.microphoneDeviceId = o.microphoneDeviceId), w && (g.microphoneOutputPath = w);
      const V = pe(n == null ? void 0 : n.id), z = Number(n == null ? void 0 : n.display_id);
      return Number.isFinite(V) && V && ((p = n == null ? void 0 : n.id) != null && p.startsWith("window:")) ? g.windowId = V : Number.isFinite(z) && z > 0 ? g.displayId = z : g.displayId = Number(Y().getPrimaryDisplay().id), U = "", I = y, ee = w, O = !1, F = Ne(T, [JSON.stringify(g)], {
        cwd: P,
        stdio: ["pipe", "pipe", "pipe"]
      }), Xt(F), F.stdout.on("data", (be) => {
        U += be.toString();
      }), F.stderr.on("data", (be) => {
        U += be.toString();
      }), await Vt(F), A = !0, { success: !0 };
    } catch (f) {
      console.error("Failed to start native ScreenCaptureKit recording:", f);
      try {
        F == null || F.kill();
      } catch {
      }
      return A = !1, F = null, I = null, ee = null, O = !1, {
        success: !1,
        message: "Failed to start native ScreenCaptureKit recording",
        error: String(f)
      };
    }
  }), d.handle("stop-native-screen-recording", async () => {
    if (process.platform !== "darwin")
      return { success: !1, message: "Native screen recording is only available on macOS." };
    if (!A)
      return { success: !1, message: "No native screen recording is active." };
    try {
      if (!F)
        throw new Error("Native capture helper process is not running");
      const t = F, n = I, o = ee;
      O = !0, t.stdin.write(`stop
`);
      const c = await zt(t);
      F = null, A = !1, I = null, ee = null, O = !1;
      const p = n ?? c;
      if (c !== p && await et(c, p), o)
        try {
          await h.access(o), await Ht(p, o);
        } catch (f) {
          console.warn("Failed to mix native macOS microphone audio into capture:", f);
        }
      return await ce(p);
    } catch (t) {
      console.error("Failed to stop native ScreenCaptureKit recording:", t);
      const n = I;
      if (A = !1, F = null, I = null, ee = null, O = !1, n)
        try {
          return await h.access(n), console.log("[stop-native-screen-recording] Recovering with fallback path:", n), await ce(n);
        } catch {
        }
      return {
        success: !1,
        message: "Failed to stop native ScreenCaptureKit recording",
        error: String(t)
      };
    }
  }), d.handle("get-system-cursor-assets", async () => {
    try {
      return { success: !0, cursors: await Ot() };
    } catch (t) {
      return console.error("Failed to load system cursor assets:", t), { success: !1, cursors: {}, error: String(t) };
    }
  }), d.handle("start-ffmpeg-recording", async (t, n) => {
    if (N)
      return { success: !1, message: "An FFmpeg recording is already active." };
    try {
      const o = Ze(), c = u.join(P, `recording-${Date.now()}.mp4`), p = await Ut(n, c);
      return Z = "", q = c, N = Ne(o, p, {
        cwd: P,
        stdio: ["pipe", "pipe", "pipe"]
      }), N.stdout.on("data", (f) => {
        Z += f.toString();
      }), N.stderr.on("data", (f) => {
        Z += f.toString();
      }), await Wt(N), te = !0, { success: !0 };
    } catch (o) {
      return console.error("Failed to start FFmpeg recording:", o), te = !1, N = null, q = null, {
        success: !1,
        message: "Failed to start FFmpeg recording",
        error: String(o)
      };
    }
  }), d.handle("stop-ffmpeg-recording", async () => {
    if (!te)
      return { success: !1, message: "No FFmpeg recording is active." };
    try {
      if (!N || !q)
        throw new Error("FFmpeg process is not running");
      const t = N, n = q;
      t.stdin.write(`q
`);
      const o = await Lt(t, n);
      return N = null, q = null, te = !1, await ce(o);
    } catch (t) {
      return console.error("Failed to stop FFmpeg recording:", t), N = null, q = null, te = !1, {
        success: !1,
        message: "Failed to stop FFmpeg recording",
        error: String(t)
      };
    }
  }), d.handle("store-recorded-video", async (t, n, o) => {
    try {
      const c = u.join(P, o);
      return await h.writeFile(c, Buffer.from(n)), await ce(c);
    } catch (c) {
      return console.error("Failed to store video:", c), {
        success: !1,
        message: "Failed to store video",
        error: String(c)
      };
    }
  }), d.handle("get-recorded-video-path", async () => {
    try {
      const n = (await h.readdir(P)).filter((p) => /\.(webm|mov|mp4)$/i.test(p));
      if (n.length === 0)
        return { success: !1, message: "No recorded video found" };
      const o = n.sort().reverse()[0];
      return { success: !0, path: u.join(P, o) };
    } catch (t) {
      return console.error("Failed to get video path:", t), { success: !1, message: "Failed to get video path", error: String(t) };
    }
  }), d.handle("set-recording-state", (t, n) => {
    n ? (We(), Le(), or(), Yt(), B = !0, k = [], E = [], ae = Date.now(), $ = null, Be(), le = setInterval(Be, er), sr()) : (B = !1, We(), Le(), Ie(), Qe(), tt(), k = []);
    const o = S || { name: "Screen" };
    M.getAllWindows().forEach((c) => {
      c.isDestroyed() || c.webContents.send("recording-state-changed", {
        recording: n,
        sourceName: o.name
      });
    }), s && s(n, o.name);
  }), d.handle("get-cursor-telemetry", async (t, n) => {
    const o = n ?? _;
    if (!o)
      return { success: !0, samples: [] };
    const c = `${o}.cursor.json`;
    try {
      const p = await h.readFile(c, "utf-8"), f = JSON.parse(p);
      return { success: !0, samples: (Array.isArray(f) ? f : Array.isArray(f == null ? void 0 : f.samples) ? f.samples : []).filter((y) => !!(y && typeof y == "object")).map((y) => {
        const l = y;
        return {
          timeMs: typeof l.timeMs == "number" && Number.isFinite(l.timeMs) ? Math.max(0, l.timeMs) : 0,
          cx: typeof l.cx == "number" && Number.isFinite(l.cx) ? G(l.cx, 0, 1) : 0.5,
          cy: typeof l.cy == "number" && Number.isFinite(l.cy) ? G(l.cy, 0, 1) : 0.5,
          interactionType: l.interactionType === "click" || l.interactionType === "double-click" || l.interactionType === "right-click" || l.interactionType === "middle-click" || l.interactionType === "move" || l.interactionType === "mouseup" ? l.interactionType : void 0,
          cursorType: l.cursorType === "arrow" || l.cursorType === "text" || l.cursorType === "pointer" || l.cursorType === "crosshair" || l.cursorType === "open-hand" || l.cursorType === "closed-hand" || l.cursorType === "resize-ew" || l.cursorType === "resize-ns" || l.cursorType === "not-allowed" ? l.cursorType : void 0
        };
      }).sort((y, l) => y.timeMs - l.timeMs) };
    } catch (p) {
      return p.code === "ENOENT" ? { success: !0, samples: [] } : (console.error("Failed to load cursor telemetry:", p), { success: !1, message: "Failed to load cursor telemetry", error: String(p), samples: [] });
    }
  }), d.handle("open-external-url", async (t, n) => {
    try {
      return await H.openExternal(n), { success: !0 };
    } catch (o) {
      return console.error("Failed to open URL:", o), { success: !1, error: String(o) };
    }
  }), d.handle("get-accessibility-permission-status", () => process.platform !== "darwin" ? { success: !0, trusted: !0, prompted: !1 } : {
    success: !0,
    trusted: ie.isTrustedAccessibilityClient(!1),
    prompted: !1
  }), d.handle("request-accessibility-permission", () => process.platform !== "darwin" ? { success: !0, trusted: !0, prompted: !1 } : {
    success: !0,
    trusted: ie.isTrustedAccessibilityClient(!0),
    prompted: !0
  }), d.handle("get-screen-recording-permission-status", () => {
    if (process.platform !== "darwin")
      return { success: !0, status: "granted" };
    try {
      return {
        success: !0,
        status: ie.getMediaAccessStatus("screen")
      };
    } catch (t) {
      return console.error("Failed to get screen recording permission status:", t), { success: !1, status: "unknown", error: String(t) };
    }
  }), d.handle("open-screen-recording-preferences", async () => {
    if (process.platform !== "darwin")
      return { success: !0 };
    try {
      return await H.openExternal(Ae("screen")), { success: !0 };
    } catch (t) {
      return console.error("Failed to open Screen Recording preferences:", t), { success: !1, error: String(t) };
    }
  }), d.handle("open-accessibility-preferences", async () => {
    if (process.platform !== "darwin")
      return { success: !0 };
    try {
      return await H.openExternal(Ae("accessibility")), { success: !0 };
    } catch (t) {
      return console.error("Failed to open Accessibility preferences:", t), { success: !1, error: String(t) };
    }
  }), d.handle("get-asset-base-path", () => {
    try {
      return v.isPackaged ? u.join(process.resourcesPath, "assets") : u.join(v.getAppPath(), "public");
    } catch (t) {
      return console.error("Failed to resolve asset base path:", t), null;
    }
  }), d.handle("read-local-file", async (t, n) => {
    try {
      return { success: !0, data: await h.readFile(n) };
    } catch (o) {
      return console.error("Failed to read local file:", o), { success: !1, error: String(o) };
    }
  }), d.handle("save-exported-video", async (t, n, o) => {
    try {
      const c = o.toLowerCase().endsWith(".gif"), p = c ? [{ name: "GIF Image", extensions: ["gif"] }] : [{ name: "MP4 Video", extensions: ["mp4"] }], f = await re.showSaveDialog({
        title: c ? "Save Exported GIF" : "Save Exported Video",
        defaultPath: u.join(v.getPath("downloads"), o),
        filters: p,
        properties: ["createDirectory", "showOverwriteConfirmation"]
      });
      return f.canceled || !f.filePath ? {
        success: !1,
        canceled: !0,
        message: "Export canceled"
      } : (await h.writeFile(f.filePath, Buffer.from(n)), {
        success: !0,
        path: f.filePath,
        message: "Video exported successfully"
      });
    } catch (c) {
      return console.error("Failed to save exported video:", c), {
        success: !1,
        message: "Failed to save exported video",
        error: String(c)
      };
    }
  }), d.handle("open-video-file-picker", async () => {
    try {
      const t = await re.showOpenDialog({
        title: "Select Video File",
        defaultPath: P,
        filters: [
          { name: "Video Files", extensions: ["webm", "mp4", "mov", "avi", "mkv"] },
          { name: "All Files", extensions: ["*"] }
        ],
        properties: ["openFile"]
      });
      return t.canceled || t.filePaths.length === 0 ? { success: !1, canceled: !0 } : (x = null, {
        success: !0,
        path: t.filePaths[0]
      });
    } catch (t) {
      return console.error("Failed to open file picker:", t), {
        success: !1,
        message: "Failed to open file picker",
        error: String(t)
      };
    }
  }), d.handle("reveal-in-folder", async (t, n) => {
    try {
      return H.showItemInFolder(n), { success: !0 };
    } catch (o) {
      console.error(`Error revealing item in folder: ${n}`, o);
      try {
        const c = await H.openPath(u.dirname(n));
        return c ? { success: !1, error: c } : { success: !0, message: "Could not reveal item, but opened directory." };
      } catch (c) {
        return console.error(`Error opening directory: ${u.dirname(n)}`, c), { success: !1, error: String(o) };
      }
    }
  }), d.handle("open-recordings-folder", async () => {
    try {
      await h.mkdir(P, { recursive: !0 });
      const t = await H.openPath(P);
      return t ? { success: !1, error: t, message: "Failed to open recordings folder." } : { success: !0 };
    } catch (t) {
      return console.error("Failed to open recordings folder:", t), { success: !1, error: String(t), message: "Failed to open recordings folder." };
    }
  }), d.handle("save-project-file", async (t, n, o, c) => {
    try {
      const p = Zt(c) ? c : null;
      if (p)
        return await h.writeFile(p, JSON.stringify(n, null, 2), "utf-8"), x = p, {
          success: !0,
          path: p,
          message: "Project saved successfully"
        };
      const f = (o || `project-${Date.now()}`).replace(/[^a-zA-Z0-9-_]/g, "_"), C = f.endsWith(`.${ne}`) ? f : `${f}.${ne}`, T = await re.showSaveDialog({
        title: "Save Recordly Project",
        defaultPath: u.join(P, C),
        filters: [
          { name: "Recordly Project", extensions: [ne] },
          { name: "JSON", extensions: ["json"] }
        ],
        properties: ["createDirectory", "showOverwriteConfirmation"]
      });
      return T.canceled || !T.filePath ? {
        success: !1,
        canceled: !0,
        message: "Save project canceled"
      } : (await h.writeFile(T.filePath, JSON.stringify(n, null, 2), "utf-8"), x = T.filePath, {
        success: !0,
        path: T.filePath,
        message: "Project saved successfully"
      });
    } catch (p) {
      return console.error("Failed to save project file:", p), {
        success: !1,
        message: "Failed to save project file",
        error: String(p)
      };
    }
  }), d.handle("load-project-file", async () => {
    try {
      const t = await re.showOpenDialog({
        title: "Open Recordly Project",
        defaultPath: P,
        filters: [
          { name: "Recordly Project", extensions: [ne, ...Xe] },
          { name: "JSON", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] }
        ],
        properties: ["openFile"]
      });
      if (t.canceled || t.filePaths.length === 0)
        return { success: !1, canceled: !0, message: "Open project canceled" };
      const n = t.filePaths[0], o = await h.readFile(n, "utf-8"), c = JSON.parse(o);
      return x = n, c && typeof c == "object" && typeof c.videoPath == "string" && (_ = c.videoPath), {
        success: !0,
        path: n,
        project: c
      };
    } catch (t) {
      return console.error("Failed to load project file:", t), {
        success: !1,
        message: "Failed to load project file",
        error: String(t)
      };
    }
  }), d.handle("load-current-project-file", async () => {
    try {
      if (!x)
        return { success: !1, message: "No active project" };
      const t = await h.readFile(x, "utf-8"), n = JSON.parse(t);
      return n && typeof n == "object" && typeof n.videoPath == "string" && (_ = n.videoPath), {
        success: !0,
        path: x,
        project: n
      };
    } catch (t) {
      return console.error("Failed to load current project file:", t), {
        success: !1,
        message: "Failed to load current project file",
        error: String(t)
      };
    }
  }), d.handle("set-current-video-path", (t, n) => (_ = n, x = null, { success: !0 })), d.handle("get-current-video-path", () => _ ? { success: !0, path: _ } : { success: !1 }), d.handle("clear-current-video-path", () => (_ = null, { success: !0 })), d.handle("get-platform", () => process.platform), d.handle("hide-cursor", () => ({ success: !0 })), d.handle("get-shortcuts", async () => {
    try {
      const t = await h.readFile(Re, "utf-8");
      return JSON.parse(t);
    } catch {
      return null;
    }
  }), d.handle("save-shortcuts", async (t, n) => {
    try {
      return await h.writeFile(Re, JSON.stringify(n, null, 2), "utf-8"), { success: !0 };
    } catch (o) {
      return console.error("Failed to save shortcuts:", o), { success: !1, error: String(o) };
    }
  });
}
const cr = u.dirname(He(import.meta.url));
process.platform === "darwin" && v.commandLine.appendSwitch("disable-features", "MacCatapLoopbackAudioForScreenShare");
const P = u.join(v.getPath("userData"), "recordings");
async function lr() {
  try {
    await h.mkdir(P, { recursive: !0 }), console.log("RECORDINGS_DIR:", P), console.log("User Data Path:", v.getPath("userData"));
  } catch (e) {
    console.error("Failed to create recordings directory:", e);
  }
}
process.env.APP_ROOT = u.join(cr, "..");
const ur = process.env.VITE_DEV_SERVER_URL, Cr = u.join(process.env.APP_ROOT, "dist-electron"), rt = u.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = ur ? u.join(process.env.APP_ROOT, "public") : rt;
let m = null, oe = null, X = null, nt = "", Ee = !1, W = !1;
const ot = st("app-icons/recordly-32.png"), dr = st("rec-button.png");
d.on("set-has-unsaved-changes", (e, r) => {
  Ee = r;
});
function _e() {
  m = ht();
}
function fr(e) {
  return e.webContents.getURL().includes("windowType=editor");
}
function Te(e) {
  let r = M.getFocusedWindow() ?? m;
  if (!r || r.isDestroyed() || !fr(r)) {
    if (at(), r = m, !r || r.isDestroyed()) return;
    r.webContents.once("did-finish-load", () => {
      !r || r.isDestroyed() || r.webContents.send(e);
    });
    return;
  }
  r.webContents.send(e);
}
function pr() {
  const e = process.platform === "darwin", r = [];
  e && r.push({
    label: v.name,
    submenu: [
      { role: "about" },
      { type: "separator" },
      { role: "services" },
      { type: "separator" },
      { role: "hide" },
      { role: "hideOthers" },
      { role: "unhide" },
      { type: "separator" },
      { role: "quit" }
    ]
  }), r.push(
    {
      label: "File",
      submenu: [
        {
          label: "Load Project…",
          accelerator: "CmdOrCtrl+O",
          click: () => Te("menu-load-project")
        },
        {
          label: "Save Project…",
          accelerator: "CmdOrCtrl+S",
          click: () => Te("menu-save-project")
        },
        {
          label: "Save Project As…",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => Te("menu-save-project-as")
        },
        ...e ? [] : [{ type: "separator" }, { role: "quit" }]
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: e ? [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" }
      ] : [
        { role: "minimize" },
        { role: "close" }
      ]
    }
  );
  const i = xe.buildFromTemplate(r);
  xe.setApplicationMenu(i);
}
function Ue() {
  X = new lt(ot);
}
function mr(e) {
  return u.join(process.env.VITE_PUBLIC || rt, e);
}
function it(e) {
  return ct.createFromPath(mr(e));
}
function st(e) {
  return it(e).resize({
    width: 24,
    height: 24,
    quality: "best"
  });
}
function hr() {
  if (process.platform !== "darwin" || !v.dock)
    return;
  const e = it("app-icons/recordly-512.png");
  e.isEmpty() || v.dock.setIcon(e);
}
function Ve(e = !1) {
  if (!X) return;
  const r = e ? dr : ot, i = e ? `Recording: ${nt}` : "Recordly", a = e ? [
    {
      label: "Stop Recording",
      click: () => {
        m && !m.isDestroyed() && m.webContents.send("stop-recording-from-tray");
      }
    }
  ] : [
    {
      label: "Open",
      click: () => {
        m && !m.isDestroyed() ? (m.isMinimized() && m.restore(), m.show(), m.focus(), m.moveTop()) : _e();
      }
    },
    {
      label: "Quit",
      click: () => {
        v.quit();
      }
    }
  ];
  X.setImage(r), X.setToolTip(i), X.setContextMenu(xe.buildFromTemplate(a));
}
function at() {
  m && (W = !0, m.close(), W = !1, m = null), m = wt(), Ee = !1, m.on("close", (e) => {
    if (W || !Ee)
      return;
    e.preventDefault();
    const r = re.showMessageBoxSync(m, {
      type: "warning",
      buttons: ["Save & Close", "Discard & Close", "Cancel"],
      defaultId: 0,
      cancelId: 2,
      title: "Unsaved Changes",
      message: "You have unsaved changes.",
      detail: "Do you want to save your project before closing?"
    });
    r === 0 ? (m.webContents.send("request-save-before-close"), d.once("save-before-close-done", () => {
      W = !0, m == null || m.close(), W = !1;
    })) : r === 1 && (W = !0, m == null || m.close(), W = !1);
  });
}
function wr() {
  return oe = yt(), oe.on("closed", () => {
    oe = null;
  }), oe;
}
v.on("window-all-closed", () => {
});
v.on("activate", () => {
  M.getAllWindows().length === 0 ? _e() : m && !m.isDestroyed() && (m.isMinimized() && m.restore(), m.show(), m.focus(), m.moveTop());
});
v.whenReady().then(async () => {
  Fe.defaultSession.setPermissionCheckHandler((e, r) => ["media", "audioCapture", "microphone"].includes(r)), Fe.defaultSession.setPermissionRequestHandler((e, r, i) => {
    i(["media", "audioCapture", "microphone"].includes(r));
  }), process.platform === "darwin" && ie.getMediaAccessStatus("microphone") !== "granted" && await ie.askForMediaAccess("microphone"), d.on("hud-overlay-close", () => {
    v.quit();
  }), hr(), Ue(), Ve(), pr(), await lr(), ar(
    at,
    wr,
    () => m,
    () => oe,
    (e, r) => {
      nt = r, X || Ue(), Ve(e), e || m && m.restore();
    }
  ), Fe.defaultSession.setDisplayMediaRequestHandler(async (e, r) => {
    try {
      const i = await ze.getSources({ types: ["screen", "window"] }), a = bt(), s = a ? i.find((t) => t.id === a) ?? i[0] : i[0];
      r(s ? {
        video: { id: s.id, name: s.name }
      } : {});
    } catch (i) {
      console.error("setDisplayMediaRequestHandler error:", i), r({});
    }
  }), _e();
});
export {
  Cr as MAIN_DIST,
  P as RECORDINGS_DIR,
  rt as RENDERER_DIST,
  ur as VITE_DEV_SERVER_URL
};
