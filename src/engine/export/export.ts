import { downloadZip, predictLength } from "client-zip";
import type { QueueItem } from "../types";
import { manifestBlob, placeholderFor, type ManifestEntry } from "../placeholder";
import { outputs } from "../storage/outputs";

export interface ExportEntry {
  name: string;
  blob: Blob;
  lastModified: Date;
  /** The queue item this file came from; absent for generated files like the manifest. */
  item?: QueueItem;
}

/** Bytes written so far and the expected total. */
export type ExportProgress = (done: number, total: number) => void;

/**
 * Output filenames keep the source's folder path and base name, swap the
 * extension, and de-duplicate collisions ("photo.webp", "photo (2).webp").
 */
export function exportEntries(items: QueueItem[]): ExportEntry[] {
  const used = new Set<string>();
  const out: ExportEntry[] = [];
  for (const it of items) {
    if (it.status !== "done" || !it.output) continue;
    const blob = outputs.get(it.output.key);
    if (!blob) continue;
    const slash = it.path.lastIndexOf("/");
    const dir = slash >= 0 ? it.path.slice(0, slash + 1) : "";
    const file = slash >= 0 ? it.path.slice(slash + 1) : it.path;
    const dot = file.lastIndexOf(".");
    const base = dot > 0 ? file.slice(0, dot) : file;
    let name = `${dir}${base}.${it.output.ext}`;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${dir}${base} (${n}).${it.output.ext}`;
    used.add(name.toLowerCase());
    out.push({ name, blob, lastModified: new Date(), item: it });
  }
  return out;
}

export const MANIFEST_NAME = "placeholders.json";

/**
 * `placeholders.json` for a set of exported files, keyed by their path inside the export.
 * Files without a thumbnail (a video the browser couldn't seek) are left out.
 */
export async function placeholderManifest(entries: ExportEntry[]): Promise<ExportEntry | null> {
  const rows = await Promise.all(
    entries.map(async (e): Promise<[string, ManifestEntry] | null> => {
      const it = e.item;
      if (!it?.thumbUrl || !it.output) return null;
      try {
        const p = await placeholderFor(it.thumbUrl);
        return [e.name, { width: it.output.width, height: it.output.height, ...p }];
      } catch {
        return null;
      }
    }),
  );
  const found = rows.filter((r) => r !== null);
  if (!found.length) return null;
  return { name: MANIFEST_NAME, blob: manifestBlob(Object.fromEntries(found)), lastModified: new Date() };
}

function trigger(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function downloadOne(entry: ExportEntry) {
  trigger(entry.blob, entry.name.split("/").pop()!);
}

/** Reports bytes as they flow through, so a stream we can't otherwise observe gets a progress bar. */
function counted(body: ReadableStream<Uint8Array>, total: number, onProgress?: ExportProgress) {
  let done = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctrl) {
        done += chunk.byteLength;
        onProgress?.(done, total);
        ctrl.enqueue(chunk);
      },
    }),
  );
}

/**
 * Streams a ZIP. Uses a native save dialog when available so nothing is buffered in memory.
 * Resolves false when the user cancels the dialog.
 */
export async function downloadAsZip(entries: ExportEntry[], onProgress?: ExportProgress, zipName = "kompress.zip") {
  const files = entries.map((e) => ({ name: e.name, input: e.blob, lastModified: e.lastModified, size: e.blob.size }));
  const total = Number(predictLength(files));
  const zip = () => counted(downloadZip(files, { length: total }).body!, total, onProgress);
  const w = window as Window & { showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle> };
  if (w.showSaveFilePicker) {
    let handle: FileSystemFileHandle | undefined;
    try {
      handle = await w.showSaveFilePicker({
        suggestedName: zipName,
        types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }],
      });
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return false;
      // fall through to a regular download
    }
    if (handle) {
      await zip().pipeTo(await handle.createWritable());
      return true;
    }
  }
  trigger(await new Response(zip()).blob(), zipName);
  return true;
}

export const canSaveToFolder = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

export async function saveToFolder(entries: ExportEntry[], onProgress?: ExportProgress) {
  const w = window as Window & { showDirectoryPicker?: (o: unknown) => Promise<FileSystemDirectoryHandle> };
  let root: FileSystemDirectoryHandle;
  try {
    root = await w.showDirectoryPicker!({ mode: "readwrite" });
  } catch (err) {
    if ((err as DOMException)?.name === "AbortError") return 0;
    throw err;
  }
  const total = entries.reduce((sum, e) => sum + e.blob.size, 0);
  let n = 0;
  let written = 0;
  onProgress?.(0, total);
  for (const e of entries) {
    const parts = e.name.split("/");
    let dir = root;
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true });
    const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true });
    const ws = await fh.createWritable();
    const before = written;
    await counted(e.blob.stream(), total, (d) => onProgress?.(before + d, total)).pipeTo(ws);
    written += e.blob.size;
    n++;
  }
  return n;
}
