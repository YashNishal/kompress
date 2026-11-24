"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Specimen } from "./figures";
import s from "./landing.module.css";

/**
 * Temporary: three takes on the landing page's headlines and text layout,
 * shown at /variants/a, /variants/b and /variants/c next to the current "/"
 * so they can be compared. Delete this file once one is chosen.
 */
export type Variant = "0" | "a" | "b" | "c" | "d";
export const VARIANTS: { id: Variant; name: string }[] = [
  { id: "0", name: "Current" },
  { id: "a", name: "A · Receipt" },
  { id: "b", name: "B · Squeeze" },
  { id: "c", name: "C · Index" },
  { id: "d", name: "Mix" },
];

export type ChapterCopy = {
  id: string;
  label: string;
  title: string;
  body: string;
  /** A: figures under the text. */
  stats?: [string, string][];
  /** B: one mono line under the text. */
  pull?: string;
};

const BODY = {
  folder: "Drop a folder and every image and video in it joins the queue, subfolders included. Encoding starts straight away.",
  bytes: "AVIF, WebP and JPEG XL describe the same picture far more efficiently than PNG or JPEG. Pick a quality for images, or a target size for video.",
  check: "Drag a divider across the original and the result, and zoom in as close as you like before you keep it.",
  private: "Everything runs inside this tab. There is no server to upload to and no account to make.",
};

export const COPY: Record<Variant, ChapterCopy[]> = {
  "0": [
    { id: "folder", label: "Folders", title: "Bring the whole folder.", body: BODY.folder },
    { id: "bytes", label: "Formats", title: "Same pixels, far fewer bytes.", body: BODY.bytes },
    { id: "check", label: "Compare", title: "Check it before you trust it.", body: BODY.check },
    { id: "private", label: "Privacy", title: "Nothing leaves your laptop.", body: BODY.private },
  ],
  a: [
    {
      id: "folder",
      label: "Folders",
      title: "One drop. The whole folder.",
      body: BODY.folder,
      stats: [["24", "files from one drop"], ["0", "clicks before it starts"]],
    },
    {
      id: "bytes",
      label: "Formats",
      title: "Same pixels. A tenth of the bytes.",
      body: BODY.bytes,
      stats: [["5", "image formats"], ["3", "video codecs"]],
    },
    {
      id: "check",
      label: "Compare",
      title: "Trust your eyes, then the numbers.",
      body: "Drag a divider across the original and the result, zoom down to single pixels, and read the SSIM score before you keep it.",
      stats: [["SSIM", "on every result"], ["1:1", "pixel zoom"]],
    },
    {
      id: "private",
      label: "Privacy",
      title: "Zero bytes uploaded.",
      body: BODY.private,
      stats: [["0 B", "sent to a server"], ["0", "accounts to make"]],
    },
  ],
  b: [
    { id: "folder", label: "Folders", title: "Throw the whole folder in.", body: BODY.folder, pull: "Subfolders too. It sorts itself out." },
    { id: "bytes", label: "Formats", title: "Newer codecs, tinier files.", body: BODY.bytes, pull: "AVIF · WebP · JPEG XL · JPEG · PNG" },
    { id: "check", label: "Compare", title: "Squint all you like.", body: BODY.check, pull: "Drag the divider. Zoom to the pixel." },
    { id: "private", label: "Privacy", title: "No uploads. No accounts. No catch.", body: BODY.private, pull: "Runs entirely in this tab." },
  ],
  // Mix: A's hero and layout, with the Formats heading from B and the Compare heading from C.
  d: [
    {
      id: "folder",
      label: "Folders",
      title: "One drop. The whole folder.",
      body: BODY.folder,
      stats: [["24", "files from one drop"], ["0", "clicks before it starts"]],
    },
    {
      id: "bytes",
      label: "Formats",
      title: "Newer codecs, tinier files.",
      body: BODY.bytes,
      stats: [["5", "image formats"], ["3", "video codecs"]],
    },
    {
      id: "check",
      label: "Compare",
      title: "Compare before you commit.",
      body: "Drag a divider across the original and the result, zoom down to single pixels, and read the SSIM score before you keep it.",
      stats: [["SSIM", "on every result"], ["1:1", "pixel zoom"]],
    },
    {
      id: "private",
      label: "Privacy",
      title: "Zero bytes uploaded.",
      body: BODY.private,
      stats: [["0 B", "sent to a server"], ["0", "accounts to make"]],
    },
  ],
  c: [
    { id: "folder", label: "Folders", title: "Drop a folder, get a queue.", body: BODY.folder },
    { id: "bytes", label: "Formats", title: "Pick a codec, watch it shrink.", body: BODY.bytes },
    { id: "check", label: "Compare", title: "Compare before you commit.", body: BODY.check },
    { id: "private", label: "Privacy", title: "Private by construction.", body: BODY.private },
  ],
};

