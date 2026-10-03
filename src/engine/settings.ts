import type {
  GlobalSettings,
  ImageFormat,
  ImageSettings,
  Overrides,
  QueueItem,
  VideoCodec,
  VideoSettings,
} from "./types";

export const DEFAULT_SETTINGS: GlobalSettings = {
  image: {
    format: "avif",
    quality: 72,
    lossless: false,
    resize: { mode: "none", value: 2000 },
    stripMetadata: true,
  },
  video: {
    codec: "avc",
    mode: "quality",
    quality: 60,
    targetMB: 25,
    resolution: 1080,
    fps: 30,
    audio: "aac",
    audioKbps: 128,
    trim: { start: 0, end: null },
  },
  keepIfLarger: true,
};

export const IMAGE_FORMATS: Record<
  ImageFormat,
  { label: string; ext: string; mime: string; lossless: boolean; lossy: boolean }
> = {
  jpeg: { label: "JPG", ext: "jpg", mime: "image/jpeg", lossless: false, lossy: true },
  webp: { label: "WEBP", ext: "webp", mime: "image/webp", lossless: true, lossy: true },
  avif: { label: "AVIF", ext: "avif", mime: "image/avif", lossless: true, lossy: true },
  jxl: { label: "JXL", ext: "jxl", mime: "image/jxl", lossless: true, lossy: true },
  png: { label: "PNG", ext: "png", mime: "image/png", lossless: true, lossy: false },
};

export const VIDEO_CODECS: Record<
  VideoCodec,
  { label: string; container: "mp4" | "webm"; ext: string; mime: string }
> = {
  avc: { label: "H.264", container: "mp4", ext: "mp4", mime: "video/mp4" },
  vp9: { label: "VP9", container: "webm", ext: "webm", mime: "video/webm" },
  av1: { label: "AV1", container: "mp4", ext: "mp4", mime: "video/mp4" },
};

export function resolveImage(global: GlobalSettings, overrides: Overrides): ImageSettings {
  const o = overrides.image ?? {};
  return {
    ...global.image,
    ...o,
    resize: { ...global.image.resize, ...(o.resize ?? {}) },
  };
}

export function resolveVideo(global: GlobalSettings, overrides: Overrides): VideoSettings {
  const o = overrides.video ?? {};
  return {
    ...global.video,
    ...o,
    trim: { ...global.video.trim, ...(o.trim ?? {}) },
  };
}

export function resolveFor(item: Pick<QueueItem, "kind" | "overrides">, global: GlobalSettings) {
  return item.kind === "image"
    ? { kind: "image" as const, settings: resolveImage(global, item.overrides) }
    : { kind: "video" as const, settings: resolveVideo(global, item.overrides) };
}

export function hasOverrides(item: Pick<QueueItem, "kind" | "overrides">) {
  const o = item.kind === "image" ? item.overrides.image : item.overrides.video;
  return !!o && Object.keys(o).length > 0;
}

/** Stable, order-independent JSON used to key outputs and detect staleness. */
export function settingsHash(value: unknown, keepIfLarger: boolean): string {
  const stable = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(stable);
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, stable((v as Record<string, unknown>)[k])]),
    );
  };
  const s = JSON.stringify([stable(value), keepIfLarger]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function itemHash(item: Pick<QueueItem, "kind" | "overrides">, global: GlobalSettings) {
  return settingsHash(resolveFor(item, global).settings, global.keepIfLarger);
}

/** Target dimensions for an image resize. Never upscales. */
export function targetSize(
  width: number,
  height: number,
  resize: ImageSettings["resize"],
): { width: number; height: number } {
  const { mode, value } = resize;
  let scale = 1;
  if (mode === "longest") scale = value / Math.max(width, height);
  else if (mode === "width") scale = value / width;
  else if (mode === "height") scale = value / height;
  else if (mode === "percent") scale = value / 100;
  scale = Math.min(1, Math.max(scale, 0.01));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Output dimensions for a video, keeping even numbers (required by most encoders). */
export function videoTargetSize(width: number, height: number, res: VideoSettings["resolution"]) {
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  if (res === "source") return { width: even(width), height: even(height) };
  const short = Math.min(width, height);
  const scale = Math.min(1, res / short);
  return { width: even(width * scale), height: even(height * scale) };
}

/**
 * Video bitrate in bits/s.
 * Quality mode maps 0–100 to bits-per-pixel-per-frame on a log scale; target
 * mode divides the byte budget by duration, leaving 3% for container overhead.
 */
export function videoBitrate(
  s: VideoSettings,
  out: { width: number; height: number; fps: number; duration: number },
): { video: number; audio: number; reachable: boolean; minBytes: number } {
  const audio = s.audio === "none" ? 0 : s.audioKbps * 1000;
  const pixelsPerSec = out.width * out.height * out.fps;
  const floorBps = Math.max(150_000, pixelsPerSec * 0.02);
  if (s.mode === "quality") {
    const bpp = 0.03 * Math.pow(10, (s.quality / 100) * 1.1);
    return { video: Math.round(pixelsPerSec * bpp), audio, reachable: true, minBytes: 0 };
  }
  const budgetBits = s.targetMB * 1_000_000 * 8 * 0.97;
  const video = budgetBits / out.duration - audio;
  const minBytes = ((floorBps + audio) * out.duration) / 8 / 0.97;
  return { video: Math.max(Math.round(video), floorBps), audio, reachable: video >= floorBps, minBytes };
}

export function outputFps(s: VideoSettings, sourceFps: number) {
  if (s.fps === "source") return sourceFps;
  return Math.min(s.fps, sourceFps || s.fps);
}
