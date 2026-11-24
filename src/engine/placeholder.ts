/**
 * Loading placeholders, made from the thumbnail each item already has:
 *
 * - `base64`: a tiny image as a data URL, ready for next/image's `blurDataURL`
 *   or a blurred CSS background (what plaiceholder produces).
 * - `thumbhash`: ~25 bytes, base64. Decode with thumbhash's `thumbHashToDataURL`.
 * - `color`: the average colour as hex, for a flat background.
 *
 * The thumbnail is at most 160px, so this is a few milliseconds on the main thread.
 */
import { rgbaToThumbHash, thumbHashToAverageRGBA, thumbHashToDataURL } from "thumbhash";

export interface Placeholder {
  base64: string;
  thumbhash: string;
  color: string;
}

export type PlaceholderKind = keyof Placeholder;

/** Long edge of the base64 image. Browsers smooth it when scaled up, so it reads as a blur. */
const BASE64_EDGE = 16;
/** ThumbHash accepts at most 100×100. */
const HASH_EDGE = 100;

const cache = new Map<string, Promise<Placeholder>>();

/** Placeholder for a thumbnail URL, computed once per URL. */
export function placeholderFor(thumbUrl: string): Promise<Placeholder> {
  let p = cache.get(thumbUrl);
  if (!p) {
    p = build(thumbUrl);
    p.catch(() => cache.delete(thumbUrl));
    cache.set(thumbUrl, p);
  }
  return p;
}

export function forgetPlaceholder(thumbUrl: string) {
  cache.delete(thumbUrl);
}

/** Renders a ThumbHash string back to a PNG data URL, for previews. */
export function thumbhashPreview(hash: string) {
  return thumbHashToDataURL(fromBase64(hash));
}

async function build(thumbUrl: string): Promise<Placeholder> {
  const bmp = await createImageBitmap(await (await fetch(thumbUrl)).blob());
  try {
    const hashPixels = draw(bmp, HASH_EDGE);
    const hash = rgbaToThumbHash(hashPixels.width, hashPixels.height, hashPixels.data);
    const { r, g, b } = thumbHashToAverageRGBA(hash);
    return {
      base64: await tinyDataUrl(bmp, isOpaque(hashPixels)),
      thumbhash: toBase64(hash),
      color: `#${[r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`,
    };
  } finally {
    bmp.close();
  }
}

function fit(bmp: ImageBitmap, edge: number) {
  const s = Math.min(1, edge / Math.max(bmp.width, bmp.height));
  return { w: Math.max(1, Math.round(bmp.width * s)), h: Math.max(1, Math.round(bmp.height * s)) };
}

function draw(bmp: ImageBitmap, edge: number): ImageData {
  const { w, h } = fit(bmp, edge);
  const ctx = new OffscreenCanvas(w, h).getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function isOpaque(data: ImageData) {
  for (let i = 3; i < data.data.length; i += 4) if (data.data[i] !== 255) return false;
  return true;
}

async function tinyDataUrl(bmp: ImageBitmap, opaque: boolean) {
  const { w, h } = fit(bmp, BASE64_EDGE);
  const c = new OffscreenCanvas(w, h);
  // An opaque canvas encodes as RGB PNG rather than RGBA, a little smaller.
  const ctx = c.getContext("2d", { alpha: !opaque })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  // PNG, not WebP: at this size browsers wrap WebP in a ~400 byte VP8X/ICC container, and Safari can't encode it.
  const blob = await c.convertToBlob({ type: "image/png" });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:${blob.type};base64,${toBase64(bytes)}`;
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export interface ManifestEntry extends Placeholder {
  width: number;
  height: number;
}

/** `placeholders.json` content: output path → dimensions and placeholders. */
export function manifestBlob(entries: Record<string, ManifestEntry>) {
  return new Blob([JSON.stringify(entries, null, 2) + "\n"], { type: "application/json" });
}