const n2 = (i: number) => String(i + 1).padStart(2, "0");

/* ------------------------------------------------------------------ intros */

type IntroProps = { choose: () => void };

function Actions({ choose }: IntroProps) {
  return (
    <div className="mt-8 flex flex-wrap gap-2">
      <Button variant="acid" className="h-10 rounded-(--control-radius) px-4 text-[14px]" onClick={choose}>
        Choose files
      </Button>
      <Button asChild variant="chrome" className="h-10 rounded-(--control-radius) px-4 text-[14px]">
        <Link href="/app">Open workspace</Link>
      </Button>
    </div>
  );
}

/** Counts from `from` to `to` (KB) once, in step with the specimen's arrow. */
function useCountDown(from: number, to: number, delay = 400, ms = 1200) {
  const [v, setV] = useState(from);
  useEffect(() => {
    // Under reduced motion, jump straight to the end on the first frame.
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const t = still ? 1 : Math.min(1, Math.max(0, (now - t0) / ms));
      const e = 1 - Math.pow(1 - t, 3);
      setV(from + (to - from) * e);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, delay, ms]);
  return v;
}

const kb = (v: number) => (v >= 1000 ? `${(v / 1024).toFixed(2)} MB` : `${Math.round(v)} KB`);

/** A: the headline is the result; a receipt along the bottom does the maths. */
function IntroA({ choose }: IntroProps) {
  const after = useCountDown(3164, 187);
  const saved = Math.round((1 - after / 3164) * 100);
  return (
    <section className="grid min-h-[calc(100dvh-52px)] grid-rows-[minmax(0,1fr)_auto]">
      <div className="grid content-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center">
        <div>
          <p className="label-caps font-mono text-muted-foreground">IMG_0412.jpg · compressed in this tab</p>
          <h1 className="mt-6 text-[clamp(52px,9vw,144px)] font-semibold leading-[0.88] tracking-[-0.055em]">
            Same photo.
            <br />
            <span className="text-acid">94%</span> lighter.
          </h1>
          <p className="mt-8 max-w-[52ch] text-[17px] leading-relaxed text-muted-foreground">
            Kompress shrinks images and video right in your browser, with nothing to upload and nothing to install. Drop
            some files anywhere on this page to try it.
          </p>
          <Actions choose={choose} />
        </div>
        <Specimen />
      </div>
      <dl className="grid grid-cols-2 border-t border-hair md:grid-cols-4">
        {[
          ["Before", "3.09 MB", false],
          ["After", kb(after), true],
          ["Saved", `${saved}%`, false],
          ["Uploaded", "0 bytes", false],
        ].map(([k, v, hot], i) => (
          <div key={k as string} className={cn("px-5 py-5 sm:px-8", i > 0 && "md:border-l border-hair", i % 2 === 1 && "border-l", i > 1 && "border-t md:border-t-0")}>
            <dt className="label-caps text-muted-foreground">{k}</dt>
            <dd className={cn("fig tnum mt-2 text-[clamp(22px,2.4vw,34px)] leading-none", hot && "text-acid")}>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const TICKER = [
  ["IMG_2041.HEIC", "4.21 MB", "312 KB", "AVIF"],
  ["screenshot.png", "2.80 MB", "96 KB", "WebP"],
  ["holiday.mov", "88.4 MB", "9.6 MB", "H.264"],
  ["scan_004.png", "6.02 MB", "410 KB", "JPEG XL"],
  ["IMG_0412.jpg", "3.09 MB", "187 KB", "AVIF"],
  ["demo.mp4", "41.0 MB", "7.9 MB", "VP9"],
  ["poster.png", "1.94 MB", "121 KB", "WebP"],
];

/** B: the headline squeezes itself on load; a ticker of real-looking jobs runs underneath. */
function IntroB({ choose }: IntroProps) {
  const row = (hidden: boolean) => (
    <ul className={s.tickerRow} aria-hidden={hidden || undefined}>
      {TICKER.map(([name, a, b, fmt]) => (
        <li key={name} className="flex items-baseline gap-3 whitespace-nowrap px-8">
          <span className="text-foreground">{name}</span>
          <span className="text-muted-foreground line-through decoration-1">{a}</span>
          <span className="text-acid">→ {b}</span>
          <span className="label-caps text-muted-foreground">{fmt}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <section className="grid min-h-[calc(100dvh-52px)] grid-rows-[minmax(0,1fr)_auto] overflow-x-clip">
      <div className="grid content-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center">
        <div>
          <h1 className="text-[clamp(40px,6.4vw,112px)] font-semibold leading-[0.92] tracking-[-0.05em] sm:whitespace-nowrap">
            <span className={s.squeeze}>Squeeze the bytes.</span>
            <br />
            Keep the <span className="text-acid">pixels</span>.
          </h1>
          <p className="mt-8 max-w-[52ch] text-[17px] leading-relaxed text-muted-foreground">
            Kompress compresses images and video right in your browser, so a 3 MB photo comes out around 187 KB and looks
            the same. Drop some files anywhere on this page to try it.
          </p>
          <Actions choose={choose} />
        </div>
        <Specimen />
      </div>
      <div className={cn(s.ticker, "border-y border-hair py-4 font-mono text-[13px]")}>
        <span className="sr-only">Example results: </span>
        <div className={s.tickerTrack}>
          {row(false)}
          {row(true)}
        </div>
      </div>
    </section>
  );
}

const SPECS = [
  ["Images", "AVIF, WebP, JPEG XL, JPEG and PNG, at the quality you pick."],
  ["Video", "H.264, VP9 or AV1, squeezed to the size you ask for."],
  ["Where", "In this tab. No server, no account, no upload bar."],
];

/** C: a privacy-first headline, an annotated specimen, and a spec row to close the fold. */
function IntroC({ choose }: IntroProps) {
  return (
    <section className="grid min-h-[calc(100dvh-52px)] grid-rows-[minmax(0,1fr)_auto]">
      <div className="grid content-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center">
        <div>
          <h1 className="text-[clamp(40px,6.4vw,112px)] font-semibold leading-[0.92] tracking-[-0.05em] sm:whitespace-nowrap">
            Compress anything.
            <br />
            <span className="text-acid">Upload nothing.</span>
          </h1>
          <p className="mt-8 max-w-[52ch] text-[17px] leading-relaxed text-muted-foreground">
            Images and video, shrunk right here in your browser. Drop some files anywhere on this page to try it.
          </p>
          <Actions choose={choose} />
        </div>
        <Specimen annotated className="max-w-[560px]" />
      </div>
      <dl className="grid border-t border-hair md:grid-cols-3">
        {SPECS.map(([k, v], i) => (
          <div key={k} className={cn("flex gap-4 px-5 py-6 sm:px-8", i > 0 && "border-t border-hair md:border-t-0 md:border-l")}>
            <span aria-hidden className="fig w-6 shrink-0 text-[13px] text-acid">{n2(i)}</span>
            <div>
              <dt className="text-[15px] font-semibold">{k}</dt>
              <dd className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{v}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}

export const INTROS = { a: IntroA, b: IntroB, c: IntroC, d: IntroA } as const;

/* --------------------------------------------------------- chapter text */

const reveal = (d: number) => ({ "--d": d }) as CSSProperties;

/** The text column for one chapter, per variant. `i` is its index among `all`. */
export function ChapterText({ variant, all, i }: { variant: Exclude<Variant, "0">; all: ChapterCopy[]; i: number }) {
  const c = all[i];
  const title = (cls: string) => (
    <h2 id={`${c.id}-title`} className={cn(s.reveal, "text-balance font-semibold tracking-[-0.04em]", cls)} style={reveal(0)}>
      {c.title}
    </h2>
  );

  if (variant === "a" || variant === "d") {
    return (
      <div className="max-w-[48ch]">
        <p className={cn(s.reveal, "label-caps flex items-center gap-3 font-mono text-muted-foreground")} style={reveal(0)}>
          <span className="text-acid">{n2(i)}</span>
          <span className="h-px w-8 bg-hair" />
          {c.label}
        </p>
        {title("mt-5 text-[clamp(34px,4.2vw,64px)] leading-[0.95]")}
        <p className={cn(s.reveal, "mt-5 text-[17px] leading-relaxed text-muted-foreground")} style={reveal(1)}>
          {c.body}
        </p>
        <div className={cn(s.reveal, "mt-8 hidden grid-cols-2 border-t border-hair sm:grid")} style={reveal(2)}>
          {c.stats?.map(([v, k], j) => (
            <div key={k} className={cn("pt-5", j > 0 && "border-l border-hair pl-5")}>
              <p className="fig tnum text-[clamp(28px,3vw,44px)] leading-none">{v}</p>
              <p className="mt-2 text-[13px] text-muted-foreground">{k}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "b") {
    return (
      <div className="relative max-w-[46ch]">
        <span
          aria-hidden
          className={cn(s.ghostNum, "fig pointer-events-none absolute -top-[0.62em] -left-[0.04em] -z-0 select-none text-[clamp(120px,16vw,240px)] leading-none")}
        >
          {n2(i)}
        </span>
        <div className="relative">
          {title("text-[clamp(34px,4.2vw,64px)] leading-[0.95]")}
          <p className={cn(s.reveal, "mt-5 text-[17px] leading-relaxed text-muted-foreground")} style={reveal(1)}>
            {c.body}
          </p>
          <p className={cn(s.reveal, "fig mt-6 flex items-center gap-3 text-[14px] text-acid")} style={reveal(2)}>
            <span className="h-px w-6 bg-acid" />
            {c.pull}
          </p>
        </div>
      </div>
    );
  }

  // c: the whole story as an index, this chapter open and filling as you scroll.
  return (
    <ol className="w-full max-w-[52ch]">
      {all.map((x, j) =>
        j === i ? (
          <li key={x.id} className="border-t border-foreground py-6 first:border-t-0 first:pt-0 lg:first:border-t lg:first:pt-6">
            <p className="label-caps flex items-center gap-3 font-mono">
              <span className="text-acid">{n2(j)}</span>
              {x.label}
            </p>
            {title("mt-4 text-[clamp(32px,3.8vw,56px)] leading-[0.95]")}
            <p className={cn(s.reveal, "mt-4 text-[16px] leading-relaxed text-muted-foreground")} style={reveal(1)}>
              {x.body}
            </p>
            <div className="mt-6 h-[3px] overflow-hidden rounded-full bg-bar-track">
              <div className={cn(s.stepFill, "h-full bg-acid")} />
            </div>
          </li>
        ) : (
          <li key={x.id} className="hidden border-t border-hair lg:block">
            <a href={`#${x.id}`} className="flex items-baseline gap-3 py-3 text-[14px] text-muted-foreground transition-colors hover:text-foreground">
              <span className="fig w-6 text-[12px]">{n2(j)}</span>
              <span className="truncate">{x.title}</span>
            </a>
          </li>
        ),
      )}
    </ol>
  );
}

/* ------------------------------------------------------------- switcher */

export function VariantSwitcher({ current }: { current: Variant }) {
  return (
    <nav
      aria-label="Heading variants"
      className="fixed right-4 top-[64px] z-50 flex gap-1 rounded-full border border-hair bg-popover/95 p-1 text-[12px] shadow-lg backdrop-blur"
    >
      {VARIANTS.map((v) => (
        <Link
          key={v.id}
          href={v.id === "0" ? "/variants/0" : `/variants/${v.id}`}
          className={cn(
            "rounded-full px-3 py-1.5 whitespace-nowrap transition-colors",
            v.id === current ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v.name}
        </Link>
      ))}
    </nav>
  );
}
