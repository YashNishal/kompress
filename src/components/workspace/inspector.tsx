"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCapabilities } from "@/hooks/use-capabilities";
import { IMAGE_FORMATS, VIDEO_CODECS, hasOverrides, resolveImage, resolveVideo } from "@/engine/settings";
import type {
  AudioMode,
  ImageFormat,
  ImageSettings,
  MediaKind,
  QueueItem,
  ResizeMode,
  VideoCodec,
  VideoFps,
  VideoResolution,
  VideoSettings,
} from "@/engine/types";
import { cn } from "@/lib/utils";
import { encode, encodeAll } from "@/store/processor";
import { useWorkspace } from "@/store/workspace";
import { DraftQuality, Section, Segmented } from "./primitives";

/**
 * Settings for everything (no selection) or for the selected files as
 * per-file overrides. Changes re-encode affected files after a short debounce;
 * stale in-flight jobs are cancelled by the processor.
 */
export function Inspector() {
  const selected = useWorkspace((s) => s.selected);
  const items = useWorkspace((s) => s.items);
  const global = useWorkspace((s) => s.global);
  const [tab, setTab] = useState<MediaKind>("image");

  const scope = selected.map((id) => items[id]).filter(Boolean);
  const kinds = new Set(scope.map((i) => i.kind));
  const kind: MediaKind = kinds.size === 1 ? [...kinds][0] : tab;
  const targets = scope.filter((i) => i.kind === kind);
  const first = targets[0];
  const overridden = targets.some(hasOverrides);

  const scopeLabel = !scope.length
    ? kind === "image"
      ? "All images"
      : "All videos"
    : targets.length === 1
      ? first.file.name
      : `${targets.length} selected ${kind === "image" ? "images" : "videos"}`;

  const resetOverrides = () => {
    const st = useWorkspace.getState();
    for (const t of targets) {
      st.clearOverride(t.id);
      encode(t.id, "interactive");
    }
  };

  return (
    <div className="flex min-h-full flex-col text-[13px]">
      <header className="border-b border-rule px-4 pb-3 pt-3.5">
        <div className="label-caps text-muted-foreground">{scope.length ? "Override for" : "Settings for"}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-normal" title={scopeLabel}>
            {scopeLabel}
          </h2>
          {overridden && (
            <button type="button" onClick={resetOverrides} className="shrink-0 text-[11.5px] font-semibold underline underline-offset-2">
              Reset to global
            </button>
          )}
        </div>
        {kinds.size !== 1 && (
          <Segmented
            className="mt-3"
            size="sm"
            value={kind}
            onChange={setTab}
            aria-label="Media type"
            options={[
              { value: "image", label: "Images" },
              { value: "video", label: "Videos" },
            ]}
          />
        )}
      </header>

      {kind === "image" ? (
        <ImageSettingsPanel settings={first ? resolveImage(global, first.overrides) : global.image} targets={targets} />
      ) : (
        <VideoSettingsPanel settings={first ? resolveVideo(global, first.overrides) : global.video} targets={targets} />
      )}

      {!scope.length && <OutputSection />}

      {scope.length > 0 && (
        <p className="px-4 py-3 text-[11.5px] text-muted-foreground">
          Changes here apply only to the selection. Deselect (<b>Esc</b>) to edit the settings for all files.
        </p>
      )}
    </div>
  );
}

/* ---------- applying changes ---------- */

const timers = new Map<string, ReturnType<typeof setTimeout>>();
function debounce(key: string, fn: () => void, ms = 150) {
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(fn, ms));
}

function makeApply<K extends MediaKind>(kind: K, targets: QueueItem[]) {
  type Patch = K extends "image" ? Partial<ImageSettings> : Partial<VideoSettings>;
  return (patch: Patch) => {
    const st = useWorkspace.getState();
    if (!targets.length) {
      if (kind === "image") st.setImage(patch as Partial<ImageSettings>);
      else st.setVideo(patch as Partial<VideoSettings>);
      debounce(`all:${kind}`, () => encodeAll(kind));
      return;
    }
    const ids = targets.map((t) => t.id);
    for (const id of ids) st.setOverride(id, { [kind]: patch });
    debounce(`sel:${kind}:${ids.join(",")}`, () => ids.forEach((id) => encode(id, "interactive")));
  };
}

/* ---------- image ---------- */

const FORMAT_ORDER: ImageFormat[] = ["avif", "webp", "jxl", "jpeg", "png"];

const RESIZE_MODES: { value: ResizeMode; label: string }[] = [
  { value: "none", label: "Off" },
  { value: "longest", label: "Long edge" },
  { value: "width", label: "Width" },
  { value: "height", label: "Height" },
  { value: "percent", label: "%" },
];

