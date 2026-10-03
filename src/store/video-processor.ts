"use client";

import * as Comlink from "comlink";
import { toast } from "sonner";
import { EngineError, toItemError } from "@/engine/errors";
import { VIDEO_CODECS, itemHash, resolveVideo } from "@/engine/settings";
import { outputs } from "@/engine/storage/outputs";
import type { Probe } from "@/engine/types";
import type { VideoWorkerApi } from "@/engine/workers/video.worker";
import { useWorkspace } from "./workspace";

/**
 * Video runs one job at a time: hardware encoders are a shared resource and
 * parallel sessions slow each other down. Probing and frame grabs use a
 * second worker so they stay snappy while a long encode runs.
 */

type Api = Comlink.Remote<VideoWorkerApi>;

let encoderWorker: { raw: Worker; api: Api } | null = null;
let utilWorker: { raw: Worker; api: Api } | null = null;

function make() {
  const raw = new Worker(new URL("../engine/workers/video.worker.ts", import.meta.url), { type: "module" });
  return { raw, api: Comlink.wrap<VideoWorkerApi>(raw) };
}
const enc = () => (encoderWorker ??= make());
const util = () => (utilWorker ??= make());

const queue: string[] = [];
let running: { id: string; hash: string } | null = null;

export const videoEngine = {
  async probe(file: File): Promise<{ probe: Omit<Probe, "label">; thumb?: Blob }> {
    if (typeof VideoDecoder === "undefined")
      throw new EngineError("UNSUPPORTED_INPUT", "This browser can't process video (no WebCodecs)");
    const p = await util().api.probe(file);
    if (!p.canDecode)
      throw new EngineError(
        "UNSUPPORTED_INPUT",
        `Can't decode ${p.videoCodec ? p.videoCodec.toUpperCase() : "this codec"} in this browser`,
        "retry-ffmpeg",
      );
    return {
      probe: {
        width: p.width,
        height: p.height,
        duration: p.duration,
        fps: p.fps,
        mime: file.type || "video/*",
        videoCodec: p.videoCodec ?? undefined,
        audioCodec: p.audioCodec,
      },
      thumb: p.thumb,
    };
  },

  enqueue(id: string, hash: string) {
    if (running?.id === id) {
      if (running.hash === hash) return;
      void enc().api.cancel();
    }
    if (!queue.includes(id)) queue.push(id);
    void pump();
  },

  cancel(id: string) {
    const i = queue.indexOf(id);
    if (i >= 0) queue.splice(i, 1);
    if (running?.id === id) void enc().api.cancel();
  },

  frameAt(file: Blob, t: number, width: number, hq = false) {
    return util().api.frameAt(file, t, width, hq);
  },

  filmstrip(file: Blob, count: number, width: number) {
    return util().api.filmstrip(file, count, width);
  },

  get busy() {
    return !!running;
  },
};

async function pump() {
  if (running || !queue.length) return;
  const id = queue.shift()!;
  const s = useWorkspace.getState();
  const it = s.items[id];
  if (!it?.probe?.duration) return void pump();

  const hash = itemHash(it, s.global);
  const settings = resolveVideo(s.global, it.overrides);
  const key = `${id}-${hash}`;
  running = { id, hash };
  s.patch(id, { status: "encoding", progress: 0, error: undefined });

  let last = 0;
  const onProgress = Comlink.proxy((p: number) => {
    const now = performance.now();
    if (now - last < 200 && p < 1) return;
    last = now;
    useWorkspace.getState().patch(id, { progress: Math.min(0.99, p) });
  });

  try {
    const probe = { width: it.probe.width, height: it.probe.height, duration: it.probe.duration, fps: it.probe.fps ?? 30 };
    const r = await enc().api.encode(it.file, settings, probe, key, onProgress);
    const now = useWorkspace.getState();
    const cur = now.items[id];
    if (cur && itemHash(cur, now.global) === hash) {
      const prev = cur.output?.key;
      if (r.persisted) outputs.adopt(key, r.blob);
      else outputs.put(key, r.blob);
      if (prev && prev !== key) outputs.delete(prev);
      const meta = VIDEO_CODECS[settings.codec];
      now.patch(id, {
        status: "done",
        progress: 1,
        output: {
          key,
          size: r.blob.size,
          format: meta.label,
          ext: meta.ext,
          mime: meta.mime,
          width: r.width,
          height: r.height,
          ms: r.ms,
          keptOriginal: false,
          hash,
        },
      });
    }
  } catch (err) {
    const e = toItemError(err);
    const now = useWorkspace.getState();
    const cur = now.items[id];
    const current = cur && itemHash(cur, now.global) === hash;
    if (current && e.code === "ENCODER_UNAVAILABLE" && settings.codec !== "avc") {
      // The one automatic recovery for video: H.264 is available wherever WebCodecs is.
      toast(`${VIDEO_CODECS[settings.codec].label} isn't available here`, {
        description: `${cur.file.name} was encoded as H.264 instead.`,
      });
      now.setOverride(id, { video: { codec: "avc" } });
      queue.unshift(id);
    } else if (e.code !== "CANCELLED" && current) {
      now.patch(id, { status: "failed", error: e, progress: 0 });
    }
    if (e.code === "OUT_OF_MEMORY" || /crash|terminated/i.test(e.message)) {
      encoderWorker?.raw.terminate();
      encoderWorker = null;
    }
  } finally {
    running = null;
    void pump();
  }
}
