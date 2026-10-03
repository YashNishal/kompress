/// <reference lib="webworker" />
import * as Comlink from "comlink";
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  CanvasSink,
  Conversion,
  ConversionCanceledError,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  StreamTarget,
  WebMOutputFormat,
  canEncodeVideo,
  type ConversionAudioOptions,
  type InputVideoTrack,
  type StreamTargetChunk,
} from "mediabunny";
import { EngineError } from "../errors";
import { VIDEO_CODECS, outputFps, videoBitrate, videoTargetSize } from "../settings";
import type { VideoSettings } from "../types";
import { withPlainErrors } from "./plain-errors";

export interface VideoProbeResult {
  width: number;
  height: number;
  duration: number;
  fps: number;
  videoCodec: string | null;
  audioCodec: string | null;
  canDecode: boolean;
  thumb?: Blob;
}

export interface VideoEncodeResult {
  blob: Blob;
  width: number;
  height: number;
  ms: number;
  /** true when the output was streamed straight to OPFS under `key`. */
  persisted: boolean;
}

let current: Conversion | null = null;
let cancelled = false;

function open(file: Blob) {
  return new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
}

async function primaryVideo(input: Input) {
  const vt = await input.getPrimaryVideoTrack();
  if (!vt) throw new EngineError("UNSUPPORTED_INPUT", "No video track found in this file", "remove");
  return vt;
}

async function frameBlob(vt: InputVideoTrack, t: number, width: number, type = "image/webp", quality = 0.82) {
  const sink = new CanvasSink(vt, { width: Math.min(width, vt.displayWidth), fit: "contain", poolSize: 1 });
  const first = await vt.getFirstTimestamp();
  const wrapped = (await sink.getCanvas(Math.max(first, t))) ?? (await sink.getCanvas(first));
  if (!wrapped) return undefined;
  const c = wrapped.canvas as OffscreenCanvas;
  return c.convertToBlob({ type, quality });
}

const api = {
  async probe(file: Blob): Promise<VideoProbeResult> {
    const input = open(file);
    try {
      let vt: InputVideoTrack;
      try {
        vt = await primaryVideo(input);
      } catch (e) {
        if (e instanceof EngineError) throw e;
        throw new EngineError("UNSUPPORTED_INPUT", "This container isn't readable in the browser", "retry-ffmpeg");
      }
      const at = await input.getPrimaryAudioTrack();
      const duration = await input.computeDuration();
      const stats = await vt.computePacketStats(120);
      const canDecode = await vt.canDecode();
      let thumb: Blob | undefined;
      if (canDecode) {
        try {
          thumb = await frameBlob(vt, Math.min(1, duration * 0.1), 320);
        } catch {}
      }
      return {
        width: vt.displayWidth,
        height: vt.displayHeight,
        duration,
        fps: Math.round(stats.averagePacketRate * 100) / 100 || 30,
        videoCodec: vt.codec,
        audioCodec: at?.codec ?? null,
        canDecode,
        thumb,
      };
    } finally {
      input.dispose();
    }
  },

  /** One frame as an image, for the Compare canvas and the trim filmstrip. */
  async frameAt(file: Blob, t: number, width: number, hq = false): Promise<Blob | undefined> {
    const input = open(file);
    try {
      return await frameBlob(await primaryVideo(input), t, width, hq ? "image/png" : "image/webp", 0.8);
    } finally {
      input.dispose();
    }
  },

  async filmstrip(file: Blob, count: number, width: number): Promise<Blob[]> {
    const input = open(file);
    try {
      const vt = await primaryVideo(input);
      const duration = await input.computeDuration();
      const first = await vt.getFirstTimestamp();
      const sink = new CanvasSink(vt, { width, fit: "cover", height: Math.round((width * 9) / 16), poolSize: 1 });
      const times = Array.from({ length: count }, (_, i) => first + (duration * (i + 0.5)) / count);
      const out: Blob[] = [];
      for await (const w of sink.canvasesAtTimestamps(times)) {
        if (w) out.push(await (w.canvas as OffscreenCanvas).convertToBlob({ type: "image/webp", quality: 0.6 }));
      }
      return out;
    } finally {
      input.dispose();
    }
  },

  async encode(
    file: Blob,
    s: VideoSettings,
    probe: { width: number; height: number; duration: number; fps: number },
    key: string,
    onProgress: (p: number) => void,
  ): Promise<VideoEncodeResult> {
    const t0 = performance.now();
    cancelled = false;
    const meta = VIDEO_CODECS[s.codec];
    const dims = videoTargetSize(probe.width, probe.height, s.resolution);
    const fps = outputFps(s, probe.fps);
    const start = Math.max(0, s.trim.start);
    const end = s.trim.end ?? probe.duration;
    const duration = Math.max(0.1, end - start);
    const rate = videoBitrate(s, { ...dims, fps, duration });

    if (!rate.reachable) {
      const mb = (rate.minBytes / 1e6).toFixed(1);
      throw new EngineError(
        "TARGET_UNREACHABLE",
        `Can't fit ${s.targetMB} MB at this resolution. Smallest is about ${mb} MB. Lower the resolution or trim`,
      );
    }
    const supported = await canEncodeVideo(s.codec, { width: dims.width, height: dims.height, bitrate: rate.video });
    if (!supported)
      throw new EngineError("ENCODER_UNAVAILABLE", `${meta.label} encoding isn't available in this browser`);

    let bitrate = rate.video;
    for (let pass = 0; pass < 2; pass++) {
      const result = await runPass(file, s, { dims, fps, start, end, bitrate, key }, (p) =>
        onProgress(pass === 0 ? p : 0.5 + p * 0.5),
      );
      const target = s.targetMB * 1e6;
      const over = s.mode === "target" && result.blob.size > target * 1.03;
      if (!over || pass === 1) return { ...result, width: dims.width, height: dims.height, ms: performance.now() - t0 };
      bitrate = Math.max(100_000, bitrate * ((target * 0.95) / result.blob.size));
    }
    throw new EngineError("UNKNOWN", "Unreachable");
  },

  async cancel() {
    cancelled = true;
    await current?.cancel();
  },
};

