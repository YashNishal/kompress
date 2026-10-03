import type { Incoming } from "@/store/processor";

/** Collects files from a drop, walking into folders and keeping relative paths. */
export async function filesFromDataTransfer(dt: DataTransfer): Promise<Incoming[]> {
  const entries: FileSystemEntry[] = [];
  for (const item of Array.from(dt.items)) {
    if (item.kind !== "file") continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  if (!entries.length) return Array.from(dt.files).map((file) => ({ file }));
  const out: Incoming[] = [];
  await Promise.all(entries.map((e) => walk(e, "", out)));
  return out;
}

async function walk(entry: FileSystemEntry, prefix: string, out: Incoming[]) {
  if (entry.name.startsWith(".")) return;
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
    out.push({ file, path: prefix + file.name });
    return;
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children: FileSystemEntry[] = [];
    // readEntries returns results in batches of ~100
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      children.push(...batch);
    }
    await Promise.all(children.map((c) => walk(c, `${prefix}${entry.name}/`, out)));
  }
}

export function filesFromInput(list: FileList | null): Incoming[] {
  if (!list) return [];
  return Array.from(list).map((file) => ({ file, path: file.webkitRelativePath || file.name }));
}
