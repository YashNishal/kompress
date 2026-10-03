import type { EngineErrorCode, ItemError, Recovery } from "./types";

export class EngineError extends Error {
  constructor(
    public code: EngineErrorCode,
    message: string,
    public recovery?: Recovery,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

/** Maps anything thrown by a codec, worker or browser API to a user-facing error. */
export function toItemError(err: unknown): ItemError {
  if (err && typeof err === "object" && "code" in err && "message" in err) {
    const e = err as { code: EngineErrorCode; message: string; recovery?: Recovery };
    if (e.code in MESSAGES || e.code === "UNKNOWN") return { code: e.code, message: e.message, recovery: e.recovery };
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/abort/i.test(msg)) return { code: "CANCELLED", message: "Cancelled" };
  if (/memory|allocation|RangeError|out of bounds/i.test(msg))
    return { code: "OUT_OF_MEMORY", message: "Too large for this device", recovery: "retry-smaller" };
  if (/QuotaExceeded/i.test(msg))
    return { code: "STORAGE_FULL", message: "Browser storage is full. Export finished files, then clear them" };
  if (/decode|InvalidState|source image|not supported|unsupported/i.test(msg))
    return { code: "DECODE_FAILED", message: "This file looks damaged or uses an unsupported format", recovery: "remove" };
  return { code: "UNKNOWN", message: msg || "Something failed while encoding", recovery: "retry" };
}

const MESSAGES: Record<Exclude<EngineErrorCode, "UNKNOWN">, true> = {
  UNSUPPORTED_INPUT: true,
  DECODE_FAILED: true,
  ENCODER_UNAVAILABLE: true,
  OUT_OF_MEMORY: true,
  TARGET_UNREACHABLE: true,
  STORAGE_FULL: true,
  CANCELLED: true,
};
