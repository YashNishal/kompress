"use client";

import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { IMAGE_FORMATS, VIDEO_CODECS, hasOverrides, resolveImage, resolveVideo } from "@/engine/settings";
import { outputs } from "@/engine/storage/outputs";
import type { ImageFormat, ImageSettings, QueueItem } from "@/engine/types";
import { formatBytes, formatTimecode, savedPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { encode, encodeAll, previewEncode, sourceUrl } from "@/store/processor";
import { videoEngine } from "@/store/video-processor";
import { useWorkspace } from "@/store/workspace";
import { CompareStage, FIT, ZOOM_STEPS, type CompareMode, type View } from "./compare-stage";
import { DraftQuality, Kbd, Segmented } from "./primitives";
import { ignoreKey } from "./shortcuts";
import { VideoTimeline, type Trim } from "./video-timeline";

const MODES: CompareMode[] = ["split", "side", "diff"];

const FORMATS: ImageFormat[] = ["avif", "webp", "jxl", "jpeg", "png"];

interface SideStats {
  size: number;
  width: number;
  height: number;
  ms?: number;
  ssim?: number;
}

export function CompareView({ id }: { id: string }) {
  const item = useWorkspace((s) => s.items[id]);
  const [mode, setMode] = useState<CompareMode>("split");
  const [split, setSplit] = useState(0.5);

  if (!item)
    return (
      <div className="flex flex-1 flex-col items-start justify-center gap-4 p-10">
        <span className="label-caps text-muted-foreground">02 · Compare</span>
        <h1 className="text-[32px] font-semibold leading-none tracking-[-0.03em]">Nothing to compare.</h1>
        <p className="max-w-md text-muted-foreground">
          This file isn&apos;t in the queue. Files live only in this tab, so a reload or a shared link starts empty.
        </p>
        <Button asChild variant="acid" className="rounded-(--control-radius)">
          <Link href="/app">Back to the queue</Link>
        </Button>
      </div>
    );

  // Keyed by id so zoom, time and left-side state reset when stepping through the batch.
  return <CompareBody key={id} item={item} mode={mode} setMode={setMode} split={split} setSplit={setSplit} />;
}

function CompareBody({
  item,
  mode,
  setMode,
  split,
  setSplit,
}: {
  item: QueueItem;
  mode: CompareMode;
  setMode: React.Dispatch<React.SetStateAction<CompareMode>>;
  split: number;
  setSplit: (v: number) => void;
}) {
  const router = useRouter();
  const order = useWorkspace((s) => s.order);
  const global = useWorkspace((s) => s.global);
  const [view, setView] = useState<View>(FIT);
  const [holding, setHolding] = useState(false);
  const index = order.indexOf(item.id);

  const go = useCallback(
    (delta: number) => {
      const next = order[(index + delta + order.length) % order.length];
      if (next && next !== item.id) router.replace(`/app/compare/${next}`);
    },
    [order, index, item.id, router],
  );

  useEffect(() => {
    useWorkspace.getState().select([item.id], item.id);
  }, [item.id]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (ignoreKey(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === " ") {
        if (!e.repeat) setHolding(true);
      } else if (k >= "1" && k <= "4") {
        const s = ZOOM_STEPS[Number(k) - 1];
        setView(s ? { scale: s, x: 0, y: 0 } : FIT);
      } else if (k === "m") {
        setMode((m) => MODES[(MODES.indexOf(m) + 1) % MODES.length]);
      } else if (k === "ArrowLeft") go(-1);
      else if (k === "ArrowRight") go(1);
      else if (k === "Escape") router.push("/app");
      else return;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => e.key === " " && setHolding(false);
    const blur = () => setHolding(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [go, router, setMode]);

  const w = item.probe?.width ?? 0;
  const h = item.probe?.height ?? 0;

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto]">
      <div className="flex h-12 items-center gap-4 border-b border-rule px-4">
        <Link href="/app" className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Queue
        </Link>
        <div className="flex min-w-0 items-center gap-1">
          <IconBtn label="Previous file" onClick={() => go(-1)}>
            <ChevronLeft />
          </IconBtn>
          <span className="min-w-0 truncate text-[14px] font-bold">{item.file.name}</span>
          <span className="shrink-0 text-[12px] text-muted-foreground tnum">
            {index + 1}/{order.length}
          </span>
          <IconBtn label="Next file" onClick={() => go(1)}>
            <ChevronRight />
          </IconBtn>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Segmented
            size="sm"
            className="w-[240px]"
            value={mode}
            onChange={setMode}
            aria-label="Compare mode"
            options={[
              { value: "split", label: "Split" },
              { value: "side", label: "Side by side" },
              { value: "diff", label: "Diff" },
            ]}
          />
          <Segmented
            size="sm"
            className="w-[200px]"
            value={String(view.scale)}
            onChange={(v) => setView(Number(v) ? { scale: Number(v), x: 0, y: 0 } : FIT)}
            aria-label="Zoom"
            options={ZOOM_STEPS.map((s) => ({ value: String(s), label: s ? `${s}×` : "Fit" }))}
          />
        </div>
      </div>

      {item.kind === "image" ? (
        <ImageCompare item={item} global={global} mode={mode} view={view} setView={setView} split={split} setSplit={setSplit} holding={holding} w={w} h={h} />
      ) : (
        <VideoCompare item={item} mode={mode} view={view} setView={setView} split={split} setSplit={setSplit} holding={holding} w={w} h={h} />
      )}

      <Filmstrip current={item.id} />
    </div>
  );
}

type StageProps = {
  mode: CompareMode;
  view: View;
  setView: (v: View) => void;
  split: number;
  setSplit: (v: number) => void;
  holding: boolean;
  w: number;
  h: number;
};

/* ---------- images ---------- */

function ImageCompare({
  item,
  global,
  ...stage
}: StageProps & { item: QueueItem; global: ReturnType<typeof useWorkspace.getState>["global"] }) {
  const resolved = resolveImage(global, item.overrides);
  const [leftSource, setLeftSource] = useState<"original" | "encode">("original");
  const [custom, setCustom] = useState<ImageSettings>(() => ({
    ...resolved,
    format: resolved.format === "webp" ? "avif" : "webp",
  }));
  const left = useCustomEncode(item.id, leftSource === "encode" ? custom : null);

  const out = item.output;
  const rightUrl = out ? outputs.displayUrl(out.key) : undefined;
  const rightBusy = item.status !== "done";

  const leftUrl = leftSource === "original" ? sourceUrl(item.id) : left.url;
  const originalStats: SideStats = { size: item.file.size, width: stage.w, height: stage.h };

  const applyRight = (patch: Partial<ImageSettings>) => {
    useWorkspace.getState().setOverride(item.id, { image: patch });
    debounce(`cmp:${item.id}`, () => encode(item.id, "interactive"));
  };
  const promote = () => {
    const st = useWorkspace.getState();
    st.setImage(resolved);
    st.clearOverride(item.id);
    encodeAll("image");
  };

  return (
    <div className="grid min-h-0 grid-cols-[260px_minmax(0,1fr)_260px]">
      <SidePanel
        letter="A"
        title={leftSource === "original" ? "Original" : `${IMAGE_FORMATS[custom.format].label} preview`}
        stats={leftSource === "original" ? originalStats : left.stats}
        source={item.file.size}
        busy={leftSource === "encode" && left.busy}
      >
        <Segmented
          size="sm"
          value={leftSource}
          onChange={setLeftSource}
          aria-label="Left side source"
          options={[
            { value: "original", label: "Original" },
            { value: "encode", label: "Encode" },
          ]}
        />
        {leftSource === "encode" && (
          <FormatQuality settings={custom} onChange={(p) => setCustom((c) => ({ ...c, ...p }))} />
        )}
        {leftSource === "encode" && (
          <p className="text-[11px] text-muted-foreground">A scratch encode to compare against. It doesn&apos;t change the export.</p>
        )}
      </SidePanel>

      <CompareStage
        className="min-h-0"
        left={leftUrl}
        right={rightUrl}
        width={stage.w}
        height={stage.h}
        mode={stage.mode}
        view={stage.view}
        onView={stage.setView}
        split={stage.split}
        onSplit={stage.setSplit}
        showOriginal={stage.holding}
        labels={[leftSource === "original" ? "A · Original" : "A · Preview", `B · ${out?.format ?? "…"}${rightBusy ? " · encoding" : ""}`]}
      />

      <SidePanel
        letter="B"
        title="Export"
        stats={out ? { size: out.size, width: out.width, height: out.height, ms: out.ms, ssim: out.ssim } : undefined}
        source={item.file.size}
        busy={rightBusy}
        note={out?.keptOriginal ? "Already optimal: the encode came out larger, so the original is kept." : undefined}
      >
        <FormatQuality settings={resolved} onChange={applyRight} />
        <div className="flex gap-2">
          <Button size="sm" variant="acid" className="h-8 flex-1 rounded-(--control-radius)" onClick={promote} disabled={!hasOverrides(item)}>
            Apply to all
          </Button>
          {hasOverrides(item) && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-(--control-radius)"
              onClick={() => {
                useWorkspace.getState().clearOverride(item.id);
                encode(item.id, "interactive");
              }}
            >
              Reset
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Changes here apply to this file only. <b>Apply to all</b> makes them the default for every image.
        </p>
      </SidePanel>
    </div>
  );
}

function FormatQuality({ settings: s, onChange }: { settings: ImageSettings; onChange: (p: Partial<ImageSettings>) => void }) {
  const lossless = s.format === "png" || s.lossless;
  return (
    <>
      <Segmented
        size="sm"
        value={s.format}
        onChange={(format) => onChange({ format })}
        aria-label="Format"
        options={FORMATS.map((f) => ({ value: f, label: IMAGE_FORMATS[f].label }))}
      />
      <DraftQuality value={s.quality} disabled={lossless} onCommit={(quality) => onChange({ quality })} />
    </>
  );
}

/** Encodes the left side on the reserved preview worker. Latest settings win. */
function useCustomEncode(id: string, settings: ImageSettings | null) {
  const [state, setState] = useState<{ url?: string; stats?: SideStats; busy: boolean }>({ busy: false });
  const seq = useRef(0);
  const urlRef = useRef<string | undefined>(undefined);
  const key = settings ? JSON.stringify(settings) : null;

  useEffect(() => {
    if (!settings) return;
    const n = ++seq.current;
    let cancel: (() => void) | undefined;
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, busy: true }));
      const ticket = previewEncode(id, "compare-left", settings);
      if (!ticket) return;
      cancel = ticket.cancel;
      ticket.promise.then(
        (r) => {
          if (n !== seq.current) return;
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          const url = (urlRef.current = URL.createObjectURL(r.display ?? r.blob));
          setState({ url, busy: false, stats: { size: r.blob.size, width: r.width, height: r.height, ms: r.ms, ssim: r.ssim } });
        },
        () => n === seq.current && setState((s) => ({ ...s, busy: false })),
      );
    }, 150);
    return () => {
      clearTimeout(timer);
      cancel?.();
    };
    // `key` captures every field of `settings`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key]);

  useEffect(() => () => void (urlRef.current && URL.revokeObjectURL(urlRef.current)), []);
  return state;
}

