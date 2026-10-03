export type MediaKind = "image" | "video";

export type ImageFormat = "jpeg" | "webp" | "avif" | "jxl" | "png";

export type ResizeMode = "none" | "longest" | "width" | "height" | "percent";

export interface ImageSettings {
  format: ImageFormat;
  /** 0–100. Ignored when `lossless` is set. */
  quality: number;
  lossless: boolean;
  resize: { mode: ResizeMode; value: number };
  stripMetadata: boolean;
}

export type VideoCodec = "avc" | "vp9" | "av1";
export type VideoResolution = "source" | 2160 | 1440 | 1080 | 720 | 480;
export type VideoFps = "source" | 60 | 30 | 24;
export type AudioMode = "copy" | "aac" | "opus" | "none";

export interface VideoSettings {
  codec: VideoCodec;
  mode: "quality" | "target";
  /** 0–100, mapped to bits per pixel. */
  quality: number;
  targetMB: number;
  resolution: VideoResolution;
  fps: VideoFps;
  audio: AudioMode;
  audioKbps: number;
  /** Seconds. `null` end means "to the end". */
  trim: { start: number; end: number | null };
}

export interface GlobalSettings {
  image: ImageSettings;
  video: VideoSettings;
  /** Never output a file larger than its source. */
  keepIfLarger: boolean;
}

export interface Overrides {
  image?: Partial<ImageSettings>;
  video?: Partial<VideoSettings>;
}

export interface Probe {
  width: number;
  height: number;
  /** Source MIME / container, e.g. "image/png", "video/quicktime". */
  mime: string;
  /** Short label, e.g. "PNG", "MOV". */
  label: string;
  duration?: number;
  videoCodec?: string;
  audioCodec?: string | null;
  fps?: number;
}

export type ItemStatus = "probing" | "queued" | "encoding" | "done" | "failed" | "cancelled";

export type EngineErrorCode =
  | "UNSUPPORTED_INPUT"
  | "DECODE_FAILED"
  | "ENCODER_UNAVAILABLE"
  | "OUT_OF_MEMORY"
  | "TARGET_UNREACHABLE"
  | "STORAGE_FULL"
  | "CANCELLED"
  | "UNKNOWN";

export type Recovery = "retry" | "retry-ffmpeg" | "retry-smaller" | "remove";

export interface ItemError {
  code: EngineErrorCode;
  message: string;
  recovery?: Recovery;
}

export interface OutputInfo {
  key: string;
  size: number;
  format: string;
  ext: string;
  mime: string;
  width: number;
  height: number;
  ssim?: number;
  ms: number;
  /** True when the source was kept because the encode came out larger. */
  keptOriginal: boolean;
  /** Settings hash that produced this output. */
  hash: string;
}

export interface QueueItem {
  id: string;
  file: File;
  kind: MediaKind;
  /** Relative path when added from a folder, used to keep structure in ZIPs. */
  path: string;
  addedAt: number;
  probe?: Probe;
  thumbUrl?: string;
  overrides: Overrides;
  status: ItemStatus;
  progress: number;
  output?: OutputInfo;
  error?: ItemError;
}
