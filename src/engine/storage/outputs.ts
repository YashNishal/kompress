/**
 * Holds encoded outputs outside React state. The store keeps only keys; this
 * module owns the Blobs and their object URLs so they can be revoked
 * deterministically. Outputs are mirrored to OPFS when available so a refresh
 * doesn't lose finished work (see session.ts).
 */
interface Entry {
  blob: Blob;
  display?: Blob;
  url?: string;
  displayUrl?: string;
}

const entries = new Map<string, Entry>();

export const outputs = {
  put(key: string, blob: Blob, display?: Blob) {
    outputs.delete(key);
    entries.set(key, { blob, display });
    void persist(key, blob);
  },
  /** Register a Blob that a worker already wrote to OPFS under `key`. */
  adopt(key: string, blob: Blob) {
    outputs.delete(key, { keepPersisted: true });
    entries.set(key, { blob });
  },
  get(key: string): Blob | undefined {
    return entries.get(key)?.blob;
  },
  has(key: string) {
    return entries.has(key);
  },
  /** URL suitable for <img src>, using the PNG stand-in when the browser can't show the real format. */
  displayUrl(key: string): string | undefined {
    const e = entries.get(key);
    if (!e) return undefined;
    if (e.display) return (e.displayUrl ??= URL.createObjectURL(e.display));
    return (e.url ??= URL.createObjectURL(e.blob));
  },
  delete(key: string, opts: { keepPersisted?: boolean } = {}) {
    const e = entries.get(key);
    if (!e) return;
    if (e.url) URL.revokeObjectURL(e.url);
    if (e.displayUrl) URL.revokeObjectURL(e.displayUrl);
    entries.delete(key);
    if (!opts.keepPersisted) void unpersist(key);
  },
  clear() {
    for (const k of [...entries.keys()]) outputs.delete(k);
  },
  /** Rehydrate from OPFS after a reload. */
  restore(key: string, blob: Blob) {
    entries.set(key, { blob });
  },
};

async function dir() {
  if (typeof navigator === "undefined" || !navigator.storage?.getDirectory) return null;
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle("outputs", { create: true });
  } catch {
    return null;
  }
}

async function persist(key: string, blob: Blob) {
  const d = await dir();
  if (!d) return;
  try {
    const fh = await d.getFileHandle(key, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
  } catch {
    // Quota or Safari without createWritable: outputs stay in memory only.
  }
}

async function unpersist(key: string) {
  const d = await dir();
  try {
    await d?.removeEntry(key);
  } catch {}
}

export async function readPersisted(key: string): Promise<File | null> {
  const d = await dir();
  if (!d) return null;
  try {
    return await (await d.getFileHandle(key)).getFile();
  } catch {
    return null;
  }
}

export async function clearPersisted() {
  if (typeof navigator === "undefined" || !navigator.storage?.getDirectory) return;
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry("outputs", { recursive: true });
  } catch {}
}
