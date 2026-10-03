import * as Comlink from "comlink";
import { EngineError } from "./errors";
import type { ImageWorkerApi } from "./workers/image.worker";

export type Lane = "preview" | "probe" | "interactive" | "batch";

const LANE_ORDER: Lane[] = ["preview", "probe", "interactive", "batch"];
const IMAGE_TIMEOUT_MS = 180_000;

type Run<T> = (api: Comlink.Remote<ImageWorkerApi>) => Promise<T>;

interface Job<T = unknown> {
  id: number;
  lane: Lane;
  /** Jobs sharing a key replace each other while queued ("latest wins"). */
  key?: string;
  run: Run<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
}

interface Slot {
  raw: Worker;
  api: Comlink.Remote<ImageWorkerApi>;
  /** The preview slot only takes preview and probe work so the batch never blocks it. */
  previewOnly: boolean;
  job: Job | null;
  timer: ReturnType<typeof setTimeout> | null;
}

export interface Ticket<T> {
  promise: Promise<T>;
  cancel(): void;
}

/**
 * Worker pool for image work, with three priority lanes. One slot is reserved
 * for previews so moving a slider in Compare stays responsive during a
 * 500-file batch. Cancelling a running job terminates and respawns its worker,
 * because WASM encoders cannot be interrupted cooperatively.
 */
export class ImageScheduler {
  private slots: Slot[] = [];
  private queues: Record<Lane, Job[]> = { preview: [], probe: [], interactive: [], batch: [] };
  private nextId = 1;
  private batchLimit: number;

  constructor(size = defaultPoolSize()) {
    this.batchLimit = size;
    this.slots.push(this.spawn(true));
    for (let i = 0; i < size; i++) this.slots.push(this.spawn(false));
  }

  get stats() {
    return {
      workers: this.slots.length,
      running: this.slots.filter((s) => s.job).length,
      queued: LANE_ORDER.reduce((n, l) => n + this.queues[l].length, 0),
    };
  }

  submit<T>(lane: Lane, run: Run<T>, key?: string): Ticket<T> {
    let job!: Job<T>;
    const promise = new Promise<T>((resolve, reject) => {
      job = { id: this.nextId++, lane, key, run, resolve, reject };
    });
    if (key) {
      const q = this.queues[lane];
      for (let i = q.length - 1; i >= 0; i--) {
        if (q[i].key === key) {
          q[i].reject(new EngineError("CANCELLED", "Superseded"));
          q.splice(i, 1);
        }
      }
    }
    this.queues[lane].push(job as Job);
    this.pump();
    return { promise, cancel: () => this.cancel(job as Job) };
  }

  /** Cancel every queued or running job whose key starts with `prefix`. */
  cancelWhere(pred: (key: string | undefined) => boolean) {
    for (const lane of LANE_ORDER) {
      const q = this.queues[lane];
      for (let i = q.length - 1; i >= 0; i--) {
        if (pred(q[i].key)) {
          q[i].reject(new EngineError("CANCELLED", "Cancelled"));
          q.splice(i, 1);
        }
      }
    }
    for (const s of this.slots) if (s.job && pred(s.job.key)) this.kill(s, new EngineError("CANCELLED", "Cancelled"));
    this.pump();
  }

  /** Shrink the batch pool after memory trouble. */
  degrade(max = 2) {
    this.batchLimit = Math.min(this.batchLimit, max);
  }

  private cancel(job: Job) {
    const q = this.queues[job.lane];
    const i = q.indexOf(job);
    if (i >= 0) {
      q.splice(i, 1);
      job.reject(new EngineError("CANCELLED", "Cancelled"));
      return;
    }
    const slot = this.slots.find((s) => s.job === job);
    if (slot) this.kill(slot, new EngineError("CANCELLED", "Cancelled"));
    this.pump();
  }

  private pump() {
    for (const slot of this.slots) {
      if (slot.job) continue;
      if (!slot.previewOnly && this.runningBatch() >= this.batchLimit) continue;
      const job = this.take(slot.previewOnly ? ["preview", "probe"] : LANE_ORDER);
      if (job) this.start(slot, job);
    }
  }

  private runningBatch() {
    return this.slots.filter((s) => !s.previewOnly && s.job).length;
  }

  private take(lanes: Lane[]) {
    for (const l of lanes) if (this.queues[l].length) return this.queues[l].shift()!;
    return null;
  }

  private start(slot: Slot, job: Job) {
    slot.job = job;
    slot.timer = setTimeout(
      () => this.kill(slot, new EngineError("OUT_OF_MEMORY", "Encoding took too long and was stopped", "retry-smaller")),
      IMAGE_TIMEOUT_MS,
    );
    job.run(slot.api).then(
      (v) => this.finish(slot, job, () => job.resolve(v)),
      (e) => this.finish(slot, job, () => job.reject(e)),
    );
  }

  private finish(slot: Slot, job: Job, settle: () => void) {
    if (slot.job !== job) return; // already killed
    if (slot.timer) clearTimeout(slot.timer);
    slot.job = null;
    slot.timer = null;
    settle();
    this.pump();
  }

  private kill(slot: Slot, reason: unknown) {
    const job = slot.job;
    if (slot.timer) clearTimeout(slot.timer);
    slot.raw.terminate();
    slot.job = null;
    slot.timer = null;
    this.attach(slot);
    job?.reject(reason);
    this.pump();
  }

  private spawn(previewOnly: boolean): Slot {
    const slot = { previewOnly, job: null, timer: null } as unknown as Slot;
    this.attach(slot);
    return slot;
  }

  /** (Re)creates the worker behind a slot. The slot object itself is stable. */
  private attach(slot: Slot) {
    const raw = new Worker(new URL("./workers/image.worker.ts", import.meta.url), { type: "module" });
    slot.raw = raw;
    slot.api = Comlink.wrap<ImageWorkerApi>(raw);
    raw.addEventListener("error", (e) => {
      e.preventDefault();
      if (slot.raw === raw && slot.job)
        this.kill(slot, new EngineError("OUT_OF_MEMORY", "The encoder crashed on this file", "retry-smaller"));
    });
  }
}

function defaultPoolSize() {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
  const mem = typeof navigator !== "undefined" ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined;
  const byMem = mem ? Math.max(1, Math.floor(mem / 2)) : 6;
  return Math.max(1, Math.min(cores - 1, 6, byMem));
}