function ImageSettingsPanel({ settings: s, targets }: { settings: ImageSettings; targets: QueueItem[] }) {
  const apply = makeApply("image", targets);
  const fmt = IMAGE_FORMATS[s.format];
  const lossless = s.format === "png" || s.lossless;

  return (
    <>
      <Section title="Format" aside={fmt.lossy && fmt.lossless ? "Lossy or lossless" : fmt.lossy ? "Lossy only" : "Lossless only"}>
        <Segmented
          value={s.format}
          onChange={(format) => apply({ format })}
          aria-label="Output format"
          options={FORMAT_ORDER.map((f) => ({ value: f, label: IMAGE_FORMATS[f].label }))}
        />
        {s.format === "jxl" && (
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            JPEG XL is the smallest at high quality but only Safari displays it today. The preview uses a PNG stand-in.
          </p>
        )}
      </Section>

      <Section title="Quality" aside={lossless ? "Lossless" : undefined}>
        <DraftQuality value={s.quality} disabled={lossless} onCommit={(quality) => apply({ quality })} />
        {fmt.lossless && fmt.lossy && (
          <label className="mt-3 flex items-center justify-between gap-3 font-medium">
            Lossless
            <Switch checked={s.lossless} onCheckedChange={(v) => apply({ lossless: v })} />
          </label>
        )}
      </Section>

      <Section title="Resize" aside="Never upscales">
        <Segmented
          size="sm"
          value={s.resize.mode}
          onChange={(mode) =>
            apply({ resize: { mode, value: mode === "percent" ? Math.min(s.resize.value, 100) || 50 : s.resize.value > 100 ? s.resize.value : 2000 } })
          }
          aria-label="Resize mode"
          options={RESIZE_MODES}
        />
        {s.resize.mode !== "none" && (
          <div className="mt-2.5 flex items-center gap-2">
            <DraftNumber
              value={s.resize.value}
              min={1}
              max={s.resize.mode === "percent" ? 100 : 16384}
              onCommit={(value) => apply({ resize: { mode: s.resize.mode, value } })}
              aria-label="Resize value"
            />
            <span className="font-medium text-muted-foreground">{s.resize.mode === "percent" ? "%" : "px"}</span>
            {s.resize.mode !== "percent" && (
              <div className="ml-auto flex gap-1">
                {[1280, 1920, 2560].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => apply({ resize: { mode: s.resize.mode, value: v } })}
                    className={cn(
                      "rounded-[3px] px-1.5 py-0.5 text-[11px] font-semibold tnum outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      s.resize.value === v ? "bg-accent text-accent-foreground" : "bg-secondary hover:bg-muted",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Metadata">
        <label className="flex items-center justify-between gap-3 font-medium">
          <span>
            Strip EXIF and GPS
            <span className="block text-[11.5px] font-normal text-muted-foreground">Orientation is applied first.</span>
          </span>
          <Switch checked={s.stripMetadata} onCheckedChange={(v) => apply({ stripMetadata: v })} />
        </label>
      </Section>
    </>
  );
}

/* ---------- video ---------- */

const CODEC_ORDER: VideoCodec[] = ["avc", "vp9", "av1"];
const RESOLUTIONS: VideoResolution[] = ["source", 2160, 1440, 1080, 720, 480];
const FPS: VideoFps[] = ["source", 60, 30, 24];
const TARGETS = [
  { label: "Discord", mb: 25 },
  { label: "Email", mb: 20 },
  { label: "WhatsApp", mb: 16 },
];

function VideoSettingsPanel({ settings: s, targets }: { settings: VideoSettings; targets: QueueItem[] }) {
  const apply = makeApply("video", targets);
  const caps = useCapabilities();
  const unsupported = CODEC_ORDER.filter((c) => caps && !caps.videoEncode[c].ok);

  if (caps && !caps.webcodecs)
    return (
      <Section title="Video">
        <p className="text-muted-foreground">
          This browser has no WebCodecs, so it can&apos;t encode video. Use a recent Chrome, Edge or Safari.
        </p>
      </Section>
    );

  return (
    <>
      <Section title="Codec" aside={VIDEO_CODECS[s.codec].container.toUpperCase()}>
        <Segmented
          value={s.codec}
          onChange={(codec) => apply({ codec })}
          aria-label="Video codec"
          options={CODEC_ORDER.map((c) => ({
            value: c,
            label: VIDEO_CODECS[c].label,
            disabled: unsupported.includes(c),
            title: unsupported.includes(c) ? "Not supported by this browser" : undefined,
          }))}
        />
        {unsupported.length > 0 && (
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            {unsupported.map((c) => VIDEO_CODECS[c].label).join(" and ")} encoding isn&apos;t available in this browser.
          </p>
        )}
      </Section>

      <Section title="Size">
        <Segmented
          size="sm"
          value={s.mode}
          onChange={(mode) => apply({ mode })}
          aria-label="Size mode"
          options={[
            { value: "quality", label: "By quality" },
            { value: "target", label: "Target size" },
          ]}
        />
        <div className="mt-3">
          {s.mode === "quality" ? (
            <DraftQuality value={s.quality} onCommit={(quality) => apply({ quality })} />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-[3px]">
                {TARGETS.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => apply({ targetMB: t.mb })}
                    className={cn(
                      "rounded-[3px] py-1.5 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      s.targetMB === t.mb ? "bg-accent text-accent-foreground" : "bg-secondary hover:bg-muted",
                    )}
                  >
                    <span className="block text-[11.5px] font-semibold">{t.label}</span>
                    <span className="block text-[10.5px] opacity-70 tnum">{t.mb} MB</span>
                  </button>
                ))}
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <DraftNumber value={s.targetMB} min={1} max={4000} onCommit={(targetMB) => apply({ targetMB })} aria-label="Target size in MB" />
                <span className="font-medium text-muted-foreground">MB max</span>
              </div>
            </>
          )}
        </div>
      </Section>

      <Section title="Resolution" aside="Short edge">
        <Segmented
          size="sm"
          value={String(s.resolution)}
          onChange={(v) => apply({ resolution: (v === "source" ? "source" : Number(v)) as VideoResolution })}
          aria-label="Resolution"
          options={RESOLUTIONS.map((r) => ({ value: String(r), label: r === "source" ? "Src" : `${r}p` }))}
        />
      </Section>

      <Section title="Frame rate" aside="Cap">
        <Segmented
          size="sm"
          value={String(s.fps)}
          onChange={(v) => apply({ fps: (v === "source" ? "source" : Number(v)) as VideoFps })}
          aria-label="Frame rate"
          options={FPS.map((f) => ({ value: String(f), label: f === "source" ? "Source" : `${f}` }))}
        />
      </Section>

      <Section title="Audio">
        <Segmented
          size="sm"
          value={s.audio}
          onChange={(audio) => apply({ audio: audio as AudioMode })}
          aria-label="Audio"
          options={[
            { value: "aac", label: "AAC", disabled: VIDEO_CODECS[s.codec].container === "webm", title: "WebM uses Opus" },
            { value: "opus", label: "Opus" },
            { value: "copy", label: "Copy" },
            { value: "none", label: "Remove" },
          ]}
        />
        {(s.audio === "aac" || s.audio === "opus") && (
          <div className="mt-2.5">
            <Segmented
              size="sm"
              value={String(s.audioKbps)}
              onChange={(v) => apply({ audioKbps: Number(v) })}
              aria-label="Audio bitrate"
              options={[64, 96, 128, 160, 192].map((k) => ({ value: String(k), label: `${k}k` }))}
            />
          </div>
        )}
        {s.audio === "aac" && VIDEO_CODECS[s.codec].container === "webm" && (
          <p className="mt-2 text-[11.5px] text-muted-foreground">WebM can&apos;t hold AAC, so audio is encoded as Opus.</p>
        )}
      </Section>
    </>
  );
}

/* ---------- global output ---------- */

function OutputSection() {
  const keep = useWorkspace((s) => s.global.keepIfLarger);
  return (
    <Section title="Output">
      <label className="flex items-center justify-between gap-3 font-medium">
        <span>
          Keep original if bigger
          <span className="block text-[11.5px] font-normal text-muted-foreground">Never export a file larger than its source.</span>
        </span>
        <Switch
          checked={keep}
          onCheckedChange={(v) => {
            useWorkspace.getState().setKeepIfLarger(v);
            debounce("all", () => encodeAll());
          }}
        />
      </label>
    </Section>
  );
}

/* ---------- draft number: local while typing, committed on blur/Enter ---------- */

function DraftNumber({
  value,
  min,
  max,
  onCommit,
  "aria-label": ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (v: number) => void;
  "aria-label": string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setDraft(String(value));
  }
  const commit = () => {
    const n = Math.round(Number(draft));
    if (!Number.isFinite(n) || n < min) return setDraft(String(value));
    const v = Math.min(max, n);
    setDraft(String(v));
    if (v !== value) onCommit(v);
  };
  return (
    <Input
      inputMode="numeric"
      value={draft}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="h-8 w-24 rounded-(--control-radius) text-[13px] font-semibold tnum"
    />
  );
}