/* ---------- video ---------- */

function VideoCompare({ item, ...stage }: StageProps & { item: QueueItem }) {
  const global = useWorkspace((s) => s.global);
  const settings = resolveVideo(global, item.overrides);
  const duration = item.probe?.duration ?? 0;
  const fps = item.probe?.fps ?? 30;
  const trim = settings.trim;
  const trimEnd = trim.end ?? duration;
  const [t, setT] = useState(() => Math.min(trim.start + 1, trimEnd));

  const out = item.output;
  const done = item.status === "done";
  const outBlob = done && out ? outputs.get(out.key) : undefined;
  // The export starts at the in point, so side B seeks to the same moment on its own timeline.
  const inRange = t >= trim.start && t <= trimEnd;
  const left = useFrame(item.file, t);
  const right = useFrame(inRange ? outBlob : undefined, t - trim.start);

  const onTrim = (next: Trim) => {
    useWorkspace.getState().setOverride(item.id, { video: { trim: next } });
    // A trim restarts a long encode, so wait a little longer for the user to settle.
    debounce(`trim:${item.id}`, () => encode(item.id, "interactive"), 600);
  };

  return (
    <div className="grid min-h-0 grid-cols-[260px_minmax(0,1fr)_260px]">
      <SidePanel letter="A" title="Original" stats={{ size: item.file.size, width: stage.w, height: stage.h }} source={item.file.size}>
        <p className="text-[11px] text-muted-foreground">
          {item.probe?.videoCodec?.toUpperCase()} · {fps} fps · {formatTimecode(duration)} · audio {item.probe?.audioCodec ?? "none"}
        </p>
      </SidePanel>
      <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]">
        <CompareStage
          className="min-h-0"
          left={left}
          right={right}
          width={stage.w}
          height={stage.h}
          mode={stage.mode}
          view={stage.view}
          onView={stage.setView}
          split={stage.split}
          onSplit={stage.setSplit}
          showOriginal={stage.holding}
          labels={[
            "A · Original",
            `B · ${out?.format ?? "…"}${!done ? " · encoding" : !inRange ? " · trimmed out" : ""}`,
          ]}
        />
        <VideoTimeline file={item.file} duration={duration} fps={fps} t={t} onSeek={setT} trim={trim} onTrim={onTrim} />
      </div>
      <SidePanel
        letter="B"
        title="Export"
        stats={out ? { size: out.size, width: out.width, height: out.height, ms: out.ms } : undefined}
        source={item.file.size}
        busy={!done}
      >
        <p className="text-[11px] text-muted-foreground">
          {VIDEO_CODECS[settings.codec].label} ·{" "}
          {settings.mode === "target" ? `target ${settings.targetMB} MB` : `quality ${settings.quality}`} ·{" "}
          {settings.resolution === "source" ? "source size" : `${settings.resolution}p`} · audio {settings.audio}
        </p>
        {item.status === "encoding" && (
          <p className="text-[11px] font-semibold tnum">Encoding {Math.round(item.progress * 100)}%</p>
        )}
        <p className="text-[11px] text-muted-foreground">
          Trim here applies to this file. Change codec and size in the queue inspector.
        </p>
      </SidePanel>
    </div>
  );
}

