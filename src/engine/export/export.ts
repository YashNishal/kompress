import { downloadZip } from "client-zip";
import type { QueueItem } from "../types";
import { outputs } from "../storage/outputs";

export interface ExportEntry {
  name: string;
  blob: Blob;
  lastModified: Date;
}

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
    out.push({ name, blob, lastModified: new Date() });
  }
  return out;
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

/** Streams a ZIP. Uses a native save dialog when available so nothing is buffered in memory. */
export async function downloadAsZip(entries: ExportEntry[], zipName = "kompress.zip") {
  const res = downloadZip(entries.map((e) => ({ name: e.name, input: e.blob, lastModified: e.lastModified })));
  const w = window as Window & { showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle> };
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: zipName,
        types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }],
      });
      await res.body!.pipeTo(await handle.createWritable());
      return;
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      // fall through to a regular download
    }
  }
  trigger(await res.blob(), zipName);
}

export const canSaveToFolder = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

export async function saveToFolder(entries: ExportEntry[]) {
  const w = window as Window & { showDirectoryPicker?: (o: unknown) => Promise<FileSystemDirectoryHandle> };
  let root: FileSystemDirectoryHandle;
  try {
    root = await w.showDirectoryPicker!({ mode: "readwrite" });
  } catch (err) {
    if ((err as DOMException)?.name === "AbortError") return 0;
    throw err;
  }
  let n = 0;
  for (const e of entries) {
    const parts = e.name.split("/");
    let dir = root;
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create: true });
    const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true });
    const ws = await fh.createWritable();
    await ws.write(e.blob);
    await ws.close();
    n++;
  }
  return n;
}
