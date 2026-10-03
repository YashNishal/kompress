"use client";

import { toItemError } from "@/engine/errors";
import { ImageScheduler, type Lane, type Ticket } from "@/engine/scheduler";
import { IMAGE_FORMATS, itemHash, resolveImage } from "@/engine/settings";
import { outputs } from "@/engine/storage/outputs";
import type { ImageSettings, MediaKind, QueueItem } from "@/engine/types";
import type { ImageEncodeResult } from "@/engine/workers/image.worker";
import { extOf } from "@/lib/format";
import { useWorkspace } from "./workspace";
import { videoEngine } from "./video-processor";

/**
 * Glue between the store and the engine. Owns the scheduler, object URLs for
 * originals and thumbnails, and the "is this result still wanted?" checks.
 */

let scheduler: ImageScheduler | null = null;
const pool = () => (scheduler ??= new ImageScheduler());

const tickets = new Map<string, Ticket<unknown>>();
/** Settings hash of the image encode currently queued or running per item. */
const pending = new Map<string, string>();
const sourceUrls = new Map<string, string>();

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "avif", "jxl", "gif", "bmp", "tif", "tiff", "heic", "heif", "ico"]);
const VIDEO_EXT = new Set(["mp4", "m4v", "mov", "webm", "mkv", "avi", "3gp", "ogv"]);

export function kindOf(file: File): MediaKind | null {
  const ext = extOf(file.name);
  if (file.type.startsWith("image/") && file.type !== "image/svg+xml") return "image";
  if (file.type.startsWith("video/")) return "video";
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  return null;
}

export interface Incoming {
  file: File;
  path?: string;
}

/** Adds files to the queue; returns how many were skipped as unsupported. */
export function ingest(incoming: Incoming[]): { added: number; skipped: string[] } {
  const skipped: string[] = [];
  const items: QueueItem[] = [];
  for (const { file, path } of incoming) {
    const kind = kindOf(file);
    if (!kind) {
      skipped.push(file.name);
      continue;
    }
    items.push({
      id: crypto.randomUUID().slice(0, 12),
      file,
      kind,
      path: path ?? file.name,
      addedAt: Date.now(),
      overrides: {},
      status: "probing",
      progress: 0,
    });
  }
  if (items.length) {
    useWorkspace.getState().add(items);
    for (const it of items) void probeAndEncode(it.id);
  }
  return { added: items.length, skipped };
}

async function probeAndEncode(id: string) {
  const it = useWorkspace.getState().items[id];
  if (!it) return;
  try {
    if (it.kind === "image") {
      const ticket = pool().submit("probe", (api) => api.probe(it.file), `probe:${id}`);
      tickets.set(id, ticket);
      const p = await ticket.promise;
      if (!useWorkspace.getState().items[id]) return;
      useWorkspace.getState().patch(id, {
        probe: { width: p.width, height: p.height, mime: it.file.type || `image/${extOf(it.file.name)}`, label: label(it.file) },
        thumbUrl: URL.createObjectURL(p.thumb),
        status: "queued",
      });
    } else {
      const p = await videoEngine.probe(it.file);
      if (!useWorkspace.getState().items[id]) return;
      useWorkspace.getState().patch(id, {
        probe: { ...p.probe, label: label(it.file) },
        thumbUrl: p.thumb ? URL.createObjectURL(p.thumb) : undefined,
        status: "queued",
      });
    }
    encode(id, "batch");
  } catch (err) {
    fail(id, err);
  }
}

/** (Re)encode one item if its output is missing or stale. */
export function encode(id: string, lane: Lane = "batch") {
  const s = useWorkspace.getState();
  const it = s.items[id];
  if (!it || !it.probe) return;
  const hash = itemHash(it, s.global);
  if (it.output?.hash === hash && it.status === "done") return;
  if (it.kind === "video") return encodeVideo(id, hash);

  if (pending.get(id) === hash) return; // the same encode is already queued or running

  const settings = resolveImage(s.global, it.overrides);
  const keepIfLarger = s.global.keepIfLarger;
  // Settings moved on: the in-flight job is stale, so stop it rather than let it finish.
  tickets.get(id)?.cancel();
  pending.set(id, hash);
  s.patch(id, { status: "queued", progress: 0, error: undefined });

  const ticket = pool().submit<ImageEncodeResult>(
    lane,
    (api) => {
      useWorkspace.getState().patch(id, { status: "encoding", progress: 0.5 });
      return api.encode(it.file, settings, { keepIfLarger, measure: true });
    },
    `enc:${id}`,
  );
  tickets.set(id, ticket as Ticket<unknown>);
  const settle = () => {
    if (pending.get(id) === hash) pending.delete(id);
    if (tickets.get(id) === ticket) tickets.delete(id);
  };
  ticket.promise.then(
    (r) => {
      settle();
      land(id, hash, settings, r);
    },
    (err) => {
      settle();
      fail(id, err, hash);
    },
  );
}