/** One decoded frame at `t` (debounced), as an object URL. */
function useFrame(blob: Blob | undefined, t: number) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const frame = await videoEngine.frameAt(blob, t, 1920, true);
        if (!live || !frame) return;
        const next = URL.createObjectURL(frame);
        setUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return next;
        });
      } catch {}
    }, 120);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [blob, t]);
  return blob ? url : undefined;
}

/* ---------- shared pieces ---------- */

function SidePanel({
  letter,
  title,
  stats,
  source,
  busy,
  note,
  children,
}: {
  letter: string;
  title: string;
  stats?: SideStats;
  source: number;
  busy?: boolean;
  note?: string;
  children?: React.ReactNode;
}) {
  const pct = stats ? savedPct(source, stats.size) : null;
  const isOriginal = stats?.size === source && letter === "A";
  return (
    <aside className={cn("flex min-h-0 flex-col gap-3 overflow-y-auto p-4 text-[12.5px]", letter === "A" ? "border-r border-rule" : "border-l border-rule")}>
      <header>
        <div className="label-caps text-muted-foreground">Side {letter}</div>
        <h2 className="mt-1 truncate text-[14px] font-semibold tracking-normal">{title}</h2>
      </header>
      <dl className={cn("grid grid-cols-2 gap-x-3 gap-y-2 border-y border-hair py-3", busy && "opacity-50")}>
        <Stat k="Size" v={stats ? formatBytes(stats.size) : "—"} big />
        <Stat
          k="Saved"
          v={isOriginal || pct === null ? "—" : pct > 0 ? `−${pct}%` : `+${-pct}%`}
          big
          accent={!isOriginal && pct !== null && pct > 0}
        />
        <Stat k="Pixels" v={stats ? `${stats.width}×${stats.height}` : "—"} />
        <Stat k="Encode" v={stats?.ms ? `${(stats.ms / 1000).toFixed(2)} s` : "—"} />
        <Stat k="SSIM" v={stats?.ssim !== undefined ? stats.ssim.toFixed(4) : "—"} />
        <Stat k="Status" v={busy ? "Encoding…" : "Ready"} />
      </dl>
      {note && <p className="text-[11px] font-medium">{note}</p>}
      {children}
      <p className="mt-auto hidden text-[11px] text-muted-foreground xl:block">
        Hold <Kbd>space</Kbd> for the original · <Kbd>M</Kbd> mode · <Kbd>1</Kbd>–<Kbd>4</Kbd> zoom · <Kbd>←</Kbd>
        <Kbd>→</Kbd> step · <Kbd>esc</Kbd> back · <Kbd>?</Kbd> all
      </p>
    </aside>
  );
}

