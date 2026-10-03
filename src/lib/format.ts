export function formatBytes(n: number, opts: { unit?: boolean } = {}): string {
  const unit = opts.unit ?? true;
  if (n < 1000) return unit ? `${n} B` : `${n}`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1000;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return unit ? `${s} ${units[i]}` : s;
}

/** Splits "4.81 MB" into ["4.81", "MB"] for big-number typography. */
export function bytesParts(n: number): [string, string] {
  const [v, u] = formatBytes(n).split(" ");
  return [v, u];
}

export function savedPct(input: number, output: number) {
  if (!input) return 0;
  return Math.round((1 - output / input) * 100);
}

export function formatDuration(sec: number) {
  if (!isFinite(sec) || sec < 0) return "--:--";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatTimecode(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m.toString().padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

export function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function baseName(name: string) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}