function land(id: string, hash: string, settings: ImageSettings, r: ImageEncodeResult) {
  const s = useWorkspace.getState();
  const it = s.items[id];
  if (!it) return;
  if (itemHash(it, s.global) !== hash) return; // settings moved on; a newer job is queued
  const prev = it.output?.key;
  const key = `${id}-${hash}`;
  outputs.put(key, r.blob, r.display);
  if (prev && prev !== key) outputs.delete(prev);
  const fmt = IMAGE_FORMATS[settings.format];
  const ext = r.keptOriginal ? extOf(it.file.name) : fmt.ext;
  s.patch(id, {
    status: "done",
    progress: 1,
    output: {
      key,
      size: r.blob.size,
      format: r.keptOriginal ? label(it.file) : fmt.label,
      ext,
      mime: r.blob.type,
      width: r.width,
      height: r.height,
      ssim: r.ssim,
      ms: r.ms,
      keptOriginal: r.keptOriginal,
      hash,
    },
  });
}

function encodeVideo(id: string, hash: string) {
  const s = useWorkspace.getState();
  s.patch(id, { status: "queued", progress: 0, error: undefined });
  videoEngine.enqueue(id, hash);
}

export function fail(id: string, err: unknown, hash?: string) {
  const s = useWorkspace.getState();
  const it = s.items[id];
  if (!it) return;
  const e = toItemError(err);
  if (e.code === "CANCELLED") return;
  if (hash && itemHash(it, s.global) !== hash) return;
  if (e.code === "OUT_OF_MEMORY") scheduler?.degrade(2);
  s.patch(id, { status: "failed", error: e, progress: 0 });
}

/** Re-run every item of a kind against the current settings. */
export function encodeAll(kind?: MediaKind) {
  const s = useWorkspace.getState();
  for (const id of s.order) {
    const it = s.items[id];
    if (it.status === "probing") continue;
    if (!kind || it.kind === kind) encode(id, "batch");
  }
}

export function retry(id: string) {
  const it = useWorkspace.getState().items[id];
  if (!it) return;
  if (!it.probe) void probeAndEncode(id);
  else encode(id, "interactive");
}

export function removeItems(ids: string[]) {
  const s = useWorkspace.getState();
  for (const id of ids) {
    const it = s.items[id];
    if (!it) continue;
    tickets.get(id)?.cancel();
    tickets.delete(id);
    pending.delete(id);
    videoEngine.cancel(id);
    if (it.output) outputs.delete(it.output.key);
    if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
    const src = sourceUrls.get(id);
    if (src) URL.revokeObjectURL(src);
    sourceUrls.delete(id);
  }
  s.remove(ids);
}

export function clearAll() {
  removeItems(useWorkspace.getState().order);
  outputs.clear();
}

/** Object URL for the original file (lazily created, cached per item). */
export function sourceUrl(id: string): string | undefined {
  const it = useWorkspace.getState().items[id];
  if (!it) return undefined;
  let url = sourceUrls.get(id);
  if (!url) {
    url = URL.createObjectURL(it.file);
    sourceUrls.set(id, url);
  }
  return url;
}

/**
 * One-off encode for Compare's left side when it is set to an encode rather
 * than the original. Latest call per slot wins.
 */
export function previewEncode(id: string, slot: string, settings: ImageSettings) {
  const s = useWorkspace.getState();
  const it = s.items[id];
  if (!it) return null;
  return pool().submit<ImageEncodeResult>(
    "preview",
    (api) => api.encode(it.file, settings, { keepIfLarger: false, measure: true }),
    `preview:${slot}`,
  );
}

export function poolStats() {
  return scheduler?.stats ?? { workers: 0, running: 0, queued: 0 };
}

function label(file: File) {
  const ext = extOf(file.name);
  return (ext === "jpeg" ? "JPG" : ext || file.type.split("/")[1] || "?").toUpperCase();
}