function Stat({ k, v, big, accent }: { k: string; v: string; big?: boolean; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="label-caps text-muted-foreground">{k}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate tnum",
          big ? "fig text-[18px] leading-tight" : "font-bold",
          accent && "inline-block text-ok",
        )}
      >
        {v}
      </dd>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-7 shrink-0 place-items-center text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

function Filmstrip({ current }: { current: string }) {
  const order = useWorkspace((s) => s.order);
  const items = useWorkspace((s) => s.items);
  const active = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    // Block body: Chrome's scrollIntoView now returns a Promise, which React would treat as a cleanup.
    active.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [current]);
  return (
    <nav aria-label="Files" className="flex h-[76px] gap-1.5 overflow-x-auto border-t border-rule px-4 py-2.5">
      {order.map((id) => {
        const it = items[id];
        const pct = it.output ? savedPct(it.file.size, it.output.size) : null;
        return (
          <Link
            key={id}
            ref={id === current ? active : undefined}
            href={`/app/compare/${id}`}
            replace
            aria-current={id === current ? "true" : undefined}
            title={it.file.name}
            className={cn(
              "relative block h-full aspect-square shrink-0 overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring",
              id === current ? "ring-2 ring-acid ring-offset-2 ring-offset-background" : "opacity-60 hover:opacity-100",
            )}
          >
            {it.thumbUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.thumbUrl} alt="" className="size-full object-cover" />
            )}
            {pct !== null && (
              <span className="absolute inset-x-0 bottom-0 bg-black/70 text-center text-[9.5px] font-bold text-white tnum">
                {pct > 0 ? `−${pct}%` : "0%"}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();
function debounce(key: string, fn: () => void, ms = 150) {
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(fn, ms));
}
