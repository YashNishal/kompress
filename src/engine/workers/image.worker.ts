/// <reference lib="webworker" />
import * as Comlink from "comlink";
import { bitmapToImageData, decodeImage, downscale, getEncoder, resizeImage } from "../codecs/image";
import { withPlainErrors } from "./plain-errors";
import { ssim } from "../metrics/ssim";
import { IMAGE_FORMATS, targetSize } from "../settings";
import type { ImageSettings } from "../types";

export interface ImageProbeResult {
  width: number;
  height: number;
  thumb: Blob;
}

export interface ImageEncodeResult {
  blob: Blob;
  /** PNG stand-in when the browser can't display the output format (e.g. JXL in Chrome). */
  display?: Blob;
  width: number;
  height: number;
  ssim?: number;
  ms: number;
  keptOriginal: boolean;
}

const THUMB_EDGE = 160;
const METRIC_EDGE = 768;

const api = {
  async probe(file: Blob): Promise<ImageProbeResult> {
    // Fast path: let the browser decode straight to thumbnail size.
    try {
      const full = await createImageBitmap(file, { imageOrientation: "from-image" });
      const { width, height } = full;
      const s = Math.min(1, THUMB_EDGE / Math.max(width, height));
      const c = new OffscreenCanvas(Math.max(1, Math.round(width * s)), Math.max(1, Math.round(height * s)));
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(full, 0, 0, c.width, c.height);
      full.close();
      return { width, height, thumb: await c.convertToBlob({ type: "image/webp", quality: 0.8 }) };
    } catch {
      const data = await decodeImage(file);
      const small = downscale(data, THUMB_EDGE);
      return { width: data.width, height: data.height, thumb: await toBlob(small, "image/webp") };
    }
  },

  async encode(
    file: Blob,
    settings: ImageSettings,
    opts: { keepIfLarger: boolean; measure: boolean },
  ): Promise<ImageEncodeResult> {
    const t0 = performance.now();
    const source = await decodeImage(file);
    const dims = targetSize(source.width, source.height, settings.resize);
    const resized = await resizeImage(source, dims.width, dims.height);
    const buf = await getEncoder(settings.format).encode(resized, settings);
    const meta = IMAGE_FORMATS[settings.format];
    let blob = new Blob([buf], { type: meta.mime });
    let keptOriginal = false;

    const sameSize = dims.width === source.width && dims.height === source.height;
    if (opts.keepIfLarger && sameSize && blob.size >= file.size) {
      blob = file;
      keptOriginal = true;
    }

    let decoded: ImageData | undefined;
    let display: Blob | undefined;
    try {
      const bmp = await createImageBitmap(blob);
      if (opts.measure) decoded = bitmapToImageData(bmp);
      bmp.close();
    } catch {
      // Browser can't show this format; decode via WASM and hand back a PNG to display.
      decoded = await decodeImage(blob);
      display = await toBlob(decoded, "image/png");
    }

    let score: number | undefined;
    if (opts.measure && decoded && !keptOriginal) {
      score = ssim(downscale(resized, METRIC_EDGE), downscale(decoded, METRIC_EDGE));
    }
    if (keptOriginal) score = 1;

    return { blob, display, width: dims.width, height: dims.height, ssim: score, ms: performance.now() - t0, keptOriginal };
  },
};

async function toBlob(data: ImageData, type: string) {
  const c = new OffscreenCanvas(data.width, data.height);
  c.getContext("2d")!.putImageData(data, 0, 0);
  return c.convertToBlob({ type, quality: 0.85 });
}

export type ImageWorkerApi = typeof api;
Comlink.expose(withPlainErrors(api));
