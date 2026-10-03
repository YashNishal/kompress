import type { VideoCodec } from "./types";

export interface Capabilities {
  webcodecs: boolean;
  /** Per codec: can we encode 1080p in this browser, and is it likely hardware-backed? */
  videoEncode: Record<VideoCodec, { ok: boolean; hw: boolean }>;
  isolated: boolean;
  opfs: boolean;
  saveToFolder: boolean;
  cores: number;
  memoryGB?: number;
}

let cached: Promise<Capabilities> | null = null;

export function detectCapabilities(): Promise<Capabilities> {
  return (cached ??= probe());
}

async function probe(): Promise<Capabilities> {
  const webcodecs = typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined";
  const codecStrings: Record<VideoCodec, string> = {
    avc: "avc1.640028",
    vp9: "vp09.00.40.08",
    av1: "av01.0.08M.08",
  };
  const videoEncode = {} as Capabilities["videoEncode"];
  await Promise.all(
    (Object.keys(codecStrings) as VideoCodec[]).map(async (c) => {
      if (!webcodecs) return void (videoEncode[c] = { ok: false, hw: false });
      const base = { codec: codecStrings[c], width: 1920, height: 1080, bitrate: 5_000_000, framerate: 30 };
      const [any, hw] = await Promise.all([
        VideoEncoder.isConfigSupported(base).then((r) => !!r.supported, () => false),
        VideoEncoder.isConfigSupported({ ...base, hardwareAcceleration: "prefer-hardware" }).then(
          (r) => !!r.supported,
          () => false,
        ),
      ]);
      videoEncode[c] = { ok: any || hw, hw };
    }),
  );
  return {
    webcodecs,
    videoEncode,
    isolated: typeof crossOriginIsolated !== "undefined" && crossOriginIsolated,
    opfs: typeof navigator !== "undefined" && !!navigator.storage?.getDirectory,
    saveToFolder: typeof window !== "undefined" && "showDirectoryPicker" in window,
    cores: navigator.hardwareConcurrency || 4,
    memoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  };
}