async function runPass(
  file: Blob,
  s: VideoSettings,
  o: { dims: { width: number; height: number }; fps: number; start: number; end: number; bitrate: number; key: string },
  onProgress: (p: number) => void,
): Promise<{ blob: Blob; persisted: boolean }> {
  const meta = VIDEO_CODECS[s.codec];
  const sink = await openSink(o.key);
  const format =
    meta.container === "webm"
      ? new WebMOutputFormat()
      : new Mp4OutputFormat({ fastStart: sink.kind === "buffer" ? "in-memory" : false });
  const output = new Output({ format, target: sink.target });
  const input = open(file);

  let audio: ConversionAudioOptions;
  if (s.audio === "none") audio = { discard: true };
  else if (s.audio === "copy") audio = {};
  else {
    // AAC can't go in WebM; fall back to Opus there.
    const codec = meta.container === "webm" ? "opus" : s.audio;
    audio = { codec, bitrate: s.audioKbps * 1000, forceTranscode: true };
  }

  try {
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: {
        codec: s.codec,
        width: o.dims.width,
        height: o.dims.height,
        fit: "contain",
        frameRate: o.fps,
        quality: new Quality({ bitrate: Math.round(o.bitrate), bitrateMode: "variable" }),
      },
      audio,
      trim: { start: o.start, end: o.end },
      showWarnings: false,
    });
    if (!conversion.isValid) {
      const reason = conversion.discardedTracks.map((d) => d.reason).join(", ");
      throw new EngineError("UNSUPPORTED_INPUT", `Can't convert this video (${reason || "no usable tracks"})`, "retry-ffmpeg");
    }
    current = conversion;
    conversion.onProgress = (p) => onProgress(p);
    if (cancelled) await conversion.cancel();
    await conversion.execute();
    return await sink.finish(output);
  } catch (err) {
    await sink.abort();
    if (err instanceof ConversionCanceledError || cancelled) throw new EngineError("CANCELLED", "Cancelled");
    throw err;
  } finally {
    current = null;
    input.dispose();
  }
}

type Sink =
  | { kind: "opfs"; target: StreamTarget; finish(o: Output): Promise<{ blob: Blob; persisted: boolean }>; abort(): Promise<void> }
  | { kind: "buffer"; target: BufferTarget; finish(o: Output): Promise<{ blob: Blob; persisted: boolean }>; abort(): Promise<void> };

/** Stream straight into OPFS when possible so a 2 GB export never sits in RAM. */
async function openSink(key: string): Promise<Sink> {
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle("outputs", { create: true });
    const fh = await dir.getFileHandle(key, { create: true });
    const writable = await fh.createWritable();
    const stream = new WritableStream<StreamTargetChunk>({
      write: (chunk) => writable.write({ type: "write", position: chunk.position, data: chunk.data }),
      close: () => writable.close(),
      abort: () => writable.abort(),
    });
    const target = new StreamTarget(stream, { chunked: true });
    return {
      kind: "opfs",
      target,
      // Conversion.execute() finalizes the output itself.
      async finish(o) {
        const f = await fh.getFile();
        return { blob: f.slice(0, f.size, o.format.mimeType), persisted: true };
      },
      async abort() {
        try {
          await dir.removeEntry(key);
        } catch {}
      },
    };
  } catch {
    const target = new BufferTarget();
    return {
      kind: "buffer",
      target,
      async finish(o) {
        return { blob: new Blob([target.buffer!], { type: o.format.mimeType }), persisted: false };
      },
      async abort() {},
    };
  }
}

export type VideoWorkerApi = typeof api;
Comlink.expose(withPlainErrors(api));
