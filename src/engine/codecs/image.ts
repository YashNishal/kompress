/**
 * Image codec adapters. Worker-side only: every function here may load WASM.
 * Each codec module is imported lazily on first use so a user who only ever
 * exports WebP never downloads the AVIF encoder.
 */
import { EngineError } from "../errors";
import type { ImageFormat, ImageSettings } from "../types";

export interface ImageEncoder {
  id: ImageFormat;
  encode(data: ImageData, s: ImageSettings): Promise<ArrayBuffer>;
}

const encoders: Record<ImageFormat, ImageEncoder> = {
  jpeg: {
    id: "jpeg",
    async encode(data, s) {
      const { default: encode } = await import("@jsquash/jpeg/encode");
      return encode(flattenAlpha(data), { quality: s.quality, progressive: true, optimize_coding: true });
    },
  },
  webp: {
    id: "webp",
    async encode(data, s) {
      const { default: encode } = await import("@jsquash/webp/encode");
      return encode(data, s.lossless ? { lossless: 1, quality: 100, method: 4 } : { quality: s.quality, method: 4 });
    },
  },
  avif: {
    id: "avif",
    async encode(data, s) {
      const { default: encode } = await import("@jsquash/avif/encode");
      // speed 6 is noticeably faster than 4 at ~1–2% size cost.
      return encode(data, s.lossless ? { lossless: true, speed: 6 } : { quality: s.quality, speed: 6 });
    },
  },
  jxl: {
    id: "jxl",
    async encode(data, s) {
      const { default: encode } = await import("@jsquash/jxl/encode");
      return encode(data, s.lossless ? { lossless: true, effort: 7 } : { quality: s.quality, effort: 7 });
    },
  },
  png: {
    id: "png",
    async encode(data) {
      const { default: optimise } = await import("@jsquash/oxipng/optimise");
      return optimise(data, { level: 2, interlace: false, optimiseAlpha: true });
    },
  },
};

export function getEncoder(format: ImageFormat): ImageEncoder {
  const enc = encoders[format];
  if (!enc) throw new EngineError("ENCODER_UNAVAILABLE", `No encoder for ${format}`);
  return enc;
}

/** Decode any browser-decodable image (plus JXL via WASM) to RGBA pixels, orientation applied. */
export async function decodeImage(blob: Blob): Promise<ImageData> {
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
    try {
      return bitmapToImageData(bmp);
    } finally {
      bmp.close();
    }
  } catch (err) {
    const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    if (isJxl(head)) {
      const { default: decode } = await import("@jsquash/jxl/decode");
      return decode(await blob.arrayBuffer());
    }
    if (isHeic(head))
      throw new EngineError("UNSUPPORTED_INPUT", "HEIC isn't decodable in this browser yet", "remove");
    if (err instanceof RangeError) throw err;
    throw new EngineError("DECODE_FAILED", "This file looks damaged or isn't an image we can read", "remove");
  }
}

export function bitmapToImageData(bmp: ImageBitmap): ImageData {
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new EngineError("OUT_OF_MEMORY", "Couldn't allocate a canvas", "retry-smaller");
  ctx.drawImage(bmp, 0, 0);
  return ctx.getImageData(0, 0, bmp.width, bmp.height);
}

export async function resizeImage(data: ImageData, width: number, height: number): Promise<ImageData> {
  if (data.width === width && data.height === height) return data;
  const { default: resize } = await import("@jsquash/resize");
  return resize(data, { width, height, method: "lanczos3", premultiply: true, linearRGB: true });
}

/** Scale down with the browser's (fast) resampler, used for metrics and display. */
export function downscale(data: ImageData, maxEdge: number): ImageData {
  const scale = Math.min(1, maxEdge / Math.max(data.width, data.height));
  if (scale === 1) return data;
  const w = Math.max(1, Math.round(data.width * scale));
  const h = Math.max(1, Math.round(data.height * scale));
  const src = new OffscreenCanvas(data.width, data.height);
  src.getContext("2d")!.putImageData(data, 0, 0);
  const dst = new OffscreenCanvas(w, h);
  const ctx = dst.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export function hasAlpha(data: ImageData) {
  const d = data.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) return true;
  return false;
}

/** JPEG has no alpha: composite onto white, like every image viewer does. */
function flattenAlpha(data: ImageData): ImageData {
  if (!hasAlpha(data)) return data;
  const out = new ImageData(data.width, data.height);
  const s = data.data, d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    const a = s[i + 3] / 255;
    d[i] = s[i] * a + 255 * (1 - a);
    d[i + 1] = s[i + 1] * a + 255 * (1 - a);
    d[i + 2] = s[i + 2] * a + 255 * (1 - a);
    d[i + 3] = 255;
  }
  return out;
}

function isJxl(h: Uint8Array) {
  return (h[0] === 0xff && h[1] === 0x0a) || (h[4] === 0x4a && h[5] === 0x58 && h[6] === 0x4c && h[7] === 0x20);
}

function isHeic(h: Uint8Array) {
  const brand = String.fromCharCode(h[8], h[9], h[10], h[11]);
  return String.fromCharCode(h[4], h[5], h[6], h[7]) === "ftyp" && /^(heic|heix|hevc|mif1|msf1|heim|heis)$/.test(brand);
}
